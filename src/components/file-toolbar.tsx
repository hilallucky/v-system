import { LayoutGrid, Link2, List, Upload } from "lucide-react";
import { type ChangeEvent, useRef } from "react";
import type { Sort } from "./file-list";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface FileToolbarProps {
  sort: Sort;
  layout: "list" | "grid";
  onSortChange: (sort: Sort) => void;
  onLayoutChange: () => void;
  onUpload: (file: File | undefined) => void;
  onAddLink: () => void;
}

export function FileToolbar({
  sort,
  layout,
  onSortChange,
  onLayoutChange,
  onUpload,
  onAddLink,
}: FileToolbarProps) {
  const uploadRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    onUpload(event.target.files?.[0]);
    event.target.value = "";
  }

  return (
    <Card className="mb-5 flex min-h-12 items-center gap-2 p-2">
      <Button variant="ghost" size="sm" onClick={() => uploadRef.current?.click()}>
        <Upload size={14} /> Upload
      </Button>
      <Button variant="ghost" size="sm" onClick={onAddLink}>
        <Link2 size={14} /> Add link
      </Button>
      <input
        ref={uploadRef}
        type="file"
        className="hidden"
        accept=".pdf,.csv,.docx,.xlsx,.pptx,.png,.jpg,.jpeg"
        aria-label="Choose a file to upload"
        onChange={handleFileChange}
      />
      <span className="h-5 w-px bg-border" />
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
