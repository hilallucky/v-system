import { LayoutGrid, Link2, List, LoaderCircle, Upload, UploadCloud } from "lucide-react";
import { type ChangeEvent, type DragEvent, useRef, useState } from "react";
import type { Sort } from "./file-list";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface FileToolbarProps {
  sort: Sort;
  layout: "list" | "grid";
  onSortChange: (sort: Sort) => void;
  onLayoutChange: () => void;
  isUploading: boolean;
  onUpload: (files: File[]) => void;
  onAddLink: () => void;
}

export function FileToolbar({
  sort,
  layout,
  onSortChange,
  onLayoutChange,
  isUploading,
  onUpload,
  onAddLink,
}: FileToolbarProps) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    onUpload(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragging(false);
    onUpload(Array.from(event.dataTransfer.files));
  }

  return (
    <Card
      className={`mb-5 flex min-h-12 flex-wrap items-center gap-2 p-2 transition-colors ${
        isDragging ? "border-blue-400 bg-blue-50" : ""
      }`}
      onDragEnter={event => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={event => event.preventDefault()}
      onDragLeave={event => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
          setIsDragging(false);
        }
      }}
      onDrop={handleDrop}
      aria-busy={isUploading}
    >
      <Button
        variant="ghost"
        size="sm"
        disabled={isUploading}
        onClick={() => uploadRef.current?.click()}
      >
        {isUploading ? <LoaderCircle size={14} className="animate-spin" /> : <Upload size={14} />}
        {isUploading ? "Uploading…" : "Choose files"}
      </Button>
      <Button variant="ghost" size="sm" onClick={onAddLink}>
        <Link2 size={14} /> Add link
      </Button>
      <input
        ref={uploadRef}
        type="file"
        className="hidden"
        accept=".pdf,.csv,.docx,.xlsx,.pptx,.png,.jpg,.jpeg"
        aria-label="Choose files to upload"
        multiple
        onChange={handleFileChange}
      />
      <span className="hidden h-5 w-px bg-border sm:block" />
      <span className="flex items-center gap-1.5 px-1 text-[10px] text-muted">
        <UploadCloud size={14} />
        {isDragging ? "Drop files to upload" : "or drag files here"}
      </span>
      <span className="ml-auto flex items-center gap-2 text-[10px] text-muted">
        <span className="hidden sm:inline">Sort by</span>
        <select
          className="h-8 rounded-md border-0 bg-transparent px-2 text-[10px] text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/30"
          value={sort}
          onChange={event => {
            const value = event.target.value;
            if (value === "name" || value === "modified" || value === "type") {
              onSortChange(value);
            }
          }}
          aria-label="Sort files"
        >
          <option value="name">Name: A to Z</option>
          <option value="modified">Recently modified</option>
          <option value="type">File type</option>
        </select>
        <span className="h-5 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={layout === "list" ? "Switch to thumbnail view" : "Switch to list view"}
          title={layout === "list" ? "Thumbnail view" : "List view"}
          onClick={onLayoutChange}
        >
          {layout === "list" ? <LayoutGrid size={15} /> : <List size={15} />}
        </Button>
      </span>
    </Card>
  );
}
