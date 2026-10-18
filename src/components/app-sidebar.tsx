import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock3,
  Database,
  FolderClosed,
  FolderOpen,
  FileText,
  FolderTree,
  LoaderCircle,
  X,
  Shield,
  Star,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AppRole, ContentItem, MenuKey, MenuPermissions, WorkspaceStats } from "../lib/api";
import { getItems } from "../lib/api";
import { cn } from "../lib/utils";

export type WorkspaceView = "all" | "recent" | "starred" | "shared";
export type PlaybookPage =
  | "follow-up-checklist"
  | "monthly-target"
  | "activity-record-plan"
  | "customer-list"
  | "prospect-list"
  | "daily-tasks"
  | "monthly-side-volume";
export type WorkspacePage = "content" | "admin" | "user-management" | "role-management" | PlaybookPage;

const playbookPages: { name: string; value: PlaybookPage }[] = [
  { name: "Follow Up Checklist", value: "follow-up-checklist" },
  { name: "Monthly Target", value: "monthly-target" },
  { name: "Activity Record & Plan", value: "activity-record-plan" },
  { name: "Customer List", value: "customer-list" },
  { name: "Prospect List", value: "prospect-list" },
  { name: "7 Daily Tasks", value: "daily-tasks" },
  { name: "Monthly Side Volume Target", value: "monthly-side-volume" },
];

export function isPlaybookPage(page: WorkspacePage): page is PlaybookPage {
  return playbookPages.some(entry => entry.value === page);
}

const bankViews: { name: string; value: WorkspaceView; icon: LucideIcon }[] = [
  { name: "Contents", value: "all", icon: FolderClosed },
  { name: "Recent", value: "recent", icon: Clock3 },
];
const personalViews: { name: string; value: WorkspaceView; icon: LucideIcon }[] = [
  { name: "Starred", value: "starred", icon: Star },
  { name: "Shared with me", value: "shared", icon: UsersRound },
];

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AppSidebarProps {
  view: WorkspaceView;
  page: WorkspacePage;
  role: AppRole;
  permissions: MenuPermissions[];
  mobileOpen: boolean;
  desktopVisible: boolean;
  onCloseMobile: () => void;
  folderId: string | null;
  folderPathIds: string[];
  rootFolders: ContentItem[];
  stats?: WorkspaceStats;
  departmentsError?: string;
  onRetryDepartments: () => void;
  onSelectView: (view: WorkspaceView) => void;
  onSelectPage: (page: WorkspacePage) => void;
  onSelectFolder: (folder: ContentItem) => void;
}

export function AppSidebar({
  view,
  page,
  role,
  permissions,
  mobileOpen,
  desktopVisible,
  onCloseMobile,
  folderId,
  folderPathIds,
  rootFolders,
  stats,
  departmentsError,
  onRetryDepartments,
  onSelectView,
  onSelectPage,
  onSelectFolder,
}: AppSidebarProps) {
  const canView = (menuKey: MenuKey) =>
    role === "admin" || Boolean(permissions.find(permission => permission.menuKey === menuKey)?.view);
  const hasAdministratorMenu = canView("admin-dashboard") || canView("user-management") ||
    role === "admin" && canView("role-management");
  const hasPlaybookMenu = playbookPages.some(entry => canView(entry.value));
  const hasBankContentMenu = ["contents", "folders", "recent", "starred", "shared"].some(key =>
    canView(key as MenuKey),
  );
  const selectView = (nextView: WorkspaceView) => {
    onSelectView(nextView);
    onCloseMobile();
  };
  const selectPage = (nextPage: WorkspacePage) => {
    onSelectPage(nextPage);
    onCloseMobile();
  };
  const selectFolder = (folder: ContentItem) => {
    onSelectFolder(folder);
    onCloseMobile();
  };
  const folderPathKey = folderPathIds.join("/");
  const [administratorExpanded, setAdministratorExpanded] = useState(
    page === "admin" || page === "user-management" || page === "role-management",
  );
  const [playbooksExpanded, setPlaybooksExpanded] = useState(isPlaybookPage(page));
  const [bankContentExpanded, setBankContentExpanded] = useState(page === "content");
  const [foldersExpanded, setFoldersExpanded] = useState(folderId !== null);

  useEffect(() => {
    if (page === "admin" || page === "user-management" || page === "role-management") setAdministratorExpanded(true);
    if (isPlaybookPage(page)) setPlaybooksExpanded(true);
    if (page === "content") setBankContentExpanded(true);
  }, [page]);

  useEffect(() => {
    if (folderId) setFoldersExpanded(true);
  }, [folderId]);

  useEffect(() => {
    if (!mobileOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseMobile();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen, onCloseMobile]);

  function groupButton(
    label: string,
    icon: LucideIcon,
    expanded: boolean,
    onToggle: () => void,
    active: boolean,
  ) {
    const Icon = icon;
    return (
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className={cn(
          "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[11px] text-slate-600 transition-colors hover:bg-[#f5eff8] hover:text-[#754691]",
          active && "font-semibold text-[#4A2260]",
        )}
      >
        <Icon size={15} /> {label}
        {expanded ? <ChevronDown size={13} className="ml-auto" /> : <ChevronRight size={13} className="ml-auto" />}
      </button>
    );
  }

  const sidebarContent = (
    <>
      <nav className="space-y-0.5" aria-label="Applications">
        {hasAdministratorMenu && (
          <>
            {groupButton(
              "Administrator",
              Shield,
              administratorExpanded,
              () => setAdministratorExpanded(value => !value),
              page === "admin" || page === "user-management" || page === "role-management",
            )}
            {administratorExpanded && (
              <div className="ml-3 border-l border-border pl-2">
                {canView("admin-dashboard") && <button
                  type="button"
                  onClick={() => selectPage("admin")}
                  className={cn(
                    "flex min-h-8 w-full items-center rounded-md px-2.5 py-1.5 text-left text-[10px] text-slate-600 transition-colors hover:bg-[#f5eff8] hover:text-[#754691]",
                    page === "admin" && "bg-[#f5eff8] font-semibold text-[#4A2260]",
                  )}
                >
                  Admin overview
                </button>}
                {canView("user-management") && <button
                  type="button"
                  onClick={() => selectPage("user-management")}
                  className={cn(
                    "flex min-h-8 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[10px] text-slate-600 transition-colors hover:bg-[#f5eff8] hover:text-[#754691]",
                    page === "user-management" && "bg-[#f5eff8] font-semibold text-[#4A2260]",
                  )}
                >
                  <UsersRound size={13} /> User Management
                </button>}
                {role === "admin" && canView("role-management") && <button
                  type="button"
                  onClick={() => selectPage("role-management")}
                  className={cn(
                    "flex min-h-8 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[10px] text-slate-600 transition-colors hover:bg-[#f5eff8] hover:text-[#754691]",
                    page === "role-management" && "bg-[#f5eff8] font-semibold text-[#4A2260]",
                  )}
                >
                  Role Management
                </button>}
              </div>
            )}
          </>
        )}
        {hasPlaybookMenu && groupButton("Playbooks", FileText, playbooksExpanded, () => setPlaybooksExpanded(value => !value), isPlaybookPage(page))}
        {hasPlaybookMenu && playbooksExpanded && (
          <div className="ml-3 border-l border-border pl-2">
            {playbookPages.filter(entry => canView(entry.value)).map(entry => (
              <button
                key={entry.value}
                type="button"
                onClick={() => selectPage(entry.value)}
                className={cn(
                  "flex min-h-8 w-full items-center rounded-md px-2.5 py-1.5 text-left text-[10px] text-slate-600 transition-colors hover:bg-[#f5eff8] hover:text-[#754691]",
                  page === entry.value && "bg-[#f5eff8] font-semibold text-[#4A2260]",
                )}
              >
                {entry.name}
              </button>
            ))}
          </div>
        )}
        {hasBankContentMenu && groupButton(
          "Bank Content",
          Database,
          bankContentExpanded,
          () => setBankContentExpanded(value => !value),
          page === "content",
        )}
        {hasBankContentMenu && bankContentExpanded && (
          <div className="ml-3 border-l border-border pl-2">
            {bankViews.filter(entry => entry.value === "all" && canView("contents")).map(entry => {
              const Icon = entry.icon;
              const selected = page === "content" && folderId === null && view === entry.value;
              return (
                <button
                  key={entry.value}
                  type="button"
                  onClick={() => selectView(entry.value)}
                  className={cn(
                    "flex min-h-8 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[10px] text-slate-600 transition-colors hover:bg-[#f5eff8] hover:text-[#754691]",
                    selected && "bg-[#f5eff8] font-semibold text-[#4A2260]",
                  )}
                >
                  <Icon size={13} /> {entry.name}
                </button>
              );
            })}
            {canView("folders") && <button
              type="button"
              aria-expanded={foldersExpanded}
              onClick={() => setFoldersExpanded(value => !value)}
              className={cn(
                "flex min-h-8 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[10px] text-slate-600 transition-colors hover:bg-[#f5eff8] hover:text-[#754691]",
                page === "content" && folderId !== null && "font-semibold text-[#4A2260]",
              )}
            >
              {foldersExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <FolderTree size={13} /> Folders
            </button>}
            {canView("folders") && foldersExpanded && (
              <nav className="space-y-0.5" aria-label="Folders" role="tree">
                {rootFolders.map(folder => (
                  <FolderTreeNode
                    key={folder.id}
                    folder={folder}
                    depth={0}
                    folderId={folderId}
                    folderPathKey={folderPathKey}
                    onSelectFolder={selectFolder}
                  />
                ))}
                {!rootFolders.length && !departmentsError && (
                  <p className="px-2.5 py-2 text-[10px] text-muted">No folders yet.</p>
                )}
              </nav>
            )}
            {bankViews.filter(entry => entry.value === "recent" && canView("recent")).map(entry => {
              const Icon = entry.icon;
              const selected = page === "content" && folderId === null && view === entry.value;
              return (
                <button
                  key={entry.value}
                  type="button"
                  onClick={() => selectView(entry.value)}
                  className={cn(
                    "flex min-h-8 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[10px] text-slate-600 transition-colors hover:bg-[#f5eff8] hover:text-[#754691]",
                    selected && "bg-[#f5eff8] font-semibold text-[#4A2260]",
                  )}
                >
                  <Icon size={13} /> {entry.name}
                </button>
              );
            })}
            {personalViews.filter(entry => canView(entry.value === "starred" ? "starred" : "shared")).map(entry => {
              const Icon = entry.icon;
              const selected = page === "content" && folderId === null && view === entry.value;
              return (
                <button
                  key={entry.value}
                  type="button"
                  onClick={() => selectView(entry.value)}
                  className={cn(
                    "flex min-h-8 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[10px] text-slate-600 transition-colors hover:bg-[#f5eff8] hover:text-[#754691]",
                    selected && "bg-[#f5eff8] font-semibold text-[#4A2260]",
                  )}
                >
                  <Icon size={13} /> {entry.name}
                </button>
              );
            })}
            {departmentsError && (
              <div className="mx-2.5 mt-3 text-[10px] text-red-600">
                <p>Folders could not be loaded: {departmentsError}</p>
                <button type="button" className="mt-1 underline hover:text-[#754691]" onClick={onRetryDepartments}>
                  Try again
                </button>
              </div>
            )}
          </div>
        )}
      </nav>
      {(role === "admin" || role === "supervisor") && <div className="mt-auto px-2.5 pt-6">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-slate-700">
          <Database size={15} className="text-slate-500" /> Storage
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-[#4A2260]"
            style={{
              width: `${stats ? Math.min(100, (stats.storageUsed / stats.storageLimit) * 100) : 0}%`,
            }}
          />
        </div>
        <div className="mt-2 flex justify-between gap-1 text-[9px] text-muted">
          <span>
            {stats
              ? `${formatBytes(stats.storageUsed)} of ${formatBytes(stats.storageLimit)} used`
              : "Loading storage…"}
          </span>
          <span>
            {stats && stats.storageLimit
              ? `${Math.round((stats.storageUsed / stats.storageLimit) * 100)}%`
              : ""}
          </span>
        </div>
      </div>
      }
    </>
  );

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 top-16 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 size-full cursor-default bg-slate-950/35"
            onClick={onCloseMobile}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(84vw,320px)] flex-col overflow-y-auto border-r border-border bg-white px-3 py-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between border-b border-border px-2 pb-3">
              <span className="text-xs font-semibold text-slate-800">Navigation</span>
              <button
                type="button"
                className="grid size-8 place-items-center rounded-md text-slate-500 hover:bg-[#f5eff8] hover:text-[#4A2260]"
                aria-label="Close navigation"
                onClick={onCloseMobile}
              >
                <X size={17} />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}
      <aside className={cn(
        "hidden w-[232px] shrink-0 flex-col overflow-y-auto border-r border-border bg-white px-3 py-6",
        desktopVisible ? "lg:flex" : "lg:hidden",
      )}>
        {sidebarContent}
      </aside>
    </>
  );
}

function FolderTreeNode({
  folder,
  depth,
  folderId,
  folderPathKey,
  onSelectFolder,
}: {
  folder: ContentItem;
  depth: number;
  folderId: string | null;
  folderPathKey: string;
  onSelectFolder: (folder: ContentItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isOnActivePath = folderPathKey.split("/").includes(folder.id);
  const childrenQuery = useQuery({
    queryKey: ["folder-children", folder.id],
    queryFn: () =>
      getItems({ folderId: folder.id, view: "all", search: "", sort: "name" }).then(items =>
        items.filter(item => item.kind === "folder"),
      ),
    enabled: expanded,
  });
  const hasFolderChildren = (folder.childFolderCount ?? 0) > 0;
  const Icon = expanded ? FolderOpen : FolderClosed;

  useEffect(() => {
    if (isOnActivePath) setExpanded(true);
  }, [isOnActivePath]);

  return (
    <div
      role="treeitem"
      aria-expanded={hasFolderChildren ? expanded : undefined}
      aria-selected={folderId === folder.id}
    >
      <div
        className={cn(
          "group flex h-8 items-center rounded-md pr-2 text-[10px] text-slate-600 transition-colors hover:bg-[#f5eff8] hover:text-[#754691]",
          folderId === folder.id && "bg-[#f5eff8] font-semibold text-[#4A2260] hover:bg-[#f5eff8]",
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {hasFolderChildren ? (
          <button
            type="button"
            className="grid size-6 shrink-0 place-items-center rounded hover:bg-[#f5eff8] hover:text-[#754691]"
            onClick={() => setExpanded(value => !value)}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${folder.name}`}
            aria-expanded={expanded}
          >
            {childrenQuery.isFetching ? (
              <LoaderCircle size={12} className="animate-spin" />
            ) : expanded ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )}
          </button>
        ) : (
          <span className="size-6 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onSelectFolder(folder)}
          className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
          aria-current={folderId === folder.id ? "page" : undefined}
        >
          <Icon size={14} className="shrink-0" />
          <span className="truncate">{folder.name}</span>
        </button>
      </div>
      {expanded && childrenQuery.isError && (
        <div
          className="ml-8 flex items-center gap-1 px-2 py-1 text-[9px] text-red-600"
          style={{ marginLeft: `${18 + depth * 14}px` }}
        >
          <AlertCircle size={11} />
          <span>Could not load subfolders.</span>
          <button type="button" className="underline" onClick={() => void childrenQuery.refetch()}>
            Retry
          </button>
        </div>
      )}
      {expanded && childrenQuery.data && (
        <div role="group">
          {childrenQuery.data.map(child => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              folderId={folderId}
              folderPathKey={folderPathKey}
              onSelectFolder={onSelectFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}
