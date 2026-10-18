import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, LoaderCircle, Pencil, UserRoundPlus, UserRoundX, X } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import {
  createManagedUser,
  getManagedUsers,
  setManagedUserActive,
  updateManagedUser,
  type AppRole,
  type ManagedUser,
} from "../../lib/api";

const roleNames: Record<AppRole, string> = {
  admin: "Administrator",
  supervisor: "Supervisor",
  user: "User",
  member: "Member",
};

export function UserManagementPanel({
  currentUserId,
  currentRole,
  canAdd,
  canEdit,
}: {
  currentUserId: string;
  currentRole: AppRole;
  canAdd: boolean;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("user");
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<AppRole>("user");
  const assignableRoles: AppRole[] = currentRole === "admin"
    ? ["admin", "supervisor", "user", "member"]
    : ["supervisor","user", "member"];
  const canManage = currentRole === "admin" || currentRole === "supervisor";
  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: getManagedUsers });
  const createMutation = useMutation({
    mutationFn: createManagedUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setFullName("");
      setEmail("");
      setPassword("");
      setRole("user");
    },
  });
  const editMutation = useMutation({
    mutationFn: () => {
      if (!editingUser) throw new Error("Select an account to edit.");
      return updateManagedUser(editingUser.id, { fullName: editName, email: editEmail, role: editRole });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditingUser(null);
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setManagedUserActive(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  return (
    <section className="mx-auto max-w-[1280px]">
      <header className="mb-5">
        <p className="text-[10px] text-muted">Administrator / User Management</p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.5px] text-slate-800">User Management</h1>
        <p className="mt-1 text-[11px] text-muted">
          Review accounts and manage roles or access. Disabled users cannot log in, and their active sessions are revoked.
        </p>
      </header>

      {canManage && canAdd && (
        <Card className="mb-5 p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Add user</h2>
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
            onSubmit={event => {
              event.preventDefault();
              createMutation.mutate({ fullName, email, password, role });
            }}
          >
            <label className="text-[11px] font-medium text-slate-600">
              Full name
              <input required maxLength={120} value={fullName} onChange={event => setFullName(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-border px-3 text-xs outline-none focus:border-[#754691] focus:ring-2 focus:ring-[#754691]/20" />
            </label>
            <label className="text-[11px] font-medium text-slate-600">
              Email
              <input type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-border px-3 text-xs outline-none focus:border-[#754691] focus:ring-2 focus:ring-[#754691]/20" />
            </label>
            <label className="text-[11px] font-medium text-slate-600">
              Initial password
              <input type="password" required minLength={10} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-border px-3 text-xs outline-none focus:border-[#754691] focus:ring-2 focus:ring-[#754691]/20" />
            </label>
            <label className="text-[11px] font-medium text-slate-600">
              Role
              <select value={role} onChange={event => setRole(event.target.value as AppRole)} className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-xs">
                {assignableRoles.map(option => <option key={option} value={option}>{roleNames[option]}</option>)}
              </select>
            </label>
            <div className="flex items-end">
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? <LoaderCircle size={14} className="animate-spin" /> : <UserRoundPlus size={14} />}
                Add user
              </Button>
            </div>
          </form>
          {createMutation.isError && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-red-700" role="alert">
              <AlertCircle size={14} /> {createMutation.error.message}
            </p>
          )}
        </Card>
      )}

      {editingUser && canManage && canEdit && (
        <Card className="mb-5 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Edit {editingUser.fullName}</h2>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditingUser(null)} aria-label="Cancel editing">
              <X size={14} />
            </Button>
          </div>
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={event => {
              event.preventDefault();
              editMutation.mutate();
            }}
          >
            <label className="text-[11px] font-medium text-slate-600">
              Full name
              <input required maxLength={120} value={editName} onChange={event => setEditName(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-border px-3 text-xs" />
            </label>
            <label className="text-[11px] font-medium text-slate-600">
              Email
              <input type="email" required maxLength={254} value={editEmail} onChange={event => setEditEmail(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-border px-3 text-xs" />
            </label>
            <label className="text-[11px] font-medium text-slate-600">
              Role
              <select value={editRole} onChange={event => setEditRole(event.target.value as AppRole)} disabled={editingUser.id === currentUserId} className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-xs">
                {assignableRoles.map(option => <option key={option} value={option}>{roleNames[option]}</option>)}
              </select>
            </label>
            <div className="flex items-end">
              <Button type="submit" className="w-full" disabled={editMutation.isPending}>
                {editMutation.isPending && <LoaderCircle size={14} className="animate-spin" />}
                Save account
              </Button>
            </div>
          </form>
          {editMutation.isError && <p className="mt-3 text-xs text-red-700" role="alert">{editMutation.error.message}</p>}
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-800">Accounts</h2>
        </div>
        {usersQuery.isPending ? (
          <div className="flex items-center gap-2 p-5 text-xs text-muted">
            <LoaderCircle size={14} className="animate-spin" /> Loading accounts…
          </div>
        ) : usersQuery.isError ? (
          <div className="p-5">
            <p className="flex items-center gap-2 text-xs text-red-700">
              <AlertCircle size={14} /> Could not load accounts: {usersQuery.error.message}
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void usersQuery.refetch()}>Try again</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Access</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.data.map(user => (
                  <tr key={user.id} className="border-t border-border text-slate-600">
                    <td className="px-4 py-3 font-medium text-slate-800">{user.fullName}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">{roleNames[user.role]}</td>
                    <td className="px-4 py-3">
                      <span className={user.isActive ? "text-emerald-700" : "text-red-700"}>
                        {user.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {canManage && canEdit && (
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={currentRole === "supervisor" && !["user", "member"].includes(user.role)}
                            onClick={() => {
                              setEditingUser(user);
                              setEditName(user.fullName);
                              setEditEmail(user.email);
                              setEditRole(user.role);
                            }}
                          >
                            <Pencil size={13} /> Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={user.id === currentUserId || statusMutation.isPending || (currentRole === "supervisor" && !["user", "member"].includes(user.role))}
                            onClick={() => {
                              const nextStatus = !user.isActive;
                              const action = nextStatus ? "reactivate" : "disable";
                              if (window.confirm(`${action[0].toUpperCase()}${action.slice(1)} ${user.fullName}'s account?`)) {
                                statusMutation.mutate({ id: user.id, isActive: nextStatus });
                              }
                            }}
                            title={user.id === currentUserId ? "You cannot disable your own account." : undefined}
                          >
                            {user.isActive ? <UserRoundX size={13} /> : <UserRoundPlus size={13} />}
                            {user.isActive ? "Disable" : "Reactivate"}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {statusMutation.isError && (
          <p className="flex items-center gap-1.5 border-t border-border p-4 text-xs text-red-700" role="alert">
            <AlertCircle size={14} /> Could not update account: {statusMutation.error.message}
          </p>
        )}
        {!canManage && (
          <p className="border-t border-border p-4 text-xs text-muted">You have view-only access to account information.</p>
        )}
      </Card>
    </section>
  );
}
