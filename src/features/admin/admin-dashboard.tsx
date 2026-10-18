import { ArrowRight } from "lucide-react";
import { type UserProfile, type WorkspaceStats } from "../../lib/api";
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
  return (
    <section className="mx-auto max-w-[1280px]">
      <div className="mb-5">
        <p className="text-[10px] text-muted">Administration / Overview</p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.5px] text-slate-800">
          Welcome, {user.fullName}
        </h1>
        <p className="mt-1 text-[11px] text-muted">
          {user.role === "admin" || user.role === "supervisor"
            ? "Manage bank content and application access."
            : "Browse shared bank content and application information."}
        </p>
      </div>
      <WorkspaceStatsCards
        stats={stats}
        error={statsError}
        onRetry={onRetryStats}
        showNeedsReview={user.role === "admin" || user.role === "supervisor"}
      />
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <button type="button" className="text-left" onClick={() => onOpenPage("content")}>
          <Card className="h-full p-5 transition-colors hover:border-[#cbb6d8] hover:bg-[#fdfbfe]">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Bank content</p>
            <p className="mt-2 text-sm font-semibold text-slate-800">
              {user.role === "admin" || user.role === "supervisor" ? "Manage the document bank" : "Browse shared documents"}
            </p>
            <p className="mt-1 text-xs text-muted">
              {user.role === "admin" || user.role === "supervisor"
                ? "Upload documents, create folders and organize shared resources."
                : "Preview and download resources shared with your account."}
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#4A2260]">
              {user.role === "admin" || user.role === "supervisor" ? "Open content" : "Browse content"} <ArrowRight size={13} />
            </span>
          </Card>
        </button>
      </div>
    </section>
  );
}
