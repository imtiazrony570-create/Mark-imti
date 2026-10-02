"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { SearchIcon, Settings, PanelRightClose, PanelRight, X, Plus, Pin, PinOff, MoreHorizontal, Pencil, Trash2, Globe, MonitorUp, ArrowLeft, ArrowRight, VolumeX, Volume2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { setSearchOpen } from "@/lib/nav/search-store";
import { setSettingsOpen } from "@/lib/nav/settings-store";
import { cn } from "@/lib/utils";

export interface Tab {
  id: number;
  title: string;
  active: boolean;
  pinned?: boolean;
  muted?: boolean;
}

export interface BrowserTab {
  id: string;
  title: string;
  active: boolean;
}

export function ChatTopBar({
  tabs,
  onTabSelect,
  onTabClose,
  onTabNew,
  rightPanelOpen,
  onToggleRightPanel,
  activeProjectName,
  isPinned,
  onTogglePin,
  onRenameTab,
  onDeleteTab,
  onToggleMute,
  onMoveTab,
  mode,
  browserSessions,
  onSelectBrowserSession,
  voiceActive,
  onScreenShare,
}: {
  tabs?: Tab[];
  onTabSelect?: (id: number) => void;
  onTabClose?: (id: number) => void;
  onTabNew?: () => void;
  rightPanelOpen?: boolean;
  onToggleRightPanel?: () => void;
  activeProjectName?: string;
  isPinned?: boolean;
  onTogglePin?: (id?: number) => void;
  onRenameTab?: (id: number, title: string) => void;
  onDeleteTab?: (id: number) => void;
  onToggleMute?: (id: number) => void;
  onMoveTab?: (id: number, direction: "left" | "right") => void;
  mode?: "chat" | "work" | "browse";
  browserSessions?: { id: string; url?: string; status?: string; name?: string }[];
  onSelectBrowserSession?: (id: string) => void;
  voiceActive?: boolean;
  onScreenShare?: () => void;
}) {
  const pathname = usePathname();
  const [hoveredTab, setHoveredTab] = useState<number | null>(null);
  const [menuTab, setMenuTab] = useState<number | null>(null);
  const [renamingTab, setRenamingTab] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const topBarRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu when clicking outside the top bar
  useEffect(() => {
    if (menuTab === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (topBarRef.current && !topBarRef.current.contains(e.target as Node)) {
        setMenuTab(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuTab]);

  const isBrowseMode = mode === "browse";

  const pinnedTabs = tabs?.filter((t) => t.pinned) || [];
  const unpinnedTabs = tabs?.filter((t) => !t.pinned) || [];

  const handleDragStart = useCallback((e: React.DragEvent, tabId: number) => {
    setDragId(tabId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, tabId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(tabId);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    if (dragId !== null && dragId !== targetId) {
      onMoveTab?.(dragId, "right");
    }
    setDragId(null);
    setDragOverId(null);
  }, [dragId, onMoveTab]);

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setDragOverId(null);
  }, []);

  const renderTab = (tab: Tab, index: number, total: number) => {
    const isHovered = hoveredTab === tab.id;
    const isMenuOpen = menuTab === tab.id;
    const isRenaming = renamingTab === tab.id;

    return (
      <div
        key={tab.id}
        onClick={() => onTabSelect?.(tab.id)}
        onMouseEnter={() => setHoveredTab(tab.id)}
        onMouseLeave={() => { if (menuTab !== tab.id) setHoveredTab(null); }}
        draggable={tab.pinned}
        onDragStart={(e) => tab.pinned && handleDragStart(e, tab.id)}
        onDragOver={(e) => tab.pinned && handleDragOver(e, tab.id)}
        onDrop={(e) => tab.pinned && handleDrop(e, tab.id)}
        onDragEnd={handleDragEnd}
        className={cn(
          "group relative flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium cursor-pointer transition-colors shrink-0 max-w-[180px]",
          tab.active
            ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
            : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50",
          dragOverId === tab.id && "border-t-2 border-blue-500"
        )}
        title={tab.title}
        style={{ overflow: "visible" }}
      >
        {tab.muted && <VolumeX className="h-2.5 w-2.5 text-orange-400 shrink-0" />}

        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => { onRenameTab?.(tab.id, renameValue); setRenamingTab(null); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { onRenameTab?.(tab.id, renameValue); setRenamingTab(null); }
              if (e.key === "Escape") setRenamingTab(null);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-24 bg-white dark:bg-zinc-800 border rounded px-1 py-0.5 text-xs outline-none"
          />
        ) : (
          <span className="truncate">{tab.title || "New session"}</span>
        )}

        {/* Tab actions — show on hover or when menu is open */}
        {(isHovered || isMenuOpen) && !isRenaming && (
          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {tab.pinned ? (
              /* Pinned tab: show only ⋮ (three dots) menu */
              <button
                onClick={() => setMenuTab(isMenuOpen ? null : tab.id)}
                className="rounded p-0.5 text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600 hover:text-zinc-700"
                title="Tab options"
              >
                <MoreHorizontal className="h-3 w-3" />
              </button>
            ) : (
              /* Unpinned tab: show ⋮ menu + X close */
              <>
                <button
                  onClick={() => setMenuTab(isMenuOpen ? null : tab.id)}
                  className="rounded p-0.5 text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600 hover:text-zinc-700"
                  title="More options"
                >
                  <MoreHorizontal className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onTabClose?.(tab.id)}
                  className="rounded p-0.5 text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600 hover:text-zinc-700"
                  title="Close tab"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        )}

        {/* Context dropdown menu */}
        {isMenuOpen && (
          <div className="absolute top-full left-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 z-[100] min-w-[150px]">
            {tab.pinned && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onMoveTab?.(tab.id, "left"); setMenuTab(null); }}
                  disabled={index === 0}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40"
                >
                  <ArrowLeft className="h-3 w-3" /> Move left
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onMoveTab?.(tab.id, "right"); setMenuTab(null); }}
                  disabled={index === total - 1}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40"
                >
                  <ArrowRight className="h-3 w-3" /> Move right
                </button>
                <div className="border-t border-zinc-200 dark:border-zinc-700 my-0.5" />
              </>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setRenamingTab(tab.id); setRenameValue(tab.title); setMenuTab(null); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              <Pencil className="h-3 w-3" /> Rename
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onTogglePin?.(tab.id); setMenuTab(null); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              {tab.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
              {tab.pinned ? "Unpin" : "Pin"}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleMute?.(tab.id); setMenuTab(null); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              {tab.muted ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
              {tab.muted ? "Unmute" : "Mute"}
            </button>
            {/* Close — hidden for pinned tabs (unpin first) */}
            {!tab.pinned && (
            <>
            <div className="border-t border-zinc-200 dark:border-zinc-700 my-0.5" />
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteTab?.(tab.id); setMenuTab(null); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-3 w-3" /> Close
            </button>
            </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <header ref={topBarRef} className="h-14 shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 backdrop-blur-sm dark:bg-zinc-900/80 sticky top-0 z-40 flex items-center gap-0.5 px-2" style={{ overflow: "visible" }}>
      {/* Session tabs — chat/work: show chat tabs, browse: show browser sessions */}
      <div className="flex items-center gap-0.5 flex-1 min-w-0" style={{ overflow: "visible" }}>
        {isBrowseMode ? (
          /* Browser sessions as tabs */
          <>
            {browserSessions?.map((session, idx) => {
              const isMenuOpen = menuTab === -1 - idx;
              const isHovered = hoveredTab === -1 - idx;
              const sid = String(session?.id ?? "");
              if (!sid) return null;
              return (
                <div
                  key={sid}
                  onMouseEnter={() => setHoveredTab(-1 - idx)}
                  onMouseLeave={() => { if (menuTab !== -1 - idx) setHoveredTab(null); }}
                  onClick={() => onSelectBrowserSession?.(sid)}
                  className={cn(
                    "group relative flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium cursor-pointer transition-colors shrink-0 max-w-[180px]",
                    "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                  )}
                  title={session.url || session.name || sid}
                  style={{ overflow: "visible" }}
                >
                  <Globe className="h-3 w-3 shrink-0 text-blue-500" />
                  <span className="truncate">{session.name || session.url?.replace(/https?:\/\//, "").split("/")[0] || `Session ${sid.slice(0, 8)}`}</span>
                  {(isHovered || isMenuOpen) && (
                    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setMenuTab(isMenuOpen ? null : -1 - idx)}
                        className="rounded p-0.5 text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600 hover:text-zinc-700"
                        title="Session options"
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  {isMenuOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 z-[100] min-w-[130px]">
                      <button onClick={(e) => { e.stopPropagation(); setMenuTab(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700">
                        <Pencil className="h-3 w-3" /> Rename
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setMenuTab(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700">
                        <Pin className="h-3 w-3" /> Pin
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setMenuTab(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700">
                        <VolumeX className="h-3 w-3" /> Mute
                      </button>
                      <div className="border-t border-zinc-200 dark:border-zinc-700 my-0.5" />
                      <button onClick={(e) => { e.stopPropagation(); setMenuTab(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                        <Trash2 className="h-3 w-3" /> Close
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {(!browserSessions || browserSessions.length === 0) && (
              <span className="text-xs text-zinc-400 px-2">No active browser sessions — click + to start</span>
            )}
          </>
        ) : (
          /* Chat tabs — pinned first, then unpinned */
          <>
            {pinnedTabs.map((tab, i) => renderTab(tab, i, pinnedTabs.length))}
            {pinnedTabs.length > 0 && unpinnedTabs.length > 0 && (
              <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />
            )}
            {unpinnedTabs.map((tab, i) => renderTab(tab, i, unpinnedTabs.length))}
          </>
        )}
        {!isBrowseMode && onTabNew && (
          <button
            onClick={onTabNew}
            className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
            title="New session (Ctrl+T)"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
        {isBrowseMode && onTabNew && (
          <button
            onClick={onTabNew}
            className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
            title="New browsing session"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Center: active project name — only in chat/work mode */}
      {!isBrowseMode && activeProjectName && (
        <div className="hidden md:flex items-center px-3 shrink-0">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate max-w-[200px]">{activeProjectName}</span>
        </div>
      )}

      {/* Right-side icons */}
      <div className="flex items-center gap-0.5 shrink-0">
        {voiceActive && onScreenShare && (
          <button
            onClick={onScreenShare}
            className="rounded-md p-1.5 text-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/30 animate-pulse"
            title="Share screen with voice agent"
          >
            <MonitorUp className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => setSearchOpen(true)}
          className={cn(
            "rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
            pathname === "/chat" && "text-blue-600"
          )}
          title="Search (Ctrl+K)"
        >
          <SearchIcon className="h-4 w-4" />
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className={cn(
            "rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
            pathname === "/settings" && "text-blue-600"
          )}
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
        <button
          onClick={onToggleRightPanel}
          className={cn(
            "rounded-md p-1.5 transition-colors",
            rightPanelOpen
              ? "text-blue-600 bg-blue-50 dark:bg-blue-900/30"
              : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          )}
          title={rightPanelOpen ? "Close agent panel" : "Open agent panel"}
        >
          {rightPanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
