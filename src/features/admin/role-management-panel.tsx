import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import {
  getRolePermissions,
  saveRolePermissions,
  type AppRole,
  type MenuPermissions,
} from "../../lib/api";

const roleNames: Record<AppRole, string> = {
  admin: "Administrator",
  supervisor: "Supervisor",
  user: "User",
  member: "Member",
};

const menuNames: Record<MenuPermissions["menuKey"], string> = {
  "admin-dashboard": "Administrator dashboard",
  "user-management": "User Management",
  "role-management": "Role Management",
  contents: "Contents",
  folders: "Folders",
  recent: "Recent",
  starred: "Starred",
  shared: "Shared with me",
  "follow-up-checklist": "Follow Up Checklist",
  "monthly-target": "Monthly Target",
  "activity-record-plan": "Activity Record & Plan",
  "customer-list": "Customer List",
  "prospect-list": "Prospect List",
  "daily-tasks": "7 Daily Tasks",
  "monthly-side-volume": "Monthly Side Volume Target",
};

const editableRoles: Exclude<AppRole, "admin">[] = ["supervisor", "user", "member"];

export function RoleManagementPanel() {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<Exclude<AppRole, "admin">>("supervisor");
  const [permissions, setPermissions] = useState<MenuPermissions[]>([]);
  const rolesQuery = useQuery({ queryKey: ["role-permissions"], queryFn: getRolePermissions });
  const selected = rolesQuery.data?.find(entry => entry.role === selectedRole);

  useEffect(() => {
    if (selected) setPermissions(selected.permissions);
  }, [selected]);

  const saveMutation = useMutation({
    mutationFn: () => saveRolePermissions(selectedRole, permissions),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["role-permissions"] }),
        queryClient.invalidateQueries({ queryKey: ["menu-permissions"] }),
      ]);
    },
  });

  function updatePermission(menuKey: MenuPermissions["menuKey"], action: keyof Omit<MenuPermissions, "menuKey">, checked: boolean) {
    setPermissions(current =>
      current.map(permission =>
        permission.menuKey === menuKey ? { ...permission, [action]: checked } : permission,
      ),
    );
  }

  return (
    <section className="mx-auto max-w-[1280px]">
      <header className="mb-5">
        <p className="text-[10px] text-muted">Administrator / Role Management</p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.5px] text-slate-800">Role Management</h1>
        <p className="mt-1 text-[11px] text-muted">
          Configure which menus each role can view, add, edit, or delete. Administrator access is always unrestricted.
        </p>
      </header>
      {rolesQuery.isPending ? (
        <div className="flex items-center gap-2 p-5 text-xs text-muted">
          <LoaderCircle size={14} className="animate-spin" /> Loading role permissions…
        </div>
      ) : rolesQuery.isError ? (
        <Card className="p-5">
          <p className="flex items-center gap-2 text-xs text-red-700" role="alert">
            <AlertCircle size={14} /> Could not load role permissions: {rolesQuery.error.message}
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void rolesQuery.refetch()}>Try again</Button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
              Role
              <select
                value={selectedRole}
                onChange={event => setSelectedRole(event.target.value as Exclude<AppRole, "admin">)}
                className="h-9 rounded-md border border-border bg-white px-3 text-xs"
              >
                {editableRoles.map(role => <option key={role} value={role}>{roleNames[role]}</option>)}
              </select>
            </label>
            <Button
              type="button"
              disabled={!selected || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending && <LoaderCircle size={14} className="animate-spin" />}
              Save permissions
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] border-collapse text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Menu</th>
                  {(["view", "add", "edit", "delete"] as const).map(action => (
                    <th key={action} className="px-4 py-3 text-center">{action}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissions.map(permission => (
                  <tr key={permission.menuKey} className="border-t border-border text-slate-600">
                    <th scope="row" className="px-4 py-3 text-left font-medium text-slate-800">
                      {menuNames[permission.menuKey]}
                    </th>
                    {(["view", "add", "edit", "delete"] as const).map(action => (
                      <td key={action} className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={permission[action]}
                          onChange={event => updatePermission(permission.menuKey, action, event.target.checked)}
                          aria-label={`${action} ${menuNames[permission.menuKey]}`}
                          disabled={
                            permission.menuKey === "role-management" ||
                            permission.menuKey === "user-management" &&
                              (action === "delete" ||
                                selectedRole === "user" && action !== "view" ||
                                selectedRole === "member")
                          }
                          className="size-4 accent-[#4A2260]"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(saveMutation.isError || saveMutation.isSuccess) && (
            <p
              className={`border-t border-border px-4 py-3 text-xs ${saveMutation.isError ? "text-red-700" : "text-emerald-700"}`}
              role={saveMutation.isError ? "alert" : "status"}
            >
              {saveMutation.isError ? saveMutation.error.message : `Permissions saved for ${roleNames[selectedRole]}.`}
            </p>
          )}
        </Card>
      )}
    </section>
  );
}
