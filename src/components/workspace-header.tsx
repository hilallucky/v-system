import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Bell,
  CircleHelp,
  LoaderCircle,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import {
  getContentNotifications,
  markContentNotificationRead,
  type ContentNotification,
  type UserProfile,
} from "../lib/api";
import { Button } from "./ui/button";

interface WorkspaceHeaderProps {
  onHelp: () => void;
  onOpenNotification: (notification: ContentNotification) => void;
  user: UserProfile;
  isLoggingOut: boolean;
  onProfile: () => void;
  onLogout: () => void;
  onToggleMobileSidebar: () => void;
  onToggleDesktopSidebar: () => void;
  desktopSidebarVisible: boolean;
  mobileSidebarOpen: boolean;
}

export function WorkspaceHeader({
  onHelp,
  onOpenNotification,
  user,
  isLoggingOut,
  onProfile,
  onLogout,
  onToggleMobileSidebar,
  onToggleDesktopSidebar,
  desktopSidebarVisible,
  mobileSidebarOpen,
}: WorkspaceHeaderProps) {
  const queryClient = useQueryClient();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsQuery = useQuery({
    queryKey: ["content-notifications"],
    queryFn: getContentNotifications,
    refetchInterval: 30_000,
  });
  const readMutation = useMutation({
    mutationFn: markContentNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["content-notifications"] }),
  });
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center border-b border-border bg-white px-2 sm:px-7">
      <Button
        variant="ghost"
        size="icon"
        className="mr-1 shrink-0 lg:hidden"
        aria-label={mobileSidebarOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={mobileSidebarOpen}
        title={mobileSidebarOpen ? "Close navigation" : "Open navigation"}
        onClick={onToggleMobileSidebar}
      >
        <Menu size={19} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="mr-2 hidden shrink-0 lg:inline-flex"
        aria-label={desktopSidebarVisible ? "Hide sidebar" : "Show sidebar"}
        title={desktopSidebarVisible ? "Hide sidebar" : "Show sidebar"}
        onClick={onToggleDesktopSidebar}
      >
        {desktopSidebarVisible ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
      </Button>
      <a href="/" className="flex min-w-0 shrink items-center gap-2.5 no-underline sm:min-w-52">
        <img
          src="/eskayvie-logo.png"
          alt="Eskayvie"
          className="h-8 w-32 object-contain object-left sm:h-9 sm:w-[154px]"
        />
        <span className="hidden text-[10px] text-muted xl:inline">Bank Content</span>
      </a>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label="Help" title="Help" onClick={onHelp}>
          <CircleHelp size={17} />
        </Button>
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
            title="Notifications"
            aria-expanded={notificationsOpen}
            onClick={() => setNotificationsOpen(open => !open)}
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-none text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Button>
          {notificationsOpen && (
            <div className="absolute right-0 top-11 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-xs font-semibold text-slate-800">Notifications</h2>
                {unreadCount > 0 && <span className="text-[10px] text-muted">{unreadCount} new</span>}
              </div>
              {notificationsQuery.isPending ? (
                <div className="flex items-center gap-2 p-4 text-xs text-muted">
                  <LoaderCircle size={14} className="animate-spin" /> Loading notifications…
                </div>
              ) : notificationsQuery.isError ? (
                <div className="p-4 text-xs text-red-700" role="alert">
                  <AlertCircle size={14} className="mr-1 inline" />
                  Could not load notifications: {notificationsQuery.error.message}
                  <button type="button" className="ml-2 underline" onClick={() => void notificationsQuery.refetch()}>
                    Retry
                  </button>
                </div>
              ) : notificationsQuery.data?.items.length ? (
                <div className="max-h-96 overflow-y-auto">
                  {notificationsQuery.data.items.map(notification => (
                    <button
                      key={notification.id}
                      type="button"
                      disabled={readMutation.isPending}
                      onClick={() => {
                        readMutation.mutate(notification.id, {
                          onSuccess: () => {
                            setNotificationsOpen(false);
                            onOpenNotification(notification);
                          },
                        });
                      }}
                      className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-[#f5eff8] ${
                        notification.readAt ? "bg-white" : "bg-[#fbf8fd]"
                      }`}
                    >
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.readAt ? "bg-slate-200" : "bg-[#754691]"}`} />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-slate-800">{notification.itemName}</span>
                        <span className="mt-1 block text-[10px] text-muted">
                          New {notification.itemKind} added to Bank Content
                        </span>
                        <span className="mt-1 block text-[9px] text-slate-400">
                          {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(notification.createdAt))}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="p-5 text-center text-xs text-muted">You’re all caught up.</p>
              )}
              {readMutation.isError && (
                <p className="border-t border-border px-4 py-2 text-[10px] text-red-700" role="alert">
                  Could not update notification: {readMutation.error.message}
                </p>
              )}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="ml-1 hidden max-w-40 truncate sm:inline-flex"
          onClick={onProfile}
          title="Edit profile"
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#f0e6f5] text-[10px] font-bold text-[#4A2260]">
            {user.fullName
              .split(/\s+/)
              .slice(0, 2)
              .map(part => part[0]?.toUpperCase())
              .join("")}
          </span>
          <span className="truncate">{user.fullName}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          aria-label="Your profile"
          title="Your profile"
          onClick={onProfile}
        >
          <UserRound size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Log out"
          title="Log out"
          onClick={onLogout}
          disabled={isLoggingOut}
        >
          <LogOut size={16} />
        </Button>
      </div>
    </header>
  );
}
