import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { database } from "../../database.js";
import { ApiError } from "../../types.js";

export interface ContentNotification {
  id: number;
  itemId: string;
  itemName: string;
  itemKind: "folder" | "file" | "link";
  parentId: string | null;
  createdAt: string;
  readAt: string | null;
}

export async function addContentNotifications(
  connection: PoolConnection,
  input: { itemId: string; ownerId: string },
) {
  await connection.execute(
    `INSERT INTO bc_notifications (user_id, item_id)
     SELECT users.id, ?
     FROM users
     JOIN user_roles ON user_roles.user_id = users.id
     WHERE users.is_active = 1 AND users.id <> ?
       AND EXISTS (
         SELECT 1 FROM role_menu_permissions
         WHERE role_menu_permissions.role = user_roles.role
           AND role_menu_permissions.menu_key = 'contents'
           AND role_menu_permissions.can_view = 1
       )`,
    [input.itemId, input.ownerId],
  );
}

export async function listContentNotifications(userId: string) {
  const db = await database;
  const [[rows], [countRows]] = await Promise.all([
    db.execute<Array<RowDataPacket & {
    id: number;
    item_id: string;
    item_name: string;
    item_kind: "folder" | "file" | "link";
    parent_id: string | null;
    created_at: Date | string;
    read_at: Date | string | null;
  }>>(
    `SELECT n.id, n.item_id, i.name AS item_name, i.kind AS item_kind, i.parent_id,
      n.created_at, n.read_at
     FROM bc_notifications n
     JOIN bc_items i ON i.id = n.item_id
     WHERE n.user_id = ?
     ORDER BY n.created_at DESC, n.id DESC
     LIMIT 50`,
    [userId],
    ),
    db.execute<Array<RowDataPacket & { unread_count: number }>>(
      "SELECT COUNT(*) AS unread_count FROM bc_notifications WHERE user_id = ? AND read_at IS NULL",
      [userId],
    ),
  ]);
  const items = rows.map(row => ({
    id: row.id,
    itemId: row.item_id,
    itemName: row.item_name,
    itemKind: row.item_kind,
    parentId: row.parent_id,
    createdAt: new Date(row.created_at).toISOString(),
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
  })) satisfies ContentNotification[];
  return { items, unreadCount: Number(countRows[0].unread_count) };
}

export async function markContentNotificationRead(id: number, userId: string) {
  const db = await database;
  const [result] = await db.execute(
    "UPDATE bc_notifications SET read_at = COALESCE(read_at, UTC_TIMESTAMP()) WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  if (Number(Reflect.get(result, "affectedRows")) === 0) {
    const [rows] = await db.execute<Array<RowDataPacket & { id: number }>>(
      "SELECT id FROM bc_notifications WHERE id = ? AND user_id = ?",
      [id, userId],
    );
    if (!rows.length) throw new ApiError(404, "Notification was not found.");
  }
  return { read: true };
}
