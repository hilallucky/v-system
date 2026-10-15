import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, ChevronRight, Download, LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AddLinkDialog } from "./components/add-link-dialog";
import { AuthPanel } from "./components/auth-panel";
import { AppSidebar, type WorkspacePage, type WorkspaceView } from "./components/app-sidebar";
import { FileList, FileListHeader, type Sort } from "./components/file-list";
import { FileToolbar } from "./components/file-toolbar";
import { WorkspaceHeader } from "./components/workspace-header";
import { WorkspaceStatsCards } from "./components/workspace-stats";
import { UserProfileDialog } from "./components/user-profile-dialog";
import { AdminDashboard } from "./features/admin/admin-dashboard";
import { FollowUpsPanel } from "./features/follow-ups/follow-ups-panel";
import { OfficeDocumentPreview } from "./features/content/office-document-preview";
import type { OfficePreviewFormat } from "./features/content/office-preview";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import { cn } from "./lib/utils";
import {
  createFolder,
  createLink,
  getCurrentUser,
  getFolderPath,
  getItems,
  getStats,
  logIn,
  logOut,
  signUp,
  uploadFile,
  type ContentItem,
} from "./lib/api";

type Layout = "list" | "grid";

function App() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<WorkspaceView>("all");
  const [page, setPage] = useState<WorkspacePage>("content");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [layout, setLayout] = useState<Layout>("list");
  const [folderName, setFolderName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<ContentItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const authQuery = useQuery({
    queryKey: ["current-user"],
    queryFn: getCurrentUser,
    retry: false,
  });
  const authMutation = useMutation({
    mutationFn: ({
      mode,
      credentials,
    }: {
      mode: "signup" | "login";
      credentials: { fullName: string; email: string; password: string };
    }) =>
      mode === "signup"
        ? signUp(credentials)
        : logIn({ email: credentials.email, password: credentials.password }),
    onSuccess: async user => {
      queryClient.setQueryData(["current-user"], user);
      await invalidateContent();
      notify("You’re signed in.");
    },
  });
  const logoutMutation = useMutation({
    mutationFn: logOut,
    onSuccess: () => {
      queryClient.setQueryData(["current-user"], null);
      for (const queryKey of [
        ["items"],
        ["departments"],
        ["folder-children"],
        ["stats"],
        ["folder-path"],
      ]) {
        queryClient.removeQueries({ queryKey });
      }
      notify("You’ve logged out.");
    },
    onError: error => notify(error.message, "error"),
  });

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(authQuery.data?.role === "admin" ? "admin" : "content");
  }, [authQuery.data?.id, authQuery.data?.role]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  function notify(text: string, kind: "success" | "error" = "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setNotice({ text, kind });
    toastTimer.current = setTimeout(() => setNotice(null), 3500);
  }

  const itemsQuery = useQuery({
    queryKey: ["items", folderId, view, search, sort],
    queryFn: () => getItems({ folderId, view, search, sort }),
    enabled: Boolean(authQuery.data),
  });
  const rootQuery = useQuery({
    queryKey: ["departments"],
    queryFn: () => getItems({ folderId: null, view: "all", search: "", sort: "name" }),
    enabled: Boolean(authQuery.data),
  });
  const statsQuery = useQuery({
    queryKey: ["stats"],
    queryFn: getStats,
    enabled: Boolean(authQuery.data),
  });
  const pathQuery = useQuery({
    queryKey: ["folder-path", folderId],
    queryFn: () => (folderId ? getFolderPath(folderId) : Promise.resolve([])),
    enabled: folderId !== null && Boolean(authQuery.data),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createFolder({ name, parentId: folderId }),
    onSuccess: () => {
      setDialogOpen(false);
      setFolderName("");
      void invalidateContent();
      notify("Folder created.");
    },
    onError: error => notify(error.message, "error"),
  });
  const addLinkMutation = useMutation({
    mutationFn: ({ url, name }: { url: string; name: string }) =>
      createLink({ url, name: name || undefined, parentId: folderId }),
    onSuccess: async () => {
      setLinkDialogOpen(false);
      await invalidateContent();
      notify("Link added.");
    },
  });

  const items = itemsQuery.data ?? [];
  const rootFolders = (rootQuery.data ?? []).filter(item => item.kind === "folder");
  const currentPath = pathQuery.data ?? [];
  const pageTitle = search
    ? "Search results"
    : folderId
      ? currentPath.at(-1)?.name ?? "Folder"
      : view === "all"
        ? "Contents"
        : view === "recent"
          ? "Recent"
          : view === "starred"
            ? "Starred"
            : "Shared with me";
  const isRoot = folderId === null && view === "all" && !search;

  if (authQuery.isPending) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas">
        <div className="flex items-center gap-2 text-xs text-muted" role="status">
          <LoaderCircle size={16} className="animate-spin" /> Loading your account…
        </div>
      </main>
    );
  }

  if (authQuery.isError) {
    return (
      <main className="grid min-h-screen place-items-center bg-canvas px-4">
        <Card className="max-w-md p-6 text-center">
          <AlertCircle size={22} className="mx-auto text-red-500" />
          <p className="mt-3 text-sm font-semibold text-slate-800">Couldn’t load your account</p>
          <p className="mt-1 text-xs text-muted">{authQuery.error.message}</p>
          <Button variant="outline" className="mt-4" onClick={() => void authQuery.refetch()}>
            Try again
          </Button>
        </Card>
      </main>
    );
  }

  if (!authQuery.data) {
    return (
      <AuthPanel
        isPending={authMutation.isPending}
        error={authMutation.isError ? authMutation.error.message : null}
        onSubmit={(mode, credentials) => authMutation.mutate({ mode, credentials })}
      />
    );
  }

  async function invalidateContent() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["items"] }),
      queryClient.invalidateQueries({ queryKey: ["departments"] }),
      queryClient.invalidateQueries({ queryKey: ["folder-children"] }),
      queryClient.invalidateQueries({ queryKey: ["stats"] }),
    ]);
  }

  async function handleUpload(files: File[]) {
    if (!files.length || isUploading) return;
    setIsUploading(true);
    const uploaded: string[] = [];
    const failed: string[] = [];
    try {
      for (const file of files) {
        try {
          await uploadFile(file, folderId);
          uploaded.push(file.name);
        } catch (error) {
          failed.push(`${file.name}: ${error instanceof Error ? error.message : "Upload failed."}`);
        }
      }
      if (uploaded.length) await invalidateContent();
      if (failed.length) {
        const failureSummary = failed.slice(0, 3).join("; ");
        const remaining = failed.length > 3 ? `; and ${failed.length - 3} more` : "";
        notify(
          `${uploaded.length} of ${files.length} files uploaded. Failed: ${failureSummary}${remaining}`,
          "error",
        );
      } else {
        notify(`${uploaded.length} ${uploaded.length === 1 ? "file" : "files"} uploaded.`);
      }
    } finally {
      setIsUploading(false);
    }
  }

  function goToView(nextView: WorkspaceView) {
    setPage("content");
    setView(nextView);
    setFolderId(null);
    setSearchInput("");
    setSearch("");
  }

  function openFolder(folder: ContentItem) {
    setPage("content");
    setFolderId(folder.id);
    setView("all");
    setSearchInput("");
    setSearch("");
  }

  function openItem(item: ContentItem) {
    if (item.kind === "folder") {
      openFolder(item);
      return;
    }
    if (item.kind === "link") {
      if (item.url && ["http:", "https:"].includes(new URL(item.url).protocol)) {
        window.open(item.url, "_blank", "noopener,noreferrer");
      } else {
        notify("This link does not have a valid website address.", "error");
      }
      return;
    }
    if (!item.hasContent) {
      notify("This sample document is metadata only. Upload a real file to download it.", "error");
      return;
    }
    setPreviewItem(item);
  }

  function downloadItem(item: ContentItem) {
    if (!item.hasContent) {
      notify("This sample document has no file content to download.", "error");
      return;
    }
    window.open(
      `/api/v1/files/${encodeURIComponent(item.id)}/download`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function officePreviewFormat(item: ContentItem): OfficePreviewFormat | null {
    const extension = item.name.split(".").pop()?.toLowerCase();
    if (extension === "docx" || extension === "xlsx" || extension === "pptx") {
      return extension;
    }
    return null;
  }

  const previewFormat = previewItem ? officePreviewFormat(previewItem) : null;

  return (
    <div className="min-h-screen bg-canvas">
      <WorkspaceHeader
        search={searchInput}
        onSearchChange={setSearchInput}
        onHelp={() => notify("Search or choose a department to find bank content.")}
        onNotifications={() => notify("You’re all caught up.")}
        user={authQuery.data}
        isLoggingOut={logoutMutation.isPending}
        onProfile={() => setProfileOpen(true)}
        onLogout={() => logoutMutation.mutate()}
      />

      <div className="flex min-h-[calc(100vh-4rem)]">
        <AppSidebar
          view={view}
          page={page}
          isAdmin={authQuery.data.role === "admin"}
          folderId={folderId}
          folderPathIds={currentPath.map(entry => entry.id)}
          rootFolders={rootFolders}
          stats={statsQuery.data}
          departmentsError={rootQuery.isError ? rootQuery.error.message : undefined}
          onRetryDepartments={() => void rootQuery.refetch()}
          onSelectView={goToView}
          onSelectPage={nextPage => {
            setPage(nextPage);
            setSearch("");
            setSearchInput("");
          }}
          onSelectFolder={openFolder}
        />

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-7 lg:px-9">
          {page === "follow-ups" ? (
            <FollowUpsPanel user={authQuery.data} />
          ) : page === "admin" && authQuery.data.role === "admin" ? (
            <AdminDashboard
              user={authQuery.data}
              stats={statsQuery.data}
              statsError={statsQuery.isError ? statsQuery.error.message : undefined}
              onRetryStats={() => void statsQuery.refetch()}
              onOpenPage={nextPage => {
                setPage(nextPage);
                if (nextPage === "content") goToView("all");
              }}
            />
          ) : (
          <div className="mx-auto max-w-[1280px]">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1 text-[10px] text-muted">
                  {search
                    ? "Workspace / Search"
                    : folderId
                      ? pathQuery.isError
                        ? "Workspace / Folder"
                        : `Departments / ${currentPath.map(entry => entry.name).join(" / ")}`
                      : view === "all"
                        ? "Workspace / Files"
                        : `Workspace / ${pageTitle}`}
                </div>
                <h1 className="truncate text-[22px] font-semibold tracking-[-0.5px] text-slate-800">
                  {pageTitle}
                </h1>
                <p className="mt-1 hidden text-[11px] text-muted sm:block">
                  {search
                    ? `Files and folders matching “${search}”.`
                    : folderId
                      ? "Documents and resources for this team."
                      : view === "all"
                        ? "Your secure home for content bank documents and resources."
                        : `Your ${pageTitle.toLowerCase()} files, all in one place.`}
                </p>
              </div>
              {authQuery.data.role === "admin" && <Dialog
                open={dialogOpen}
                onOpenChange={open => {
                  setDialogOpen(open);
                  if (!open) setFolderName("");
                }}
              >
                <DialogTrigger asChild>
                  <Button className="shrink-0">
                    <span aria-hidden="true">+</span> New folder
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogTitle className="text-base font-semibold text-slate-800">
                    Create a folder
                  </DialogTitle>
                  <DialogDescription className="mb-4 mt-1.5 text-xs text-muted">
                    Add a folder to {pageTitle}.
                  </DialogDescription>
                  <form
                    onSubmit={event => {
                      event.preventDefault();
                      const name = folderName.trim();
                      if (name) createMutation.mutate(name);
                    }}
                  >
                    <Input
                      autoFocus
                      maxLength={80}
                      required
                      value={folderName}
                      onChange={event => setFolderName(event.target.value)}
                      placeholder="e.g. Customer statements"
                      aria-label="Folder name"
                    />
                    {createMutation.isError && (
                      <p className="mt-2 text-[11px] text-red-600">{createMutation.error.message}</p>
                    )}
                    <div className="mt-5 flex justify-end gap-2">
                      <DialogClose asChild>
                        <Button variant="outline" type="button" disabled={createMutation.isPending}>
                          Cancel
                        </Button>
                      </DialogClose>
                      <Button type="submit" disabled={!folderName.trim() || createMutation.isPending}>
                        {createMutation.isPending && (
                          <LoaderCircle size={14} className="animate-spin" />
                        )}
                        Create folder
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>}
            </div>

            {authQuery.data.role === "admin" && <FileToolbar
              sort={sort}
              layout={layout}
              onSortChange={setSort}
              onLayoutChange={() => setLayout(current => (current === "list" ? "grid" : "list"))}
              isUploading={isUploading}
              onUpload={files => void handleUpload(files)}
              onAddLink={() => {
                addLinkMutation.reset();
                setLinkDialogOpen(true);
              }}
            />}

            <label className="relative mb-4 flex items-center sm:hidden">
              <Search size={15} className="absolute left-3 text-slate-400" />
              <Input
                value={searchInput}
                onChange={event => setSearchInput(event.target.value)}
                placeholder="Search files and folders"
                className="pl-9"
                aria-label="Search files and folders"
              />
            </label>

            <nav
              className="mb-3 flex min-h-6 items-center gap-1.5 overflow-hidden text-[10px]"
              aria-label="Breadcrumb"
            >
              <button
                type="button"
                onClick={() => goToView("all")}
                className={cn(
                  "truncate hover:text-blue-700",
                  !folderId && "font-semibold text-slate-800",
                )}
              >
                Contents
              </button>
              {currentPath.map((entry, index) => (
                <span className="flex min-w-0 items-center gap-1.5" key={entry.id}>
                  <ChevronRight size={12} className="shrink-0 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => {
                      setFolderId(entry.id);
                      setView("all");
                      setSearch("");
                      setSearchInput("");
                    }}
                    className={cn(
                      "truncate hover:text-blue-700",
                      index === currentPath.length - 1 && "font-semibold text-slate-800",
                    )}
                  >
                    {entry.name}
                  </button>
                </span>
              ))}
              {pathQuery.isError && (
                <span className="ml-2 inline-flex items-center gap-2 text-red-600" role="alert">
                  <AlertCircle size={13} />
                  {pathQuery.error.message}
                  <button type="button" className="underline" onClick={() => void pathQuery.refetch()}>
                    Retry
                  </button>
                </span>
              )}
            </nav>

            {isRoot && (
              <WorkspaceStatsCards
                stats={statsQuery.data}
                error={statsQuery.isError ? statsQuery.error.message : undefined}
                onRetry={() => void statsQuery.refetch()}
              />
            )}

            <Card className="overflow-hidden">
              <FileListHeader
                title={search ? "Search results" : isRoot ? "All files" : pageTitle}
                count={items.length}
                isFetching={itemsQuery.isFetching && !itemsQuery.isPending}
              />
              <FileList
                items={items}
                layout={layout}
                search={search}
                isPending={itemsQuery.isPending}
                error={itemsQuery.isError ? itemsQuery.error : null}
                onRetry={() => void itemsQuery.refetch()}
                onOpen={openItem}
                onDownload={downloadItem}
              />
            </Card>
            <div className="flex justify-between px-1 pt-3 text-[9px] text-slate-400">
              <span>
                {items.length} {items.length === 1 ? "item" : "items"}
              </span>
              {/* <span>Secure workspace · API connected</span> */}
            </div>
          </div>
          )}
        </main>
      </div>

      <UserProfileDialog
        user={authQuery.data}
        open={profileOpen}
        onOpenChange={setProfileOpen}
      />

      <AddLinkDialog
        open={linkDialogOpen}
        isPending={addLinkMutation.isPending}
        error={addLinkMutation.isError ? addLinkMutation.error.message : null}
        onOpenChange={setLinkDialogOpen}
        onSubmit={(url, name) => addLinkMutation.mutate({ url, name })}
      />

      <Dialog
        open={previewItem !== null}
        onOpenChange={open => {
          if (!open) setPreviewItem(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="truncate text-base font-semibold text-slate-800">
                {previewItem?.name}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs text-muted">
                {previewItem && `${previewItem.owner} · ${previewItem.modifiedAt.slice(0, 10)}`}
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Close preview">
                <X size={16} />
              </Button>
            </DialogClose>
          </div>

          {previewItem && (
            <div className="mt-4 flex min-h-[min(65vh,640px)] items-center justify-center overflow-hidden rounded-lg border border-border bg-slate-50">
              {previewItem.mimeType === "application/pdf" ? (
                <iframe
                  title={`Preview of ${previewItem.name}`}
                  src={`/api/v1/files/${encodeURIComponent(previewItem.id)}/preview`}
                  className="h-[min(65vh,640px)] w-full bg-white"
                />
              ) : previewItem.mimeType?.startsWith("image/") ? (
                <img
                  src={`/api/v1/files/${encodeURIComponent(previewItem.id)}/preview`}
                  alt={previewItem.name}
                  className="max-h-[min(65vh,640px)] max-w-full object-contain"
                />
              ) : previewItem.mimeType === "text/csv" ? (
                <iframe
                  title={`Preview of ${previewItem.name}`}
                  src={`/api/v1/files/${encodeURIComponent(previewItem.id)}/preview`}
                  className="h-[min(65vh,640px)] w-full bg-white p-4"
                />
              ) : previewFormat ? (
                <OfficeDocumentPreview
                  fileId={previewItem.id}
                  format={previewFormat}
                />
              ) : (
                <div className="max-w-md px-6 py-12 text-center">
                  <p className="text-sm font-medium text-slate-700">Preview isn’t available for this file type.</p>
                  <p className="mt-2 text-xs text-muted">
                    Download the file to open it in a compatible application.
                  </p>
                </div>
              )}
            </div>
          )}

          {previewItem && (
            <div className="mt-4 flex justify-end">
              <Button asChild>
                <a href={`/api/v1/files/${encodeURIComponent(previewItem.id)}/download`}>
                  <Download size={14} /> Download
                </a>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {notice && (
        <div
          className={cn(
            "fixed bottom-5 right-5 z-50 flex max-w-[min(440px,calc(100vw-2.5rem))] items-center gap-2 rounded-lg bg-slate-800 px-4 py-3 text-xs text-white shadow-xl",
            notice.kind === "error" && "bg-red-700",
          )}
          role="status"
          aria-live="polite"
        >
          {notice.kind === "success" ? <Check size={15} /> : <AlertCircle size={15} />}
          <span className="break-words">{notice.text}</span>
        </div>
      )}
    </div>
  );
}

export default App;
