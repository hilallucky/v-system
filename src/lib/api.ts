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
  role: "admin" | "user";
  createdAt: string;
}

export interface ManagedUser extends UserProfile {
  isActive: boolean;
}

export interface ContentNotification {
  id: number;
  itemId: string;
  itemName: string;
  itemKind: "folder" | "file" | "link";
  parentId: string | null;
  createdAt: string;
  readAt: string | null;
}

export type FollowUpStatus = "open" | "in_progress" | "resolved";

export interface FollowUp {
  id: string;
  createdBy: string;
  creatorName: string;
  assignedTo: string | null;
  assigneeName: string | null;
  title: string;
  description: string;
  status: FollowUpStatus;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PlaybookForm =
  | "follow-up-checklist"
  | "monthly-target"
  | "activity-record-plan"
  | "customer-list"
  | "prospect-list"
  | "daily-tasks"
  | "monthly-side-volume";

export interface PlaybookCatalogs {
  products: { code: string; name: string; price: number }[];
  ranks: { code: string; name: string }[];
  statuses: { id: number; name: string }[];
}

export type PlaybookRecord = Record<string, unknown> & { id: number };

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

export function getFollowUps() {
  return request<FollowUp[]>("/api/v1/follow-ups");
}

export function createFollowUp(input: {
  title: string;
  description: string;
  dueDate: string | null;
}) {
  return request<FollowUp>("/api/v1/follow-ups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateFollowUp(id: string, status: FollowUpStatus) {
  return request<FollowUp>(`/api/v1/follow-ups/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export function getPlaybookCatalogs() {
  return request<PlaybookCatalogs>("/api/v1/playbooks/catalogs");
}

export function getPlaybookRecords(form: PlaybookForm) {
  return request<PlaybookRecord[]>(`/api/v1/playbooks/${form}`);
}

export function savePlaybookRecord(form: PlaybookForm, input: Record<string, unknown>) {
  return request<PlaybookRecord>(`/api/v1/playbooks/${form}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function deletePlaybookRecord(form: PlaybookForm, id: number) {
  return request<{ deleted: boolean }>(`/api/v1/playbooks/${form}/${id}`, {
    method: "DELETE",
  });
}

export function getContentNotifications() {
  return request<{ items: ContentNotification[]; unreadCount: number }>("/api/v1/notifications");
}

export function markContentNotificationRead(id: number) {
  return request<{ read: boolean }>(`/api/v1/notifications/${id}/read`, {
    method: "PATCH",
  });
}

export function getContentItem(id: string) {
  return request<ContentItem>(`/api/v1/items/${encodeURIComponent(id)}`);
}

export function getManagedUsers() {
  return request<ManagedUser[]>("/api/v1/admin/users");
}

export function createManagedUser(input: { fullName: string; email: string; password: string }) {
  return request<ManagedUser>("/api/v1/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function setManagedUserActive(id: string, isActive: boolean) {
  return request<{ id: string; isActive: boolean }>(
    `/api/v1/admin/users/${encodeURIComponent(id)}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    },
  );
}
