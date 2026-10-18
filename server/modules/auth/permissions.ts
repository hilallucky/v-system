import type { NextFunction, Request, Response } from "express";
import type { RowDataPacket } from "mysql2/promise";
import { database } from "../../database.js";
import { ApiError } from "../../types.js";

export const menuKeys = [
  "admin-dashboard",
  "user-management",
  "role-management",
  "contents",
  "folders",
  "recent",
  "starred",
  "shared",
  "follow-up-checklist",
  "monthly-target",
  "activity-record-plan",
  "customer-list",
  "prospect-list",
  "daily-tasks",
  "monthly-side-volume",
] as const;

export type MenuKey = (typeof menuKeys)[number];
export type MenuAction = "view" | "add" | "edit" | "delete";
export type AppRole = "admin" | "supervisor" | "user" | "member";

export interface MenuPermissions {
  menuKey: MenuKey;
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
}

export async function getRoleMenuPermissions(role: AppRole): Promise<MenuPermissions[]> {
  const db = await database;
  const [rows] = await db.execute<Array<RowDataPacket & {
    menu_key: MenuKey;
    can_view: number;
    can_add: number;
    can_edit: number;
    can_delete: number;
  }>>(
    `SELECT menu_key, can_view, can_add, can_edit, can_delete
     FROM role_menu_permissions WHERE role = ? ORDER BY menu_key`,
    [role],
  );
  return rows.map(row => ({
    menuKey: row.menu_key,
    view: Boolean(row.can_view),
    add: Boolean(row.can_add),
    edit: Boolean(row.can_edit),
    delete: Boolean(row.can_delete),
  }));
}

export async function getCurrentMenuPermissions(role: AppRole) {
  return getRoleMenuPermissions(role);
}

export async function assertMenuPermission(role: AppRole, menuKey: MenuKey, action: MenuAction) {
  if (role === "admin") return;
  const column = action === "view"
    ? "can_view"
    : action === "add"
      ? "can_add"
      : action === "edit"
        ? "can_edit"
        : "can_delete";
  const db = await database;
  const [rows] = await db.execute<Array<RowDataPacket & { allowed: number }>>(
    `SELECT ${column} AS allowed
     FROM role_menu_permissions WHERE role = ? AND menu_key = ?`,
    [role, menuKey],
  );
  if (!rows[0]?.allowed) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
}

export async function saveRoleMenuPermissions(
  role: Exclude<AppRole, "admin">,
  permissions: MenuPermissions[],
) {
  const byKey = new Map(permissions.map(permission => [permission.menuKey, permission]));
  if (byKey.size !== menuKeys.length || menuKeys.some(key => !byKey.has(key))) {
    throw new ApiError(400, "Provide permissions for every available menu.");
  }
  if (byKey.get("role-management")?.view || byKey.get("role-management")?.add ||
    byKey.get("role-management")?.edit || byKey.get("role-management")?.delete) {
    throw new ApiError(400, "Role Management is restricted to Administrators.");
  }
  if (byKey.get("user-management")?.delete) {
    throw new ApiError(400, "Permanent account deletion is not available.");
  }
  const userManagement = byKey.get("user-management");
  if (role === "user" && (userManagement?.add || userManagement?.edit) ||
    role === "member" && (userManagement?.view || userManagement?.add || userManagement?.edit)) {
    throw new ApiError(400, "User and Member account permissions are restricted by the role hierarchy.");
  }
  const db = await database;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("DELETE FROM role_menu_permissions WHERE role = ?", [role]);
    for (const menuKey of menuKeys) {
      const permission = byKey.get(menuKey);
      if (!permission) throw new ApiError(400, "A menu permission is missing.");
      await connection.execute(
        `INSERT INTO role_menu_permissions
          (role, menu_key, can_view, can_add, can_edit, can_delete)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [role, menuKey, permission.view, permission.add, permission.edit, permission.delete],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return getRoleMenuPermissions(role);
}

export function requireMenuPermission(menuKey: MenuKey, action: MenuAction) {
  return async (_request: Request, response: Response, next: NextFunction) => {
    try {
      await assertMenuPermission(response.locals.user.role, menuKey, action);
      next();
    } catch (error) {
      next(error);
    }
  };
}
