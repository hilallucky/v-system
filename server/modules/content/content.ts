import { randomUUID } from "node:crypto";
import { existsSync, unlinkSync } from "node:fs";
import multer from "multer";
import { basename, extname, join } from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { database, uploadDirectory } from "../../database.js";
import { getLinkPreview } from "../../link-preview.js";
import { ApiError } from "../../types.js";
import { addContentNotifications } from "../notifications/service.js";

interface ItemRow extends RowDataPacket {
  id: string;
  parent_id: string | null;
  name: string;
  kind: "folder" | "file" | "link";
  mime_type: string | null;
  size: number | null;
  modified_at: string;
  owner: string;
  status: "Approved" | "In review" | "Ready";
  starred: number;
  shared: number;
  stored_name: string | null;
  child_count?: number;
  child_folder_count?: number;
  url: string | null;
  thumbnail_url: string | null;
  description: string | null;
}

const allowedTypes = new Map([
  [".pdf", "application/pdf"],
  [".csv", "text/csv"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  [".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
]);
const maximumUploadBytes = 20 * 1024 * 1024;

const itemSelect = `
  SELECT bc_items.id, bc_items.parent_id, bc_items.name, bc_items.kind, bc_items.mime_type, bc_items.size,
    bc_items.modified_at, bc_items.owner, bc_items.status, bc_items.starred, bc_items.shared, bc_items.stored_name,
    bc_items.url, bc_items.thumbnail_url, bc_items.description,
    (SELECT COUNT(*) FROM bc_items child WHERE child.parent_id = bc_items.id) AS child_count,
    (SELECT COUNT(*) FROM bc_items child WHERE child.parent_id = bc_items.id AND child.kind = 'folder') AS child_folder_count
  FROM bc_items
`;

function toItem(row: ItemRow) {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    kind: row.kind,
    mimeType: row.mime_type,
    size: row.size,
    modifiedAt: row.modified_at,
    owner: row.owner,
    status: row.status,
    starred: row.starred === 1,
    shared: row.shared === 1,
    childCount: row.child_count ?? 0,
    childFolderCount: row.child_folder_count ?? 0,
    url: row.url,
    thumbnailUrl: row.thumbnail_url,
    description: row.description,
    hasContent: row.stored_name !== null,
  };
}

async function assertParentFolder(parentId: string | null) {
  if (parentId === null) return;
  const db = await database;
  const [rows] = await db.execute<Array<{ kind: string } & RowDataPacket>>(
    "SELECT kind FROM bc_items WHERE id = ?",
    [parentId],
  );
  const parent = rows[0];
  if (!parent) throw new ApiError(404, "Parent folder was not found.");
  if (parent.kind !== "folder") throw new ApiError(400, "The selected parent is not a folder.");
}

async function assertUniqueName(name: string, parentId: string | null) {
  const db = await database;
  const [rows] = parentId
    ? await db.execute<Array<RowDataPacket>>(
        "SELECT 1 FROM bc_items WHERE parent_id = ? AND name = ?",
        [parentId, name],
      )
    : await db.execute<Array<RowDataPacket>>(
        "SELECT 1 FROM bc_items WHERE parent_id IS NULL AND name = ?",
        [name],
      );
  if (rows.length > 0) throw new ApiError(409, "A file or folder with that name already exists.");
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (_request, _file, callback) => callback(null, randomUUID()),
  }),
  limits: { fileSize: maximumUploadBytes, files: 1 },
  fileFilter: (_request, file, callback) => {
    const extension = extname(file.originalname).toLowerCase();
    const expectedType = allowedTypes.get(extension);
    if (!expectedType || file.mimetype !== expectedType) {
      callback(new ApiError(415, "Unsupported file type. Upload PDF, Office, CSV, PNG, or JPEG files."));
      return;
    }
    callback(null, true);
  },
});

export const uploadMiddleware = upload.single("file");

export async function getItems(input: {
  folderId: string | null;
  view: "all" | "recent" | "starred" | "shared";
  search: string;
  sort: "name" | "modified" | "type";
}) {
  const clauses: string[] = [];
  const parameters: Array<string | number | null> = [];

  if (input.search) {
    const pattern = `%${input.search.replace(/[!%_]/g, character => `!${character}`)}%`;
    clauses.push("(bc_items.name LIKE ? ESCAPE '!' OR bc_items.owner LIKE ? ESCAPE '!')");
    parameters.push(pattern, pattern);
  } else if (input.view === "all") {
    clauses.push(input.folderId === null ? "bc_items.parent_id IS NULL" : "bc_items.parent_id = ?");
    if (input.folderId !== null) parameters.push(input.folderId);
  }
  if (input.view === "recent") clauses.push("bc_items.kind IN ('file', 'link')");
  if (input.view === "starred") clauses.push("bc_items.starred = 1");
  if (input.view === "shared") clauses.push("bc_items.shared = 1");

  const orderBy = input.view === "recent"
    ? "bc_items.modified_at DESC, bc_items.id DESC"
    : {
    name: "CASE WHEN bc_items.kind = 'folder' THEN 0 ELSE 1 END, bc_items.name ASC",
    modified: "CASE WHEN bc_items.kind = 'folder' THEN 0 ELSE 1 END, bc_items.modified_at DESC",
    type: "CASE WHEN bc_items.kind = 'folder' THEN 0 ELSE 1 END, bc_items.mime_type ASC, bc_items.name ASC",
  }[input.sort];
  const limit = input.view === "recent" ? " LIMIT 30" : "";
  const db = await database;
  const [rows] = await db.execute<ItemRow[]>(
    `${itemSelect} WHERE ${clauses.join(" AND ")} ORDER BY ${orderBy}${limit}`,
    parameters,
  );
  return rows.map(toItem);
}

export async function getFolderPath(folderId: string) {
  const db = await database;
  const [rows] = await db.execute<Array<{ id: string; name: string } & RowDataPacket>>(`
    WITH RECURSIVE ancestors(id, parent_id, name, depth) AS (
      SELECT id, parent_id, name, 0 FROM bc_items WHERE id = ? AND kind = 'folder'
      UNION ALL
      SELECT parent.id, parent.parent_id, parent.name, ancestors.depth + 1
      FROM bc_items parent JOIN ancestors ON parent.id = ancestors.parent_id
    )
    SELECT id, name FROM ancestors ORDER BY depth DESC
  `, [folderId]);
  if (!rows.length) throw new ApiError(404, "Folder was not found.");
  return rows;
}

export async function addFolder(
  input: { name: string; parentId: string | null },
  owner: string,
  ownerId: string,
) {
  await assertParentFolder(input.parentId);
  await assertUniqueName(input.name, input.parentId);
  const now = new Date().toISOString();
  const id = randomUUID();
  const db = await database;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(`
      INSERT INTO bc_items (id, parent_id, name, kind, modified_at, owner, status)
      VALUES (?, ?, ?, 'folder', ?, ?, 'Ready')
    `, [id, input.parentId, input.name, now, owner]);
    await addContentNotifications(connection, { itemId: id, ownerId });
    const [rows] = await connection.execute<ItemRow[]>(`${itemSelect} WHERE bc_items.id = ?`, [id]);
    await connection.commit();
    return toItem(rows[0]);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function addFile(
  file: Express.Multer.File,
  input: { parentId: string | null; owner: string; ownerId: string },
) {
  await assertParentFolder(input.parentId);
  const name = basename(file.originalname.replaceAll("\\", "/")).trim();
  const safeName = z.string().min(1).max(180).parse(name);
  await assertUniqueName(safeName, input.parentId);
  const now = new Date().toISOString();
  const id = randomUUID();
  const db = await database;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(`
      INSERT INTO bc_items (
        id, parent_id, name, kind, mime_type, size, modified_at, owner, status, stored_name
      ) VALUES (?, ?, ?, 'file', ?, ?, ?, ?, 'Ready', ?)
    `, [id, input.parentId, safeName, file.mimetype, file.size, now, input.owner, file.filename]);
    await addContentNotifications(connection, { itemId: id, ownerId: input.ownerId });
    const [rows] = await connection.execute<ItemRow[]>(`${itemSelect} WHERE bc_items.id = ?`, [id]);
    await connection.commit();
    return toItem(rows[0]);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function addLink(
  input: { url: string; name?: string; parentId: string | null },
  owner: string,
  ownerId: string,
) {
  await assertParentFolder(input.parentId);
  const preview = await getLinkPreview(input.url);
  const name = (input.name?.trim() || preview.title).slice(0, 180);
  await assertUniqueName(name, input.parentId);
  const id = randomUUID();
  const now = new Date().toISOString();
  const db = await database;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(`
      INSERT INTO bc_items (
        id, parent_id, name, kind, mime_type, modified_at, owner, status,
        url, thumbnail_url, description
      ) VALUES (?, ?, ?, 'link', 'text/html', ?, ?, 'Ready', ?, ?, ?)
    `, [
      id,
      input.parentId,
      name,
      now,
      owner,
      preview.url,
      preview.thumbnailUrl,
      preview.description,
    ]);
    await addContentNotifications(connection, { itemId: id, ownerId });
    const [rows] = await connection.execute<ItemRow[]>(`${itemSelect} WHERE bc_items.id = ?`, [id]);
    await connection.commit();
    return toItem(rows[0]);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getItem(id: string) {
  const db = await database;
  const [rows] = await db.execute<ItemRow[]>(`${itemSelect} WHERE bc_items.id = ?`, [id]);
  if (!rows[0]) throw new ApiError(404, "Content item was not found.");
  return toItem(rows[0]);
}

export async function getFileForDownload(id: string) {
  const db = await database;
  const [rows] = await db.execute<
    Array<Pick<ItemRow, "id" | "name" | "stored_name" | "mime_type" | "starred" | "shared"> & RowDataPacket>
  >(
    "SELECT id, name, stored_name, mime_type, starred, shared FROM bc_items WHERE id = ? AND kind = 'file'",
    [id],
  );
  const row = rows[0];
  if (!row) throw new ApiError(404, "File was not found.");
  if (!row.stored_name || !existsSync(join(uploadDirectory, row.stored_name))) {
    throw new ApiError(404, "The file content is no longer available.");
  }
  return { ...row, path: join(uploadDirectory, row.stored_name) };
}

export async function isRecentItem(id: string) {
  const db = await database;
  const [rows] = await db.execute<Array<{ id: string } & RowDataPacket>>(
    `SELECT id FROM bc_items
     WHERE kind IN ('file', 'link')
     ORDER BY modified_at DESC, id DESC
     LIMIT 30`,
  );
  return rows.some(row => row.id === id);
}

export function removeUnrecordedUpload(filename: string) {
  const filePath = join(uploadDirectory, filename);
  if (existsSync(filePath)) unlinkSync(filePath);
}

export async function getStats() {
  const db = await database;
  const [rows] = await db.execute<Array<{
    folders: number | null;
    documents: number | null;
    needs_review: number | null;
    storage_used: number | null;
  } & RowDataPacket>>(`
    SELECT
      SUM(CASE WHEN kind = 'folder' THEN 1 ELSE 0 END) AS folders,
      SUM(CASE WHEN kind = 'file' THEN 1 ELSE 0 END) AS documents,
      SUM(CASE WHEN kind = 'file' AND status = 'In review' THEN 1 ELSE 0 END) AS needs_review,
      COALESCE(SUM(CASE WHEN kind = 'file' THEN size ELSE 0 END), 0) AS storage_used
    FROM bc_items
  `);
  const stats = rows[0];
  return {
    folders: stats.folders ?? 0,
    documents: stats.documents ?? 0,
    needsReview: stats.needs_review ?? 0,
    storageUsed: Number(stats.storage_used ?? 0),
    storageLimit: 10 * 1024 * 1024 * 1024,
  };
}
