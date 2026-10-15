import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { database } from "../../database.js";
import { ApiError } from "../../types.js";

export type FollowUpStatus = "open" | "in_progress" | "resolved";

interface FollowUpRow extends RowDataPacket {
  id: string;
  created_by: string;
  creator_name: string;
  assigned_to: string | null;
  assignee_name: string | null;
  title: string;
  description: string;
  status: FollowUpStatus;
  due_date: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function toFollowUp(row: FollowUpRow) {
  return {
    id: row.id,
    createdBy: row.created_by,
    creatorName: row.creator_name,
    assignedTo: row.assigned_to,
    assigneeName: row.assignee_name,
    title: row.title,
    description: row.description,
    status: row.status,
    dueDate: row.due_date,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

const followUpSelect = `
  SELECT bc_follow_ups.id, bc_follow_ups.created_by, creator.full_name AS creator_name,
    bc_follow_ups.assigned_to, assignee.full_name AS assignee_name,
    bc_follow_ups.title, bc_follow_ups.description, bc_follow_ups.status,
    DATE_FORMAT(bc_follow_ups.due_date, '%Y-%m-%d') AS due_date,
    bc_follow_ups.created_at, bc_follow_ups.updated_at
  FROM bc_follow_ups
  JOIN users creator ON creator.id = bc_follow_ups.created_by
  LEFT JOIN users assignee ON assignee.id = bc_follow_ups.assigned_to
`;

export async function listFollowUps(userId: string, isAdmin: boolean) {
  const db = await database;
  const [rows] = await db.execute<FollowUpRow[]>(
    `${followUpSelect}${isAdmin ? "" : " WHERE bc_follow_ups.created_by = ?"} ORDER BY bc_follow_ups.updated_at DESC`,
    isAdmin ? [] : [userId],
  );
  return rows.map(toFollowUp);
}

export async function createFollowUp(
  input: { title: string; description: string; dueDate: string | null },
  userId: string,
) {
  const db = await database;
  const id = randomUUID();
  await db.execute(
    `INSERT INTO bc_follow_ups (id, created_by, title, description, due_date)
     VALUES (?, ?, ?, ?, ?)`,
    [id, userId, input.title, input.description, input.dueDate],
  );
  const [rows] = await db.execute<FollowUpRow[]>(`${followUpSelect} WHERE bc_follow_ups.id = ?`, [id]);
  if (!rows[0]) throw new ApiError(500, "The follow-up was created but could not be loaded.");
  return toFollowUp(rows[0]);
}

export async function updateFollowUp(
  id: string,
  input: { status: FollowUpStatus; assignedTo?: string | null },
) {
  const db = await database;
  const [existing] = await db.execute<Array<{ id: string } & RowDataPacket>>(
    "SELECT id FROM bc_follow_ups WHERE id = ?",
    [id],
  );
  if (!existing[0]) throw new ApiError(404, "Follow-up was not found.");

  if (input.assignedTo !== undefined && input.assignedTo !== null) {
    const [users] = await db.execute<Array<{ id: string } & RowDataPacket>>(
      "SELECT id FROM users WHERE id = ?",
      [input.assignedTo],
    );
    if (!users[0]) throw new ApiError(404, "The selected assignee was not found.");
  }

  if (input.assignedTo === undefined) {
    await db.execute("UPDATE bc_follow_ups SET status = ? WHERE id = ?", [input.status, id]);
  } else {
    await db.execute(
      "UPDATE bc_follow_ups SET status = ?, assigned_to = ? WHERE id = ?",
      [input.status, input.assignedTo, id],
    );
  }
  const [rows] = await db.execute<FollowUpRow[]>(`${followUpSelect} WHERE bc_follow_ups.id = ?`, [id]);
  if (!rows[0]) throw new ApiError(404, "Follow-up was not found.");
  return toFollowUp(rows[0]);
}
