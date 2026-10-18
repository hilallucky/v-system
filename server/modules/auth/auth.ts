import { randomBytes, randomUUID, scrypt as scryptCallback, createHash, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Request, Response, NextFunction } from "express";
import type { RowDataPacket } from "mysql2/promise";
import { database } from "../../database.js";
import { ApiError } from "../../types.js";
import type { AppRole } from "./permissions.js";

const scrypt = promisify(scryptCallback);
const sessionCookieName = "v_system_session";
const sessionLifetimeSeconds = 60 * 60 * 24 * 7;

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
  createdAt: string;
}

interface UserRow extends RowDataPacket {
  id: string;
  full_name: string;
  email: string;
  role: AppRole;
  password_hash?: string;
  password_salt?: string;
  created_at: Date | string;
  is_active?: number;
}

declare global {
  namespace Express {
    interface Locals {
      user: UserProfile;
    }
  }
}

function toProfile(row: UserRow): UserProfile {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function cookieOptions() {
  return `Path=/api/v1; HttpOnly; SameSite=Strict${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

function readSessionToken(request: Request) {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(`${sessionCookieName}=`));
  const token = cookie?.slice(sessionCookieName.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isDuplicateEntry(error: unknown) {
  return typeof error === "object" && error !== null && Reflect.get(error, "code") === "ER_DUP_ENTRY";
}

function setSessionCookie(response: Response, token: string) {
  response.append(
    "Set-Cookie",
    `${sessionCookieName}=${token}; ${cookieOptions()}; Max-Age=${sessionLifetimeSeconds}`,
  );
}

function clearSessionCookie(response: Response) {
  response.append(
    "Set-Cookie",
    `${sessionCookieName}=; ${cookieOptions()}; Max-Age=0`,
  );
}

async function createSession(userId: string, response: Response) {
  const token = randomBytes(32).toString("hex");
  const db = await database;
  await db.execute("DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP()");
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<Array<RowDataPacket & { is_active: number }>>(
      "SELECT is_active FROM users WHERE id = ? FOR UPDATE",
      [userId],
    );
    if (!rows[0]?.is_active) {
      throw new ApiError(403, "This account has been disabled. Contact an administrator.");
    }
    await connection.execute(
      "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND))",
      [hashToken(token), userId, sessionLifetimeSeconds],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  setSessionCookie(response, token);
}

async function derivePassword(password: string, salt: string) {
  return (await scrypt(password, salt, 64)) as Buffer;
}

export async function signUp(
  input: { fullName: string; email: string; password: string },
  response: Response,
) {
  const db = await database;
  const id = randomUUID();
  const salt = randomBytes(16).toString("hex");
  const passwordHash = (await derivePassword(input.password, salt)).toString("hex");

  try {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        "INSERT INTO users (id, full_name, email, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)",
        [id, input.fullName, input.email, passwordHash, salt],
      );
      await connection.execute(
        "INSERT INTO user_roles (user_id, role) VALUES (?, 'user')",
        [id],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    if (isDuplicateEntry(error)) {
      throw new ApiError(409, "An account with that email already exists.");
    }
    throw error;
  }

  await createSession(id, response);
  return {
    id,
    fullName: input.fullName,
    email: input.email,
    role: "user" as const,
    createdAt: new Date().toISOString(),
  };
}

export async function logIn(input: { email: string; password: string }, response: Response) {
  const db = await database;
  const [rows] = await db.execute<UserRow[]>(
    `SELECT users.id, users.full_name, users.email,
       user_roles.role, users.password_hash, users.password_salt, users.is_active,
       users.created_at
     FROM users
     JOIN user_roles ON user_roles.user_id = users.id
     WHERE users.email = ?`,
    [input.email],
  );
  const user = rows[0];
  if (!user?.password_hash || !user.password_salt) {
    await derivePassword(input.password, "00000000000000000000000000000000");
    throw new ApiError(401, "Email or password is incorrect.");
  }

  const actual = await derivePassword(input.password, user.password_salt);
  const expected = Buffer.from(user.password_hash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new ApiError(401, "Email or password is incorrect.");
  }
  if (!user.is_active) throw new ApiError(403, "This account has been disabled. Contact an administrator.");

  await createSession(user.id, response);
  return toProfile(user);
}

export async function getAuthenticatedUser(request: Request) {
  const token = readSessionToken(request);
  if (!token) throw new ApiError(401, "Please log in to continue.");

  const db = await database;
  const [rows] = await db.execute<UserRow[]>(
    `SELECT users.id, users.full_name, users.email,
       user_roles.role, users.created_at, users.is_active
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     JOIN user_roles ON user_roles.user_id = users.id
     WHERE sessions.token_hash = ? AND sessions.expires_at > UTC_TIMESTAMP()
       AND users.is_active = 1`,
    [hashToken(token)],
  );
  if (!rows[0]) throw new ApiError(401, "Your session has expired. Please log in again.");
  return toProfile(rows[0]);
}

export function requireAdmin(
  _request: Request,
  response: Response,
  next: NextFunction,
) {
  if (response.locals.user.role !== "admin") {
    next(new ApiError(403, "Administrator access is required."));
    return;
  }
  next();
}

export async function authenticateSession(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  try {
    response.locals.user = await getAuthenticatedUser(request);
    next();
  } catch (error) {
    next(error);
  }
}

export async function logOut(request: Request, response: Response) {
  const token = readSessionToken(request);
  if (token) {
    const db = await database;
    await db.execute("DELETE FROM sessions WHERE token_hash = ?", [hashToken(token)]);
  }
  clearSessionCookie(response);
}

export async function updateProfile(
  userId: string,
  input: { fullName: string; email: string },
) {
  const db = await database;
  try {
    await db.execute("UPDATE users SET full_name = ?, email = ? WHERE id = ?", [
      input.fullName,
      input.email,
      userId,
    ]);
  } catch (error) {
    if (isDuplicateEntry(error)) {
      throw new ApiError(409, "An account with that email already exists.");
    }
    throw error;
  }
  const [rows] = await db.execute<UserRow[]>(
    `SELECT users.id, users.full_name, users.email,
       user_roles.role, users.created_at, users.is_active
     FROM users
     JOIN user_roles ON user_roles.user_id = users.id
     WHERE users.id = ?`,
    [userId],
  );
  if (!rows[0]) throw new ApiError(404, "User profile was not found.");
  return toProfile(rows[0]);
}

export async function listManagedUsers() {
  const db = await database;
  const [rows] = await db.execute<Array<UserRow & { is_active: number }>>(
    `SELECT users.id, users.full_name, users.email, user_roles.role,
      users.created_at, users.is_active
     FROM users
     JOIN user_roles ON user_roles.user_id = users.id
     ORDER BY users.full_name, users.email`,
  );
  return rows.map(row => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    createdAt: new Date(row.created_at).toISOString(),
    isActive: Boolean(row.is_active),
  }));
}

export async function createManagedUser(input: {
  fullName: string;
  email: string;
  password: string;
  role: AppRole;
}) {
  const db = await database;
  const id = randomUUID();
  const salt = randomBytes(16).toString("hex");
  const passwordHash = (await derivePassword(input.password, salt)).toString("hex");
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      "INSERT INTO users (id, full_name, email, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)",
      [id, input.fullName, input.email, passwordHash, salt],
    );
    await connection.execute(
      "INSERT INTO user_roles (user_id, role) VALUES (?, ?)",
      [id, input.role],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (isDuplicateEntry(error)) {
      throw new ApiError(409, "An account with that email already exists.");
    }
    throw error;
  } finally {
    connection.release();
  }
  return {
    id,
    fullName: input.fullName,
    email: input.email,
    role: input.role,
    createdAt: new Date().toISOString(),
    isActive: true,
  };
}

export async function updateManagedUser(
  id: string,
  input: { fullName: string; email: string; role: AppRole },
  actor: { id: string; role: AppRole },
) {
  if (id === actor.id && input.role !== actor.role) {
    throw new ApiError(400, "You cannot change your own account role.");
  }
  if (actor.role === "supervisor" && !["user", "member"].includes(input.role)) {
    throw new ApiError(403, "Supervisors can only assign User or Member roles.");
  }
  const db = await database;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [userRows] = await connection.execute<Array<RowDataPacket & { id: string; role: AppRole }>>(
      `SELECT users.id, user_roles.role FROM users
       JOIN user_roles ON user_roles.user_id = users.id
       WHERE users.id = ? FOR UPDATE`,
      [id],
    );
    const target = userRows[0];
    if (!target) throw new ApiError(404, "User was not found.");
    if (actor.role === "supervisor" && !["user", "member"].includes(target.role)) {
      throw new ApiError(403, "Supervisors can only edit User and Member accounts.");
    }
    await connection.execute(
      "UPDATE users SET full_name = ?, email = ? WHERE id = ?",
      [input.fullName, input.email, id],
    );
    if (target.role !== input.role) {
      if (target.role === "admin" || input.role === "admin") {
        const [adminRows] = await connection.execute<Array<RowDataPacket & { id: string }>>(
          `SELECT users.id FROM users
           JOIN user_roles ON user_roles.user_id = users.id
           WHERE users.is_active = 1 AND user_roles.role = 'admin'
           FOR UPDATE`,
        );
        if (adminRows.length <= 1) {
          throw new ApiError(400, "The last active administrator cannot be demoted.");
        }
      }
      await connection.execute("UPDATE user_roles SET role = ? WHERE user_id = ?", [input.role, id]);
      await connection.execute("DELETE FROM sessions WHERE user_id = ?", [id]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (isDuplicateEntry(error)) {
      throw new ApiError(409, "An account with that email already exists.");
    }
    throw error;
  } finally {
    connection.release();
  }
  return { id, ...input };
}

export async function setManagedUserActive(
  id: string,
  isActive: boolean,
  actor: { id: string; role: AppRole },
) {
  if (id === actor.id && !isActive) {
    throw new ApiError(400, "You cannot disable your own account.");
  }
  const db = await database;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [targetRows] = await connection.execute<Array<RowDataPacket & { id: string; role: AppRole }>>(
      `SELECT users.id, user_roles.role FROM users
       JOIN user_roles ON user_roles.user_id = users.id
       WHERE users.id = ? FOR UPDATE`,
      [id],
    );
    const target = targetRows[0];
    if (!target) throw new ApiError(404, "User was not found.");
    if (actor.role === "supervisor" && !["user", "member"].includes(target.role)) {
      throw new ApiError(403, "Supervisors can only manage access for User and Member accounts.");
    }
    if (!isActive && target.role === "admin") {
      const [adminRows] = await connection.execute<Array<RowDataPacket & { id: string }>>(
        `SELECT users.id FROM users
         JOIN user_roles ON user_roles.user_id = users.id
         WHERE users.is_active = 1 AND user_roles.role = 'admin'
         FOR UPDATE`,
      );
      if (adminRows.length <= 1) {
        throw new ApiError(400, "The last active administrator cannot be disabled.");
      }
    }
    await connection.execute("UPDATE users SET is_active = ? WHERE id = ?", [isActive, id]);
    if (!isActive) await connection.execute("DELETE FROM sessions WHERE user_id = ?", [id]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return { id, isActive };
}
