export type ItemKind = "folder" | "file" | "link";

export interface ContentItem {
  id: string;
  parentId: string | null;
  name: string;
  kind: ItemKind;
  mimeType: string | null;
  size: number | null;
  modifiedAt: string;
  owner: string;
  status: "Approved" | "In review" | "Ready";
  starred: boolean;
  shared: boolean;
  childCount?: number;
  childFolderCount?: number;
  url: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  hasContent: boolean;
}

export interface WorkspaceStats {
  folders: number;
  documents: number;
  needsReview: number;
  storageUsed: number;
  storageLimit: number;
}

export interface FolderPathEntry {
  id: string;
  name: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
}

interface ApiEnvelope<T> {
  data: T;
}

interface ApiErrorEnvelope {
  error?: {
    message?: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "same-origin" });
  const body = (await response.json().catch(() => null)) as
    | ApiEnvelope<T>
    | ApiErrorEnvelope
    | null;

  if (!response.ok) {
    const errorBody = body as ApiErrorEnvelope | null;
    throw new ApiError(
      errorBody?.error?.message ?? `Request failed (${response.status})`,
      response.status,
      errorBody?.error?.details,
    );
  }

  if (!body || !("data" in body)) {
    throw new ApiError("The server returned an invalid response.", response.status);
  }

  return body.data;
}

export async function getCurrentUser() {
  try {
    return await request<UserProfile>("/api/v1/auth/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function signUp(input: { fullName: string; email: string; password: string }) {
  return request<UserProfile>("/api/v1/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function logIn(input: { email: string; password: string }) {
  return request<UserProfile>("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function logOut() {
  return request<{ status: string }>("/api/v1/auth/logout", { method: "POST" });
}

export function updateUserProfile(input: { fullName: string; email: string }) {
  return request<UserProfile>("/api/v1/auth/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function getItems(params: {
  folderId: string | null;
  view: "all" | "recent" | "starred" | "shared";
  search: string;
  sort: "name" | "modified" | "type";
}) {
  const query = new URLSearchParams({
    view: params.view,
    sort: params.sort,
  });
  if (params.search) query.set("search", params.search);
  if (!params.search) query.set("folderId", params.folderId ?? "root");

  return request<ContentItem[]>(`/api/v1/items?${query.toString()}`);
}

export function getStats() {
  return request<WorkspaceStats>("/api/v1/stats");
}

export function getFolderPath(folderId: string) {
  return request<FolderPathEntry[]>(`/api/v1/folders/${encodeURIComponent(folderId)}/path`);
}

export function createFolder(input: { name: string; parentId: string | null }) {
  return request<ContentItem>("/api/v1/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function createLink(input: { url: string; name?: string; parentId: string | null }) {
  return request<ContentItem>("/api/v1/links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function uploadFile(file: File, parentId: string | null) {
  const body = new FormData();
  body.set("file", file);
  if (parentId) body.set("parentId", parentId);
  return request<ContentItem>("/api/v1/files", { method: "POST", body });
}
