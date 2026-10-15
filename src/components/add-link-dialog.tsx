import { LoaderCircle } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";

export function AddLinkDialog({
  open,
  isPending,
  error,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  isPending: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (url: string, name: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) {
      setUrl("");
      setName("");
    }
  }, [open]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(url.trim(), name.trim());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className="text-base font-semibold text-slate-800">Add a website link</DialogTitle>
        <DialogDescription className="mb-4 mt-1.5 text-xs text-muted">
          Save a public website in this folder. We’ll use its page metadata to show a thumbnail.
        </DialogDescription>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block space-y-1.5 text-xs font-medium text-slate-700">
            Website URL
            <Input
              autoFocus
              required
              type="url"
              maxLength={2048}
              value={url}
              onChange={event => setUrl(event.target.value)}
              placeholder="https://example.com"
              aria-label="Website URL"
            />
          </label>
          <label className="block space-y-1.5 text-xs font-medium text-slate-700">
            Display name <span className="font-normal text-muted">(optional)</span>
            <Input
              maxLength={180}
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Use the website title"
              aria-label="Link display name"
            />
          </label>
          {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending || !url.trim()}>
              {isPending && <LoaderCircle size={14} className="animate-spin" />}
              {isPending ? "Loading preview…" : "Add link"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
