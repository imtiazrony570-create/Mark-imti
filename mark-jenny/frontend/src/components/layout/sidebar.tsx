"use client";

import {
  Settings,
  LayoutDashboard,
  Bot,
  Code2,
  Menu,
  PanelLeftClose,
  Sparkles,
  Globe,
  SearchIcon,
  Plus,
  FilePlus2,
  Library as LibraryIcon,
  LogOut,
  Pin,
  PinOff,
  Trash2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Check,
  X,
  CalendarClock,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactElement, useRef, useEffect } from "react";
import { quickActionsApi } from "@/lib/api/quickActions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth/auth-context";
import { setSearchOpen } from "@/lib/nav/search-store";
import { setSettingsOpen } from "@/lib/nav/settings-store";
import { CommandSearch } from "@/components/layout/command-search";
import { SettingsDialog } from "@/components/layout/SettingsDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Chat } from "@/lib/api/chat";
import type { Project } from "@/lib/api/projects";
import { projectsApi } from "@/lib/api/projects";
import { toast } from "@/components/ui/toast";

const BUCKETS = ["Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Older"] as const;

const AGENTS = [
  { id: "chat", label: "Imti", icon: Bot },
  { id: "work", label: "Mark", icon: Code2 },
  { id: "browse", label: "Browser", icon: Globe },
] as const;

const WORKSPACE_NAV = [
  // Library holds Mark's finished builds; Schedule belongs to Imti (chat)
  { href: "/library", label: "Library", icon: LibraryIcon, modes: ["chat", "work", "browse"] },
  { href: "/scheduled", label: "Scheduled", icon: CalendarClock, modes: ["chat", "browse"] },
  { href: "/skills", label: "Skills", icon: Sparkles, modes: ["chat", "work", "browse"] },
] as const;

const PIN_KEY = "mark.pinnedChats";
const PROJ_PIN_KEY = "mark.pinnedProjects";

function loadPinned(key: string): number[] {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}

function ProjectContextMenu({ onRename, onDelete, onTogglePin, isPinned }: {
  onRename: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  isPinned: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Project options"
          />
        }
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="right" sideOffset={4} className="w-44">
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }}>
          <Pencil className="h-3.5 w-3.5" /> Rename
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTogglePin(); }}>
          {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          {isPinned ? "Unpin" : "Pin"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-red-600 focus:text-red-600">
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function chatBucket(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "Older";
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.floor((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) return "Previous 7 days";
  if (diffDays <= 30) return "Previous 30 days";
  return "Older";
}

export interface SidebarChatData {
  mode: "chat" | "work" | "browse";
  onModeChange: (m: "chat" | "work" | "browse") => void;
  chats: Chat[];
  loadingChats: boolean;
  activeChatId: number | null;
  onSelectChat: (id: number) => void;
  onNewChat: () => void;
  pinned: number[];
  onTogglePin: (id: number) => void;
  onDelete: (c: Chat) => void;
  projects: Project[];
  projectId?: number;
  onSelectProject: (id: number | undefined) => void;
  onNewProject: () => void;
  browseSessions: { id: string; url?: string; status?: string; name?: string }[];
  onRenameProject?: (id: number, name: string) => void;
  onDeleteProject?: (id: number) => void;
}

export function Sidebar({ isOpen, onToggle, chatData }: { isOpen: boolean; onToggle: () => void; chatData?: SidebarChatData }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [localMode, setLocalMode] = useState<"chat" | "work" | "browse">(() => {
    try {
      const v = localStorage.getItem("mark.sidebarMode");
      return v === "work" || v === "browse" ? v : "chat";
    } catch {
      return "chat";
    }
  });
  const [pinnedProjects, setPinnedProjects] = useState<number[]>(() => loadPinned(PROJ_PIN_KEY));
  const [pinnedActionIds, setPinnedActionIds] = useState<string[]>([]);
  const [pinnedActions, setPinnedActions] = useState<import("@/lib/api/quickActions").QuickAction[]>([]);

  // Pinned quick actions — refresh whenever we land on a page (pins change on /quick-actions)
  useEffect(() => {
    let ids: string[] = [];
    try { ids = JSON.parse(localStorage.getItem("mark.pinnedQuickActions") || "[]"); } catch {}
    setPinnedActionIds(ids);
    if (ids.length > 0) {
      quickActionsApi.list().then((all) => {
        const byId = new Map(all.map((a) => [a.id, a]));
        setPinnedActions(ids.filter((id) => byId.has(id)).map((id) => byId.get(id)!));
      }).catch(() => {});
    } else {
      setPinnedActions([]);
    }
  }, [pathname]);

  const launchPinnedAction = (id: string) => {
    try { localStorage.setItem("mark.quickActionLaunch", id); } catch {}
    router.push("/quick-actions");
  };
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameText, setRenameText] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  const displayMode = chatData ? chatData.mode : localMode;

  const handleModeClick = (m: "chat" | "work" | "browse") => {
    setLocalMode(m);
    try { localStorage.setItem("mark.sidebarMode", m); } catch {}
    if (chatData) chatData.onModeChange(m);
    else router.push("/chat");
  };

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  const initials = user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";

  const displayName = () => {
    const n = (user?.full_name || "").trim();
    if (n) return n;
    const local = (user?.email || "").split("@")[0];
    return local || "User";
  };

  const toggleProjectPin = (id: number) => {
    setPinnedProjects((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      try { localStorage.setItem(PROJ_PIN_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const handleRenameStart = (p: Project) => {
    setRenamingId(p.id);
    setRenameText(p.name || "");
  };

  const handleRenameSave = async (id: number) => {
    if (!renameText.trim()) { setRenamingId(null); return; }
    try {
      await projectsApi.update(id, { name: renameText.trim() });
      chatData?.onRenameProject?.(id, renameText.trim());
      toast.add({ title: "Project renamed", type: "success" });
    } catch { toast.add({ title: "Rename failed", type: "error" }); }
    setRenamingId(null);
  };

  const handleDeleteConfirm = async (id: number) => {
    try {
      await projectsApi.delete(id);
      chatData?.onDeleteProject?.(id);
      toast.add({ title: "Project deleted", type: "success" });
    } catch { toast.add({ title: "Delete failed", type: "error" }); }
    setDeleteConfirmId(null);
  };

  const chatRow = (c: Chat) => (
    <div
      key={c.id}
      onClick={() => chatData!.onSelectChat(c.id)}
      className={cn(
        "group flex items-center justify-between rounded-lg p-2 cursor-pointer",
        chatData!.activeChatId === c.id
          ? "bg-zinc-900/5 dark:bg-white/10"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{c.title || "Untitled"}</p>
        <p className="truncate text-xs text-zinc-500">{c.last_message || `${c.message_count} msgs`}</p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); chatData!.onTogglePin(c.id); }}
          title={chatData!.pinned.includes(c.id) ? "Unpin" : "Pin"}
          className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
        >
          {chatData!.pinned.includes(c.id) ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); chatData!.onDelete(c); }}
          title="Delete"
          className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-red-500 dark:hover:bg-zinc-700"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );

  const projectRow = (p: Project) => (
    <div
      key={p.id}
      onClick={() => {
        if (renamingId !== p.id) {
          chatData?.onSelectProject(p.id);
          router.push(`/projects/${p.id}`);
        }
      }}
      className={cn(
        "group flex items-center justify-between rounded-lg p-2 cursor-pointer",
        chatData?.projectId === p.id
          ? "bg-zinc-900/5 dark:bg-white/10"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
      )}
    >
      <div className="min-w-0 flex-1">
        {renamingId === p.id ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Input
              ref={renameRef}
              value={renameText}
              onChange={(e) => setRenameText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSave(p.id);
                if (e.key === "Escape") setRenamingId(null);
              }}
              className="h-6 text-xs px-1.5"
            />
            <button onClick={() => handleRenameSave(p.id)} className="rounded p-0.5 text-green-600 hover:bg-green-100"><Check className="h-3 w-3" /></button>
            <button onClick={() => setRenamingId(null)} className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100"><X className="h-3 w-3" /></button>
          </div>
        ) : (
          <>
            <p className="truncate text-sm font-medium">{p.name || `Project #${p.id}`}</p>
            <p className="truncate text-xs text-zinc-500">
              {p.task_count && p.task_count > 0 ? `${p.task_count} tasks` : p.status || "No tasks yet"}
            </p>
          </>
        )}
      </div>
      {renamingId !== p.id && (
        <ProjectContextMenu
          onRename={() => handleRenameStart(p)}
          onDelete={() => setDeleteConfirmId(p.id)}
          onTogglePin={() => toggleProjectPin(p.id)}
          isPinned={pinnedProjects.includes(p.id)}
        />
      )}
    </div>
  );

  const bucketRows = <T,>(
    items: T[],
    pinnedMap: (t: T) => boolean,
    row: (t: T) => ReactElement
  ) => {
    return (
      <>
        {items.some(pinnedMap) && (
          <div>
            <p className="flex items-center gap-1 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              <Pin className="h-3 w-3" /> Pinned
            </p>
            <div className="space-y-0.5">{items.filter(pinnedMap).map(row)}</div>
          </div>
        )}
        {BUCKETS.map((b) => {
          const grouped = items.filter((c) => !pinnedMap(c) && chatBucket((c as unknown as Chat).created_at) === b);
          if (grouped.length === 0) return null;
          return (
            <div key={b}>
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{b}</p>
              <div className="space-y-0.5">{grouped.map(row)}</div>
            </div>
          );
        })}
      </>
    );
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen flex flex-col bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300 ease-in-out",
        isOpen ? "w-64" : "w-16"
      )}
    >
      {/* Row 1: Header — word mark | search | collapse */}
      <div className={cn("flex h-14 shrink-0 items-center border-b border-zinc-200 dark:border-zinc-800", isOpen ? "gap-2 pl-5 pr-3" : "px-2 justify-center")}>
        {isOpen ? (
          <>
            <button
              onClick={() => router.push("/")}
              className="min-w-0 flex-1 truncate text-left text-lg font-semibold tracking-tight text-zinc-900 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300"
              title="Go to Dashboard"
            >
              Mark-Imti
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              title="Search (Ctrl+K)"
            >
              <SearchIcon className="h-4 w-4" />
            </button>
            <button
              onClick={onToggle}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            onClick={onToggle}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            title="Expand sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
      </div>

      {isOpen ? (
        <div className="flex shrink-0 flex-col gap-2 px-3 pt-3">
          {/* Row 2: Agent toggle — fixed */}
          <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800/80">
            {AGENTS.map((a) => (
              <button
                key={a.id}
                onClick={() => handleModeClick(a.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                  displayMode === a.id
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                )}
                title={`${a.label} — ${a.id === "chat" ? "advanced chat" : a.id === "work" ? "code & app builder" : "web browser"}`}
              >
                <a.icon className="h-4 w-4" />
                {a.label}
              </button>
            ))}
          </div>

          {/* Row 3: Quick Action — always fixed */}
          <button
            onClick={() => router.push("/quick-actions")}
            className={cn(
              "flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium transition-colors",
              isActive("/quick-actions")
                ? "bg-zinc-900/5 text-zinc-900 dark:bg-white/10 dark:text-zinc-100"
                : "bg-zinc-900/5 text-zinc-900 hover:bg-zinc-900/10 dark:bg-white/10 dark:text-zinc-100 dark:hover:bg-white/15"
            )}
            title="Quick Actions"
          >
            <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Quick Action
          </button>
          {/* Pinned quick actions — added from Quick Actions page */}
          {pinnedActions.map((a) => (
            <button
              key={a.id}
              onClick={() => launchPinnedAction(a.id)}
              className="flex h-8 items-center gap-2 rounded-lg px-2.5 pl-8 text-[13px] text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors truncate"
              title={a.desc || a.label}
            >
              <Zap className="h-3.5 w-3.5 shrink-0 text-blue-500" />
              <span className="truncate">{a.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex shrink-0 flex-col items-center gap-1 pt-3">
          {AGENTS.map((a) => (
            <button
              key={a.id}
              onClick={() => handleModeClick(a.id)}
              className={cn(
                "rounded-lg p-2 transition-colors",
                displayMode === a.id
                  ? "bg-zinc-900/5 text-zinc-900 dark:bg-white/10 dark:text-white"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              )}
              title={a.label}
            >
              <a.icon className="h-4 w-4" />
            </button>
          ))}
          <button
            onClick={() => router.push("/quick-actions")}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Quick Actions"
          >
            <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </button>
        </div>
      )}

      {/* Workspace navigation — Projects only in Mark mode, Schedule only in Imti mode. */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {isOpen && (
          <div className="mb-3 flex flex-col gap-0.5 border-b border-zinc-200 pb-3 dark:border-zinc-800">
            {WORKSPACE_NAV.filter((item) => (item.modes as readonly string[]).includes(displayMode)).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={cn(
                    "flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm transition-colors",
                    isActive(item.href)
                      ? "bg-zinc-900/10 font-medium text-zinc-900 dark:bg-white/10 dark:text-zinc-100"
                      : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Below content — changes per agent toggle */}
        {chatData && isOpen && (
          chatData.mode === "chat" ? (
            <>
              <button
                onClick={() => chatData.onNewChat()}
                className="mb-2 flex h-9 w-full items-center gap-2 rounded-lg bg-zinc-900/5 px-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-900/10 dark:bg-white/10 dark:text-zinc-100 dark:hover:bg-white/15"
              >
                <Plus className="h-4 w-4" />
                New chat
              </button>
              {chatData.loadingChats ? (
                <div className="flex justify-center p-3"><Loader2 className="h-4 w-4 animate-spin text-zinc-400" /></div>
              ) : chatData.chats.length === 0 ? (
                <p className="px-3 py-1 text-xs text-zinc-400">No chats yet.</p>
              ) : (
                bucketRows(
                  chatData.chats,
                  (c) => chatData.pinned.includes(c.id),
                  chatRow
                )
              )}
            </>
          ) : chatData.mode === "work" ? (
            <>
              <button
                onClick={() => chatData.onNewProject()}
                className="mb-2 flex h-9 w-full items-center gap-2 rounded-lg bg-zinc-900/5 px-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-900/10 dark:bg-white/10 dark:text-zinc-100 dark:hover:bg-white/15"
              >
                <FilePlus2 className="h-4 w-4" />
                New project
              </button>
              {chatData.projects.length === 0 ? (
                <p className="px-3 py-1 text-xs text-zinc-400">No projects yet.</p>
              ) : (
                bucketRows(
                  chatData.projects,
                  (p) => pinnedProjects.includes(p.id),
                  projectRow
                )
              )}
              {/* Show project-related chats when a project is selected */}
              {chatData.projectId && (
                <div className="mt-3 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                  <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    Project Chats
                  </p>
                  {chatData.chats.filter((c) => (c as any).project_id === chatData.projectId).length === 0 ? (
                    <p className="px-3 py-1 text-xs text-zinc-400">No chats for this project yet.</p>
                  ) : (
                    <div className="space-y-0.5">
                      {chatData.chats
                        .filter((c) => (c as any).project_id === chatData.projectId)
                        .slice(0, 10)
                        .map(chatRow)}
                    </div>
                  )}
                  <button
                    onClick={() => chatData.onNewChat()}
                    className="mt-2 flex w-full items-center gap-2 rounded-lg p-2 text-left text-blue-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <Plus className="h-3.5 w-3.5" /> New chat in this project
                  </button>
                </div>
              )}
            </>
          ) : (
            chatData.browseSessions.length === 0 ? (
              <div className="px-3 py-3">
                <p className="text-sm font-medium">Browser</p>
                <p className="mt-1 text-xs text-zinc-500">Ask Mark to browse in Browser mode — live sessions appear here.</p>
              </div>
            ) : (
              <div>
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Browser Sessions</p>
                <div className="space-y-0.5">
                  {chatData.browseSessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => chatData?.onModeChange("browse")}
                      className="group flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <Globe className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{s.name || s.url || `Session ${s.id.slice(0, 8)}`}</p>
                        <p className="truncate text-xs text-zinc-500">{s.status || "Active"}</p>
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={() => chatData?.onModeChange("browse")}
                    className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-blue-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <Plus className="h-3.5 w-3.5" /> Open browser
                  </button>
                </div>
              </div>
            )
          )
        )}

        {!chatData && isOpen && (
          <p className="px-3 py-3 text-xs text-zinc-400">
            Open the chat to see chats, projects and sessions.
          </p>
        )}
      </nav>

      {/* Bottom: Profile icon only */}
      <div className="shrink-0 border-t border-zinc-200/70 dark:border-zinc-800 px-2 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                className={cn(
                  "group flex w-full items-center rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800",
                  isOpen ? "justify-start gap-2 px-3 py-2" : "justify-center p-2"
                )}
                title="Profile"
              />
            }
          >
            <Avatar className="h-7 w-7 text-xs">
              {user?.avatar_url ? (
                <AvatarImage src={user.avatar_url} alt={displayName()} />
              ) : (
                <AvatarFallback className="bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100">
                  {initials}
                </AvatarFallback>
              )}
            </Avatar>
            {isOpen && (
              <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
                {displayName()}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" sideOffset={6} className="w-60">
            <button
              onClick={() => router.push("/security")}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Open account options"
            >
              <Avatar className="h-9 w-9 shrink-0 text-xs">
                {user?.avatar_url ? (
                  <AvatarImage src={user.avatar_url} alt={displayName()} />
                ) : (
                  <AvatarFallback className="bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-100">
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{displayName()}</span>
                <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
              </span>
            </button>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
              <Settings />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/")}>
              <LayoutDashboard />
              Dashboard
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => logout()}
              className="text-red-600 focus:text-red-600"
            >
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandSearch />
      <SettingsDialog />

      {/* Delete project confirmation */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl p-5 max-w-sm w-full mx-4 space-y-3">
            <h3 className="text-base font-semibold">Delete project?</h3>
            <p className="text-sm text-zinc-500">This will permanently delete the project and its data. This cannot be undone.</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={() => handleDeleteConfirm(deleteConfirmId)}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
