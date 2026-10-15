import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock3,
  Database,
  FolderClosed,
  FolderOpen,
  LoaderCircle,
  Star,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ContentItem, WorkspaceStats } from "../lib/api";
import { getItems } from "../lib/api";
import { cn } from "../lib/utils";

export type WorkspaceView = "all" | "recent" | "starred" | "shared";

const views: { name: string; value: WorkspaceView; icon: LucideIcon }[] = [
  { name: "Contents", value: "all", icon: FolderClosed },
  { name: "Recent", value: "recent", icon: Clock3 },
  { name: "Starred", value: "starred", icon: Star },
  { name: "Shared with me", value: "shared", icon: UsersRound },
];

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AppSidebarProps {
  view: WorkspaceView;
  folderId: string | null;
  folderPathIds: string[];
  rootFolders: ContentItem[];
  stats?: WorkspaceStats;
  departmentsError?: string;
  onRetryDepartments: () => void;
  onSelectView: (view: WorkspaceView) => void;
  onSelectFolder: (folder: ContentItem) => void;
}

export function AppSidebar({
  view,
  folderId,
  folderPathIds,
  rootFolders,
  stats,
  departmentsError,
  onRetryDepartments,
  onSelectView,
  onSelectFolder,
}: AppSidebarProps) {
  const folderPathKey = folderPathIds.join("/");

  return (
    <aside className="hidden w-[232px] shrink-0 flex-col border-r border-border bg-white px-3 py-6 md:flex">
      <p className="mb-2 px-2.5 text-[9px] font-bold uppercase tracking-[1.1px] text-slate-400">
        Workspace
      </p>
      <nav className="space-y-0.5" aria-label="Workspace">
        {views.map(entry => {
          const Icon = entry.icon;
          const selected = folderId === null && view === entry.value;
          return (
            <button
              key={entry.value}
              type="button"
              onClick={() => onSelectView(entry.value)}
              className={cn(
                "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[11px] text-slate-600 hover:bg-slate-50",
                selected && "bg-blue-50 font-semibold text-blue-800 hover:bg-blue-50",
              )}
            >
              <Icon size={15} /> {entry.name}
            </button>
          );
        })}
      </nav>
      <div className="my-5 h-px bg-border" />
      <p className="mb-2 px-2.5 text-[9px] font-bold uppercase tracking-[1.1px] text-slate-400">
        Folders
      </p>
      <nav className="space-y-0.5" aria-label="Folders" role="tree">
        {rootFolders.map(folder => (
          <FolderTreeNode
            key={folder.id}
            folder={folder}
            depth={0}
            folderId={folderId}
            folderPathKey={folderPathKey}
            onSelectFolder={onSelectFolder}
          />
        ))}
        {!rootFolders.length && !departmentsError && (
          <p className="px-2.5 py-2 text-[10px] text-muted">No folders yet.</p>
        )}
      </nav>
      {departmentsError && (
        <div className="mx-2.5 mt-3 text-[10px] text-red-600">
          <p>Folders could not be loaded: {departmentsError}</p>
          <button type="button" className="mt-1 underline" onClick={onRetryDepartments}>
            Try again
          </button>
        </div>
      )}
      <div className="mt-auto px-2.5 pt-6">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-slate-700">
          <Database size={15} className="text-slate-500" /> Storage
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-blue-700"
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
    </aside>
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
          "group flex h-8 items-center rounded-md pr-2 text-[10px] text-slate-600 hover:bg-slate-50",
          folderId === folder.id && "bg-blue-50 font-semibold text-blue-800 hover:bg-blue-50",
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {hasFolderChildren ? (
          <button
            type="button"
            className="grid size-6 shrink-0 place-items-center rounded hover:bg-slate-200/70"
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
