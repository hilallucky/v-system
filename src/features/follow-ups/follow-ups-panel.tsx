import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { useState } from "react";
import {
  createFollowUp,
  getFollowUps,
  updateFollowUp,
  type FollowUpStatus,
  type UserProfile,
} from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";

const statusLabels: Record<FollowUpStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

export function FollowUpsPanel({ user }: { user: UserProfile }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const query = useQuery({ queryKey: ["follow-ups"], queryFn: getFollowUps });
  const createMutation = useMutation({
    mutationFn: createFollowUp,
    onSuccess: async () => {
      setTitle("");
      setDescription("");
      setDueDate("");
      await queryClient.invalidateQueries({ queryKey: ["follow-ups"] });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: FollowUpStatus }) =>
      updateFollowUp(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["follow-ups"] }),
  });

  return (
    <section className="mx-auto max-w-[1000px]">
      <div className="mb-5">
        <p className="text-[10px] text-muted">{user.role === "admin" ? "Administration" : "Workspace"} / Playbooks</p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.5px] text-slate-800">
          {user.role === "admin" ? "Follow-up queue" : "My follow-ups"}
        </h1>
        <p className="mt-1 text-[11px] text-muted">
          {user.role === "admin"
            ? "Review requests submitted by users and update their status."
            : "Create a request and track its progress."}
        </p>
      </div>

      {user.role === "user" && (
        <Card className="mb-5 p-4">
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={event => {
              event.preventDefault();
              createMutation.mutate({
                title: title.trim(),
                description: description.trim(),
                dueDate: dueDate || null,
              });
            }}
          >
            <Input
              required
              maxLength={180}
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="Follow-up title"
              aria-label="Follow-up title"
            />
            <Input
              type="date"
              value={dueDate}
              onChange={event => setDueDate(event.target.value)}
              aria-label="Due date"
            />
            <textarea
              required
              maxLength={5000}
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder="Describe what needs follow-up"
              aria-label="Follow-up description"
              className="min-h-20 rounded-md border border-slate-200 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500/30 sm:col-span-2"
            />
            {createMutation.isError && (
              <p className="text-xs text-red-600 sm:col-span-2">{createMutation.error.message}</p>
            )}
            <div className="sm:col-span-2 sm:justify-self-end">
              <Button type="submit" disabled={!title.trim() || !description.trim() || createMutation.isPending}>
                {createMutation.isPending && <LoaderCircle size={14} className="animate-spin" />}
                Submit follow-up
              </Button>
            </div>
            {createMutation.isError && (
              <p className="text-xs text-red-600 sm:col-span-2">{createMutation.error.message}</p>
            )}
          </form>
        </Card>
      )}

      {query.isPending && (
        <div className="flex items-center gap-2 py-10 text-xs text-muted" role="status">
          <LoaderCircle size={16} className="animate-spin" /> Loading follow-ups…
        </div>
      )}
      {query.isError && (
        <Card className="flex items-center gap-2 p-4 text-xs text-red-600">
          <AlertCircle size={15} /> Could not load follow-ups: {query.error.message}
          <button type="button" className="underline" onClick={() => void query.refetch()}>Retry</button>
        </Card>
      )}
      {query.data && (
        <div className="space-y-3">
          {!query.data.length && (
            <Card className="p-8 text-center text-xs text-muted">No follow-ups yet.</Card>
          )}
          {query.data.map(item => (
            <Card key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-800">{item.title}</h2>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-semibold text-slate-600">
                    {statusLabels[item.status]}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600">{item.description}</p>
                <p className="mt-2 text-[10px] text-muted">
                  {user.role === "admin" ? `From ${item.creatorName} · ` : ""}
                  {item.dueDate ? `Due ${item.dueDate}` : "No due date"} · Updated{" "}
                  {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(item.updatedAt))}
                </p>
              </div>
              {user.role === "admin" && (
                <select
                  className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs"
                  value={item.status}
                  aria-label={`Status for ${item.title}`}
                  disabled={updateMutation.isPending}
                  onChange={event => {
                    const status = event.target.value;
                    if (status === "open" || status === "in_progress" || status === "resolved") {
                      updateMutation.mutate({ id: item.id, status });
                    }
                  }}
                >
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              )}
            </Card>
          ))}
          {updateMutation.isError && <p className="text-xs text-red-600">{updateMutation.error.message}</p>}
        </div>
      )}
    </section>
  );
}
