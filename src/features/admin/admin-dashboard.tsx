import { useQuery } from "@tanstack/react-query";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { getFollowUps, type UserProfile, type WorkspaceStats } from "../../lib/api";
import { Card } from "../../components/ui/card";
import { WorkspaceStatsCards } from "../../components/workspace-stats";
import type { WorkspacePage } from "../../components/app-sidebar";

interface AdminDashboardProps {
  user: UserProfile;
  stats?: WorkspaceStats;
  statsError?: string;
  onRetryStats: () => void;
  onOpenPage: (page: WorkspacePage) => void;
}

export function AdminDashboard({
  user,
  stats,
  statsError,
  onRetryStats,
  onOpenPage,
}: AdminDashboardProps) {
  const followUpsQuery = useQuery({ queryKey: ["follow-ups"], queryFn: getFollowUps });
  const openFollowUps = followUpsQuery.data?.filter(item => item.status !== "resolved").length;

  return (
    <section className="mx-auto max-w-[1280px]">
      <div className="mb-5">
        <p className="text-[10px] text-muted">Administration / Overview</p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.5px] text-slate-800">
          Welcome, {user.fullName}
        </h1>
        <p className="mt-1 text-[11px] text-muted">Manage bank content and review user follow-ups.</p>
      </div>
      <WorkspaceStatsCards stats={stats} error={statsError} onRetry={onRetryStats} />
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <button type="button" className="text-left" onClick={() => onOpenPage("content")}>
          <Card className="h-full p-5 transition-colors hover:border-blue-300">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Bank content</p>
            <p className="mt-2 text-sm font-semibold text-slate-800">Manage the document bank</p>
            <p className="mt-1 text-xs text-muted">Upload documents, create folders and organize shared resources.</p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
              Open content <ArrowRight size={13} />
            </span>
          </Card>
        </button>
        <button type="button" className="text-left" onClick={() => onOpenPage("follow-ups")}>
          <Card className="h-full p-5 transition-colors hover:border-blue-300">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Playbooks</p>
            <p className="mt-2 text-sm font-semibold text-slate-800">
              {followUpsQuery.isPending ? (
                <span className="inline-flex items-center gap-2"><LoaderCircle size={14} className="animate-spin" /> Loading queue</span>
              ) : followUpsQuery.isError ? (
                "Queue unavailable"
              ) : (
                `${openFollowUps ?? 0} open request${openFollowUps === 1 ? "" : "s"}`
              )}
            </p>
            <p className="mt-1 text-xs text-muted">Review user requests and update their status.</p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
              Open queue <ArrowRight size={13} />
            </span>
          </Card>
        </button>
      </div>
      {followUpsQuery.isError && (
        <p className="mt-3 text-xs text-red-600">Could not load follow-up totals: {followUpsQuery.error.message}</p>
      )}
    </section>
  );
}
