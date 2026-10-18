import express, {
  type ErrorRequestHandler,
  type Request,
  type Response,
} from "express";
import { existsSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { join } from "node:path";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import multer from "multer";
import { z } from "zod";
import { database } from "../database.js";
import {
  authenticateSession,
  getAuthenticatedUser,
  logIn,
  logOut,
  requireAdmin,
  createManagedUser,
  listManagedUsers,
  setManagedUserActive,
  updateManagedUser,
  signUp,
  updateProfile,
} from "../modules/auth/auth.js";
import {
  addLink,
  addFile,
  addFolder,
  getFileForDownload,
  getFolderPath,
  getItem,
  getItems,
  getStats,
  isRecentItem,
  removeUnrecordedUpload,
  uploadMiddleware,
} from "../modules/content/content.js";
import {
  deletePlaybookRecord,
  getPlaybookCatalogs,
  listPlaybookRecords,
  playbookForms,
  streamPlaybookCsv,
  savePlaybookRecord,
} from "../modules/playbooks/service.js";
import {
  listContentNotifications,
  markContentNotificationRead,
} from "../modules/notifications/service.js";
import {
  requireMenuPermission,
  assertMenuPermission,
  getCurrentMenuPermissions,
  getRoleMenuPermissions,
  menuKeys,
  saveRoleMenuPermissions,
  type AppRole,
  type MenuPermissions,
} from "../modules/auth/permissions.js";
import { ApiError } from "../types.js";

const uuidSchema = z.string().uuid();
const folderInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Folder name is required.")
    .max(80, "Folder name must be 80 characters or fewer.")
    .regex(/^[^\\/:*?"<>|\u0000-\u001f]+$/, "Folder name contains unsupported characters."),
  parentId: uuidSchema.nullable().optional().default(null),
});
const managedUserInput = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(10).max(128),
  role: z.enum(["admin", "supervisor", "user", "member"]).default("user"),
});
const managedUserStatusInput = z.object({ isActive: z.boolean() });
const playbookPeriodQuery = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2200).optional(),
}).refine(value => !value.month || value.year, "A year is required when filtering by month.");
const playbookExportQuery = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2200).optional(),
  search: z.string().trim().max(100).optional().default(""),
}).refine(value => !value.month || value.year, "A year is required when filtering by month.");
const managedUserUpdateInput = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  role: z.enum(["admin", "supervisor", "user", "member"]),
});
const rolePermissionInput = z.object({
  role: z.enum(["supervisor", "user", "member"]),
  permissions: z.array(z.object({
    menuKey: z.enum(menuKeys),
    view: z.boolean(),
    add: z.boolean(),
    edit: z.boolean(),
    delete: z.boolean(),
  }).strict()).length(menuKeys.length),
});
const itemQuery = z.object({
  folderId: z.union([z.literal("root"), uuidSchema]).optional().default("root"),
  view: z.enum(["all", "recent", "starred", "shared"]).optional().default("all"),
  kind: z.literal("folder").optional(),
  search: z.string().trim().max(100).optional().default(""),
  sort: z.enum(["name", "modified", "type"]).optional().default("name"),
});
const parentInput = z.object({ parentId: uuidSchema.optional() });
const linkInput = z.object({
  url: z.string().trim().url().max(2048),
  name: z.string().trim().max(180).optional(),
  parentId: uuidSchema.nullable().optional().default(null),
});
const signUpInput = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(10).max(128),
});
const logInInput = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(1).max(128),
});
const profileInput = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
});
export function createApp() {
  const app = express();
  const api = express.Router();

  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  const authRateLimit = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });

  async function assertContentItemRead(
    role: AppRole,
    item: Awaited<ReturnType<typeof getItem>>,
  ) {
    if (role === "admin") return;
    const permissions = await getCurrentMenuPermissions(role);
    const hasView = (key: MenuPermissions["menuKey"]) =>
      Boolean(permissions.find(permission => permission.menuKey === key)?.view);
    if (item.kind === "folder") {
      if (hasView("contents") || hasView("folders")) return;
    } else {
      if (hasView("contents")) return;
      if (item.starred && hasView("starred")) return;
      if (item.shared && hasView("shared")) return;
      if (hasView("recent") && await isRecentItem(item.id)) return;
    }
    throw new ApiError(403, "You do not have permission to view this content item.");
  }

  api.get("/health", async (_request, response) => {
    const db = await database;
    await db.query("SELECT 1");
    response.json({ data: { status: "ok" } });
  });

  api.post("/auth/signup", authRateLimit, async (request, response) => {
    const input = signUpInput.parse(request.body);
    response.status(201).json({ data: await signUp(input, response) });
  });

  api.post("/auth/login", authRateLimit, async (request, response) => {
    const input = logInInput.parse(request.body);
    response.json({ data: await logIn(input, response) });
  });

  api.post("/auth/logout", async (request, response) => {
    await logOut(request, response);
    response.json({ data: { status: "ok" } });
  });

  api.get("/auth/me", async (request, response) => {
    response.json({ data: await getAuthenticatedUser(request) });
  });

  api.use(authenticateSession);

  api.get("/items/:id", async (request, response) => {
    const id = uuidSchema.parse(request.params.id);
    const item = await getItem(id);
    await assertContentItemRead(response.locals.user.role, item);
    response.json({ data: item });
  });

  api.put("/auth/profile", async (request, response) => {
    const input = profileInput.parse(request.body);
    response.json({ data: await updateProfile(response.locals.user.id, input) });
  });

  api.get("/permissions/me", async (_request, response) => {
    response.json({ data: await getCurrentMenuPermissions(response.locals.user.role) });
  });

  api.get("/admin/role-permissions", requireAdmin, async (_request, response) => {
    const roles: AppRole[] = ["admin", "supervisor", "user", "member"];
    const permissions = await Promise.all(
      roles.map(async role => ({ role, permissions: await getRoleMenuPermissions(role) })),
    );
    response.json({ data: permissions });
  });

  api.put("/admin/role-permissions", requireAdmin, async (request, response) => {
    const input = rolePermissionInput.parse(request.body);
    response.json({
      data: await saveRoleMenuPermissions(input.role, input.permissions as MenuPermissions[]),
    });
  });

  api.get("/admin/users", async (_request, response) => {
    await assertMenuPermission(response.locals.user.role, "user-management", "view");
    response.json({ data: await listManagedUsers() });
  });

  api.post("/admin/users", async (request, response) => {
    if (!["admin", "supervisor"].includes(response.locals.user.role)) {
      throw new ApiError(403, "Only Administrators and Supervisors can create accounts.");
    }
    await assertMenuPermission(response.locals.user.role, "user-management", "add");
    const input = managedUserInput.parse(request.body);
    if (response.locals.user.role === "supervisor" && !["user", "member"].includes(input.role)) {
      throw new ApiError(403, "Supervisors can only create User or Member accounts.");
    }
    response.status(201).json({ data: await createManagedUser(input) });
  });

  api.put("/admin/users/:id", async (request, response) => {
    if (!["admin", "supervisor"].includes(response.locals.user.role)) {
      throw new ApiError(403, "Only Administrators and Supervisors can edit accounts.");
    }
    await assertMenuPermission(response.locals.user.role, "user-management", "edit");
    const id = uuidSchema.parse(request.params.id);
    const input = managedUserUpdateInput.parse(request.body);
    response.json({
      data: await updateManagedUser(id, input, {
        id: response.locals.user.id,
        role: response.locals.user.role,
      }),
    });
  });

  api.patch("/admin/users/:id/status", async (request, response) => {
    if (!["admin", "supervisor"].includes(response.locals.user.role)) {
      throw new ApiError(403, "Only Administrators and Supervisors can manage account access.");
    }
    await assertMenuPermission(response.locals.user.role, "user-management", "edit");
    const id = uuidSchema.parse(request.params.id);
    const input = managedUserStatusInput.parse(request.body);
    response.json({
      data: await setManagedUserActive(id, input.isActive, {
        id: response.locals.user.id,
        role: response.locals.user.role,
      }),
    });
  });

  api.get("/notifications", async (_request, response) => {
    response.json({ data: await listContentNotifications(response.locals.user.id) });
  });

  api.patch("/notifications/:id/read", async (request, response) => {
    const id = z.coerce.number().int().positive().parse(request.params.id);
    response.json({
      data: await markContentNotificationRead(id, response.locals.user.id),
    });
  });

  api.get("/playbooks/catalogs", async (_request, response) => {
    if (response.locals.user.role !== "admin") {
      const permissions = await getCurrentMenuPermissions(response.locals.user.role);
      if (!permissions.some(permission =>
        ["follow-up-checklist", "monthly-target", "activity-record-plan", "customer-list", "prospect-list", "daily-tasks", "monthly-side-volume"].includes(permission.menuKey) &&
        permission.view)) {
        throw new ApiError(403, "You do not have permission to view Playbooks.");
      }
    }
    response.json({ data: await getPlaybookCatalogs() });
  });

  api.get("/playbooks/:form", async (request, response) => {
    const form = z.enum(playbookForms).parse(request.params.form);
    const period = playbookPeriodQuery.parse(request.query);
    await assertMenuPermission(response.locals.user.role, form, "view");
    response.json({
      data: await listPlaybookRecords(form, response.locals.user.id, period),
    });
  });

  api.get("/playbooks/:form/export", async (request, response) => {
    const form = z.enum(playbookForms).parse(request.params.form);
    const query = playbookExportQuery.parse(request.query);
    await assertMenuPermission(response.locals.user.role, form, "view");
    try {
      const csvStream = streamPlaybookCsv(
        form,
        response.locals.user.id,
        query,
        query.search,
      );
      const firstChunk = await csvStream.next();
      response.status(200);
      response.setHeader("Content-Type", "text/csv; charset=utf-8");
      response.setHeader("Content-Disposition", `attachment; filename="playbook-${form}.csv"`);
      response.setHeader("Cache-Control", "no-store");
      const csvChunks = (async function* () {
        if (!firstChunk.done) yield firstChunk.value;
        yield* csvStream;
      })();
      await pipeline(
        Readable.from(csvChunks, { objectMode: false }),
        response,
      );
    } catch (error) {
      if (response.destroyed) return;
      if (response.headersSent) {
        console.error(`Playbook CSV export failed for ${form}.`, error);
        response.destroy(error instanceof Error ? error : new Error("Playbook CSV export failed."));
        return;
      }
      throw error;
    }
  });

  api.post("/playbooks/:form", async (request, response) => {
    const form = z.enum(playbookForms).parse(request.params.form);
    const recordId = z.object({ id: z.coerce.number().int().positive().optional() }).safeParse(request.body);
    await assertMenuPermission(
      response.locals.user.role,
      form,
      recordId.success && recordId.data.id ? "edit" : "add",
    );
    response.status(201).json({
      data: await savePlaybookRecord(form, response.locals.user.id, request.body),
    });
  });

  api.delete("/playbooks/:form/:id", async (request, response) => {
    const form = z.enum(playbookForms).parse(request.params.form);
    await assertMenuPermission(response.locals.user.role, form, "delete");
    const id = z.coerce.number().int().positive().parse(request.params.id);
    response.json({
      data: await deletePlaybookRecord(form, response.locals.user.id, id),
    });
  });

  api.get("/items", async (request, response) => {
    const query = itemQuery.parse(request.query);
    const rolePermissions = response.locals.user.role === "admin"
      ? null
      : await getCurrentMenuPermissions(response.locals.user.role);
    const canViewAllContent = response.locals.user.role === "admin" ||
      Boolean(rolePermissions?.find(permission => permission.menuKey === "contents")?.view);
    const menu = query.kind === "folder"
      ? "folders"
      : query.view === "recent"
      ? "recent"
      : query.view === "starred"
        ? "starred"
        : query.view === "shared"
          ? "shared"
          : query.folderId === "root" && !query.search
            ? "contents"
            : canViewAllContent ? "contents" : "folders";
    await assertMenuPermission(response.locals.user.role, menu, "view");
    const items = await getItems({
      folderId: query.folderId === "root" ? null : query.folderId,
      view: query.view,
      search: query.search,
      sort: query.sort,
    });
    response.json({
      data: query.kind === "folder" || query.view === "all" && !canViewAllContent
        ? items.filter(item => item.kind === "folder")
        : items,
    });
  });

  api.get("/stats", async (_request, response) => {
    if (response.locals.user.role !== "admin") {
      const permissions = await getCurrentMenuPermissions(response.locals.user.role);
      if (!permissions.some(permission =>
        ["contents", "admin-dashboard"].includes(permission.menuKey) && permission.view)) {
        throw new ApiError(403, "You do not have permission to view workspace statistics.");
      }
    }
    const stats = await getStats();
    response.json({
      data: response.locals.user.role === "admin" || response.locals.user.role === "supervisor"
        ? stats
        : { ...stats, needsReview: 0, storageUsed: 0, storageLimit: 0 },
    });
  });

  api.get("/folders/:id/path", async (request, response) => {
    if (response.locals.user.role !== "admin") {
      const permissions = await getCurrentMenuPermissions(response.locals.user.role);
      if (!permissions.some(permission =>
        ["contents", "folders"].includes(permission.menuKey) && permission.view)) {
        throw new ApiError(403, "You do not have permission to view folders.");
      }
    }
    const id = uuidSchema.parse(request.params.id);
    response.json({ data: await getFolderPath(id) });
  });

  api.post("/folders", async (request, response) => {
    await assertMenuPermission(response.locals.user.role, "folders", "add");
    const input = folderInput.parse(request.body);
    const folder = await addFolder(
      input,
      response.locals.user.fullName,
      response.locals.user.id,
    );
    response.status(201).json({ data: folder });
  });

  api.post("/links", async (request, response) => {
    await assertMenuPermission(response.locals.user.role, "contents", "add");
    const input = linkInput.parse(request.body);
    response.status(201).json({
      data: await addLink(input, response.locals.user.fullName, response.locals.user.id),
    });
  });

  api.post("/files", requireMenuPermission("contents", "add"), uploadMiddleware, async (request, response) => {
    if (!request.file) throw new ApiError(400, "Choose a file to upload.");
    let parentId: string | null;
    try {
      const parent = parentInput.parse({ parentId: request.body.parentId });
      parentId = parent.parentId ?? null;
    } catch (error) {
      try {
        removeUnrecordedUpload(request.file.filename);
      } catch (cleanupError) {
        console.error("Failed to remove an unrecorded upload.", cleanupError);
      }
      throw error;
    }
    try {
      const file = await addFile(request.file, {
        parentId,
        owner: response.locals.user.fullName,
        ownerId: response.locals.user.id,
      });
      response.status(201).json({ data: file });
    } catch (error) {
      try {
        removeUnrecordedUpload(request.file.filename);
      } catch (cleanupError) {
        console.error("Failed to remove an unrecorded upload.", cleanupError);
      }
      throw error;
    }
  });

  api.get("/files/:id/preview", async (request, response) => {
    const id = uuidSchema.parse(request.params.id);
    await assertContentItemRead(response.locals.user.role, await getItem(id));
    const file = await getFileForDownload(id);
    response.sendFile(file.path, {
      headers: {
        "Content-Disposition": "inline",
        "Content-Type": file.mime_type ?? "application/octet-stream",
      },
    });
  });

  api.get("/files/:id/download", async (request, response) => {
    const id = uuidSchema.parse(request.params.id);
    await assertContentItemRead(response.locals.user.role, await getItem(id));
    const file = await getFileForDownload(id);
    response.download(file.path, file.name);
  });

  app.use("/api/v1", api);
  app.use("/api", (_request, response) => {
    response.status(404).json({ error: { message: "API endpoint not found." } });
  });
  const frontendDirectory = join(process.cwd(), "dist");
  const frontendEntry = join(frontendDirectory, "index.html");
  if (existsSync(frontendEntry)) {
    app.use(express.static(frontendDirectory));
    app.use((request, response, next) => {
      if (request.method === "GET" && request.accepts("html")) {
        response.sendFile(frontendEntry, error => {
          if (error) next(error);
        });
        return;
      }
      next();
    });
  }

  const errorHandler: ErrorRequestHandler = (
    error: unknown,
    _request: Request,
    response: Response,
    _next,
  ) => {
    if (error instanceof z.ZodError) {
      response.status(400).json({
        error: { message: "Request validation failed.", details: error.flatten() },
      });
      return;
    }
    if (error instanceof SyntaxError && Reflect.get(error, "status") === 400) {
      response.status(400).json({ error: { message: "Request body contains invalid JSON." } });
      return;
    }
    if (error instanceof multer.MulterError) {
      const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      response.status(status).json({
        error: {
          message:
            error.code === "LIMIT_FILE_SIZE"
              ? "File exceeds the 20 MB upload limit."
              : "The upload could not be processed.",
        },
      });
      return;
    }
    if (error instanceof ApiError) {
      response.status(error.status).json({ error: { message: error.message } });
      return;
    }
    console.error("Unhandled API error.", error);
    response.status(500).json({ error: { message: "An unexpected server error occurred." } });
  };
  app.use(errorHandler);

  app.use((_request, response) => {
    response.status(404).json({ error: { message: "Resource not found." } });
  });

  return app;
}
