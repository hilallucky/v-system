import { randomBytes, randomUUID, scrypt as scryptCallback, createHash, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Request, Response, NextFunction } from "express";
import type { RowDataPacket } from "mysql2/promise";
import { database } from "./database.js";
import { ApiError } from "./types.js";

const scrypt = promisify(scryptCallback);
const sessionCookieName = "bank_content_session";
const sessionLifetimeSeconds = 60 * 60 * 24 * 7;

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
}

interface UserRow extends RowDataPacket {
  id: string;
  full_name: string;
  email: string;
  password_hash?: string;
  password_salt?: string;
  created_at: Date | string;
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
  await db.execute(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND))",
    [hashToken(token), userId, sessionLifetimeSeconds],
  );
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
    await db.execute(
      "INSERT INTO users (id, full_name, email, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)",
      [id, input.fullName, input.email, passwordHash, salt],
    );
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
    createdAt: new Date().toISOString(),
  };
}

export async function logIn(input: { email: string; password: string }, response: Response) {
  const db = await database;
  const [rows] = await db.execute<UserRow[]>(
    "SELECT id, full_name, email, password_hash, password_salt, created_at FROM users WHERE email = ?",
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

  await createSession(user.id, response);
  return toProfile(user);
}

export async function getAuthenticatedUser(request: Request) {
  const token = readSessionToken(request);
  if (!token) throw new ApiError(401, "Please log in to continue.");

  const db = await database;
  const [rows] = await db.execute<UserRow[]>(
    `SELECT users.id, users.full_name, users.email, users.created_at
     FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > UTC_TIMESTAMP()`,
    [hashToken(token)],
  );
  if (!rows[0]) throw new ApiError(401, "Your session has expired. Please log in again.");
  return toProfile(rows[0]);
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
    "SELECT id, full_name, email, created_at FROM users WHERE id = ?",
    [userId],
  );
  if (!rows[0]) throw new ApiError(404, "User profile was not found.");
  return toProfile(rows[0]);
}
