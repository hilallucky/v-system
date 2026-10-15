import { AlertCircle, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { mountOfficePreview, type OfficePreviewFormat } from "./office-preview";

interface OfficeDocumentPreviewProps {
  fileId: string;
  format: OfficePreviewFormat;
}

export function OfficeDocumentPreview({ fileId, format }: OfficeDocumentPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    let unmountViewer: (() => void) | undefined;
    setLoading(true);
    setError(null);

    async function render() {
      try {
        const response = await fetch(
          `/api/v1/files/${encodeURIComponent(fileId)}/preview`,
          { credentials: "same-origin", signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(`Preview request failed (${response.status}).`);
        }
        const source = await response.arrayBuffer();
        if (disposed || !containerRef.current) return;

        const disposeViewer = await mountOfficePreview(
          containerRef.current,
          format,
          source,
          () => {
            if (!disposed) setLoading(false);
          },
          () => {
            if (!disposed) {
              setLoading(false);
              setError("This document could not be rendered. Try downloading it instead.");
            }
          },
        );
        if (disposed) {
          disposeViewer();
        } else {
          unmountViewer = disposeViewer;
        }
      } catch (previewError) {
        if (disposed || (previewError instanceof Error && previewError.name === "AbortError")) return;
        setLoading(false);
        setError(previewError instanceof Error ? previewError.message : "Document preview failed.");
      }
    }

    void render();
    return () => {
      disposed = true;
      controller.abort();
      unmountViewer?.();
    };
  }, [fileId, format]);

  return (
    <div className="relative min-h-[60vh] w-full overflow-auto bg-white">
      {loading && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-white/80">
          <p className="flex items-center gap-2 text-xs text-muted" role="status">
            <LoaderCircle size={15} className="animate-spin" /> Preparing document preview…
          </p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-white p-6">
          <p className="flex max-w-md items-center gap-2 text-center text-xs text-red-600" role="alert">
            <AlertCircle size={16} className="shrink-0" /> {error}
          </p>
        </div>
      )}
      <div ref={containerRef} className="min-h-[60vh] w-full" />
    </div>
  );
}
