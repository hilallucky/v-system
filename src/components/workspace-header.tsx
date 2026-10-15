import { Bell, CircleHelp, Database, LogOut, Search, UserRound } from "lucide-react";
import type { UserProfile } from "../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface WorkspaceHeaderProps {
  search: string;
  onSearchChange: (value: string) => void;
  onHelp: () => void;
  onNotifications: () => void;
  user: UserProfile;
  isLoggingOut: boolean;
  onProfile: () => void;
  onLogout: () => void;
}

export function WorkspaceHeader({
  search,
  onSearchChange,
  onHelp,
  onNotifications,
  user,
  isLoggingOut,
  onProfile,
  onLogout,
}: WorkspaceHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center border-b border-border bg-white px-5 sm:px-7">
      <a href="/" className="flex min-w-52 items-center gap-2.5 no-underline">
        <span className="grid size-9 place-items-center rounded-lg bg-[#244b91] text-white">
          <Database size={18} />
        </span>
        <span>
          <span className="block text-[13px] font-bold text-slate-800">Eskayvie Bank Content</span>
          <span className="block text-[10px] text-muted">Content workspace</span>
        </span>
      </a>
      <label className="relative ml-6 hidden w-full max-w-[410px] items-center sm:flex">
        <Search size={15} className="absolute left-3 text-slate-400" />
        <Input
          value={search}
          onChange={event => onSearchChange(event.target.value)}
          placeholder="Search files and folders"
          className="h-9 border-slate-200 bg-slate-50 pl-9"
          aria-label="Search files and folders"
        />
      </label>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Help" title="Help" onClick={onHelp}>
          <CircleHelp size={17} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          title="Notifications"
          onClick={onNotifications}
        >
          <Bell size={17} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="ml-1 hidden max-w-40 truncate sm:inline-flex"
          onClick={onProfile}
          title="Edit profile"
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-800">
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
