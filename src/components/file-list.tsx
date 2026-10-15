import { AlertCircle, Download, ExternalLink, FileText, FolderClosed, FolderOpen, Globe2, LoaderCircle } from "lucide-react";
import type { ContentItem } from "../lib/api";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { cn } from "../lib/utils";

export type Sort = "name" | "modified" | "type";

interface FileListProps {
  items: ContentItem[];
  layout: "list" | "grid";
  search: string;
  isPending: boolean;
  error: Error | null;
  onRetry: () => void;
  onOpen: (item: ContentItem) => void;
  onDownload: (item: ContentItem) => void;
}

function formatBytes(bytes: number | null) {
  if (bytes === null || bytes === 0) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function displayType(item: ContentItem) {
  if (item.kind === "folder") return "Folder";
  if (item.kind === "link") return "Website";
  return item.name.split(".").pop()?.toUpperCase() ?? "File";
}

function itemIcon(item: ContentItem) {
  if (item.kind === "folder") {
    return (
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">
        <FolderClosed size={17} />
      </span>
    );
  }
  if (item.kind === "link") {
    return (
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-700">
        <Globe2 size={17} />
      </span>
    );
  }
  const extension = item.name.split(".").pop()?.toLowerCase();
  const style =
    extension === "pdf"
      ? "bg-red-50 text-red-600"
      : ["xlsx", "csv"].includes(extension ?? "")
        ? "bg-emerald-50 text-emerald-700"
        : extension === "pptx"
          ? "bg-orange-50 text-orange-700"
          : "bg-blue-50 text-blue-700";
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", style)}>
      <FileText size={17} />
    </span>
  );
}

function ItemName({
  item,
  compact,
  onOpen,
}: {
  item: ContentItem;
  compact: boolean;
  onOpen: (item: ContentItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="flex min-w-0 items-center gap-2.5 text-left"
      title={
        item.kind === "folder"
          ? `Open ${item.name}`
          : item.kind === "link"
            ? `Open ${item.url ?? item.name}`
            : `Preview ${item.name}`
      }
    >
      {itemIcon(item)}
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-semibold text-slate-700 group-hover:text-blue-700">
          {item.name}
        </span>
        {compact && (
          <span className="mt-1 block text-[10px] text-muted">
            {item.kind === "folder"
              ? "Folder"
              : item.kind === "link"
                ? new URL(item.url ?? "https://example.invalid").hostname
                : `${displayType(item)} · ${formatBytes(item.size)}`}
          </span>
        )}
        {!compact && item.kind !== "folder" && (
          <span className="mt-1 block text-[10px] text-muted">
            {item.kind === "link" ? item.url : `${displayType(item)} document`}
          </span>
        )}
      </span>
    </button>
  );
}

function ThumbnailItem({
  item,
  onOpen,
  onDownload,
}: {
  item: ContentItem;
  onOpen: (item: ContentItem) => void;
  onDownload: (item: ContentItem) => void;
}) {
  const isImage = item.kind === "file" && item.mimeType?.startsWith("image/");
  const extension = item.kind === "file" ? displayType(item) : null;
  const linkHost =
    item.kind === "link" && item.url ? new URL(item.url).hostname.replace(/^www\./i, "") : null;

  return (
    <Card className="group overflow-hidden transition-colors hover:border-blue-200 hover:bg-blue-50/20">
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
        title={
          item.kind === "folder"
            ? `Open ${item.name}`
            : item.kind === "link"
              ? `Open ${item.url ?? item.name}`
              : `Preview ${item.name}`
        }
      >
        <span className="flex h-36 items-center justify-center overflow-hidden bg-slate-50">
          {item.kind === "link" && item.thumbnailUrl ? (
            <img
              src={item.thumbnailUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : isImage && item.hasContent ? (
            <img
              src={`/api/v1/files/${encodeURIComponent(item.id)}/preview`}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <span
              className={cn(
                "grid size-16 place-items-center rounded-2xl",
                item.kind === "folder"
                  ? "bg-blue-100 text-blue-700"
                  : item.kind === "link"
                    ? "bg-violet-100 text-violet-700"
                    : "bg-white text-slate-500 shadow-sm",
              )}
            >
              {item.kind === "folder" ? (
                <FolderOpen size={30} />
              ) : item.kind === "link" ? (
                <Globe2 size={30} />
              ) : (
                <FileText size={30} />
              )}
              {extension && (
                <span className="sr-only">{extension} file</span>
              )}
            </span>
          )}
        </span>
        <span className="block min-w-0 p-3 pb-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="block truncate text-[11px] font-semibold text-slate-700 group-hover:text-blue-700">
              {item.name}
            </span>
            {item.kind === "link" && <ExternalLink size={12} className="shrink-0 text-muted" />}
          </span>
          <span className="mt-1 block truncate text-[10px] text-muted">
            {item.kind === "folder"
              ? `${item.childCount ?? 0} items`
              : item.kind === "link"
                ? linkHost
                : `${displayType(item)} · ${formatBytes(item.size)}`}
          </span>
        </span>
      </button>
      {item.kind === "file" && (
        <div className="flex justify-end px-2 pb-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 rounded-full px-2 text-[9px] text-slate-500 hover:bg-blue-50 hover:text-blue-700"
            onClick={() => onDownload(item)}
            aria-label={`Download ${item.name}`}
            title={`Download ${item.name}`}
          >
            <Download size={14} strokeWidth={2.2} /> 
            {/* Download */}
          </Button>
        </div>
      )}
    </Card>
  );
}

export function FileList({
  items,
  layout,
  search,
  isPending,
  error,
  onRetry,
  onOpen,
  onDownload,
}: FileListProps) {
  if (isPending) {
    return (
      <div className="flex h-48 items-center justify-center gap-2 text-xs text-muted">
        <LoaderCircle className="animate-spin" size={16} /> Loading files…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-5 text-center">
        <AlertCircle size={22} className="text-red-500" />
        <p className="max-w-md text-xs text-slate-600">{error.message}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  if (!items.length) {
    return (
      <div className="px-4 py-14 text-center text-xs text-muted">
        {search ? `No files or folders match “${search}”.` : "This folder is empty."}
      </div>
    );
  }
  if (layout === "grid") {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2.5 p-3 max-sm:grid-cols-1">
        {items.map(item => (
          <ThumbnailItem key={item.id} item={item} onOpen={onOpen} onDownload={onDownload} />
        ))}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[690px] border-collapse text-left">
        <thead className="bg-slate-50/80 text-[10px] font-medium text-slate-400">
          <tr>
            <th className="w-[40%] px-4 py-3">Name</th>
            <th className="px-3 py-3">Owner</th>
            <th className="px-3 py-3">Last modified</th>
            <th className="px-3 py-3">File size</th>
            <th className="px-3 py-3">Status</th>
            <th className="w-24 px-3 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr
              key={item.id}
              className="group border-t border-slate-100 text-[10px] text-slate-500 transition-colors hover:bg-slate-50/70"
            >
              <td className="px-4 py-2.5">
                <ItemName item={item} compact={false} onOpen={onOpen} />
              </td>
              <td className="px-3 py-2.5">{item.owner}</td>
              <td className="px-3 py-2.5">{formatDate(item.modifiedAt)}</td>
              <td className="px-3 py-2.5">{formatBytes(item.size)}</td>
              <td className="px-3 py-2.5">
                {item.kind !== "file" ? (
                  "—"
                ) : (
                  <Badge
                    className={cn(
                      "gap-1.5 bg-emerald-50 text-emerald-700",
                      item.status === "In review" && "bg-amber-50 text-amber-700",
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-current" />
                    {item.status}
                  </Badge>
                )}
              </td>
              <td className="px-3 py-2.5 text-right">
                {item.kind === "file" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 rounded-full px-2 text-[9px] text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                    onClick={() => onDownload(item)}
                    aria-label={`Download ${item.name}`}
                    title={`Download ${item.name}`}
                  >
                    <Download size={11} strokeWidth={2.2} />
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FileListHeader({
  title,
  count,
  isFetching,
}: {
  title: string;
  count: number;
  isFetching: boolean;
}) {
  return (
    <div className="flex h-12 items-center justify-between border-b border-border px-4">
      <div>
        <span className="text-[11px] font-semibold text-slate-700">{title}</span>
        <span className="ml-2 text-[10px] text-muted">
          {count} {count === 1 ? "item" : "items"}
        </span>
      </div>
      {isFetching && (
        <LoaderCircle size={14} className="animate-spin text-slate-400" aria-label="Refreshing files" />
      )}
    </div>
  );
}
