import { AlertCircle, Clock3, FileText, FolderClosed } from "lucide-react";
import type { ReactNode } from "react";
import type { WorkspaceStats } from "../lib/api";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { cn } from "../lib/utils";

interface WorkspaceStatsProps {
  stats?: WorkspaceStats;
  error?: string;
  onRetry: () => void;
}

export function WorkspaceStatsCards({ stats, error, onRetry }: WorkspaceStatsProps) {
  if (error) {
    return (
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[11px] text-red-700">
        <AlertCircle size={15} /> Workspace statistics could not be loaded: {error}
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <section className="mb-5 grid gap-3 sm:grid-cols-3" aria-label="Workspace overview">
      <StatCard icon={<FolderClosed size={18} />} tone="blue" label="Total folders">
        {stats?.folders ?? "—"}
        <span className="ml-2 text-[9px] font-medium text-muted">across workspace</span>
      </StatCard>
      <StatCard icon={<FileText size={18} />} tone="green" label="Documents">
        {stats?.documents ?? "—"}
        <span className="ml-2 text-[9px] font-medium text-emerald-700">securely stored</span>
      </StatCard>
      <StatCard icon={<Clock3 size={18} />} tone="amber" label="Needs review">
        {stats?.needsReview ?? "—"}
        <span className="ml-2 text-[9px] font-medium text-amber-700">attention needed</span>
      </StatCard>
    </section>
  );
}

function StatCard({
  icon,
  tone,
  label,
  children,
}: {
  icon: ReactNode;
  tone: "blue" | "green" | "amber";
  label: string;
  children: ReactNode;
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <Card className="flex min-h-[84px] items-center gap-3 p-3.5 sm:p-4">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", tones[tone])}>
        {icon}
      </span>
      <span>
        <span className="mb-1 block text-[10px] text-muted">{label}</span>
        <span className="text-[18px] font-semibold tracking-tight text-slate-800">{children}</span>
      </span>
    </Card>
  );
}
