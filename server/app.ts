import express, {
  type ErrorRequestHandler,
  type Request,
  type Response,
} from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import multer from "multer";
import { z } from "zod";
import { database } from "./database.js";
import {
  authenticateSession,
  getAuthenticatedUser,
  logIn,
  logOut,
  signUp,
  updateProfile,
} from "./auth.js";
import {
  addLink,
  addFile,
  addFolder,
  getFileForDownload,
  getFolderPath,
  getItems,
  getStats,
  removeUnrecordedUpload,
  uploadMiddleware,
} from "./routes.js";
import { ApiError } from "./types.js";

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
const itemQuery = z.object({
  folderId: z.union([z.literal("root"), uuidSchema]).optional().default("root"),
  view: z.enum(["all", "recent", "starred", "shared"]).optional().default("all"),
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

  api.put("/auth/profile", async (request, response) => {
    const input = profileInput.parse(request.body);
    response.json({ data: await updateProfile(response.locals.user.id, input) });
  });

  api.get("/items", async (request, response) => {
    const query = itemQuery.parse(request.query);
    response.json({
      data: await getItems({
        folderId: query.folderId === "root" ? null : query.folderId,
        view: query.view,
        search: query.search,
        sort: query.sort,
      }),
    });
  });

  api.get("/stats", async (_request, response) => {
    response.json({ data: await getStats() });
  });

  api.get("/folders/:id/path", async (request, response) => {
    const id = uuidSchema.parse(request.params.id);
    response.json({ data: await getFolderPath(id) });
  });

  api.post("/folders", async (request, response) => {
    const input = folderInput.parse(request.body);
    const folder = await addFolder(input, response.locals.user.fullName);
    response.status(201).json({ data: folder });
  });

  api.post("/links", async (request, response) => {
    const input = linkInput.parse(request.body);
    response.status(201).json({
      data: await addLink(input, response.locals.user.fullName),
    });
  });

  api.post("/files", uploadMiddleware, async (request, response) => {
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
