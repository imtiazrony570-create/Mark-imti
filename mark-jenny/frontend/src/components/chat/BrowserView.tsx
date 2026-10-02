"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Globe, MessageSquare, Loader2, ExternalLink, RefreshCw,
  ArrowLeft, ArrowRight, Star, Share2, Download,
  MoreHorizontal, Plus, X, Search, Shield, Bookmark, Code, Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/api/chat";
import { ChatInput } from "@/components/chat/ChatInput";
import { browserApi } from "@/lib/api/browser";

interface BrowserViewProps {
  messages: Message[];
  sessions: { id: string; url?: string; status?: string; name?: string }[];
  onSend: (text: string) => void;
  sending: boolean;
  activeChatId: number | null;
  onFile: (file: File) => void;
  onVoiceAsk?: (text: string) => Promise<string | null>;
}

interface BrowserTab {
  id: string;
  title: string;
  url: string;
}

function extractBrowserUrl(messages: Message[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "ASSISTANT" && msg.content) {
      const urlMatch = msg.content.match(/https?:\/\/[^\s\)]+/);
      if (urlMatch) return urlMatch[0];
    }
  }
  return null;
}

export function BrowserView({ messages, sessions, onSend, sending, activeChatId, onFile, onVoiceAsk }: BrowserViewProps) {
  const [chatWidth, setChatWidth] = useState(45);
  const draggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const browserUrl = extractBrowserUrl(messages);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [browserSessionId, setBrowserSessionId] = useState<string | null>(null);
  const [browserStatus, setBrowserStatus] = useState("Connecting to browser...");

  const [browserTabs, setBrowserTabs] = useState<BrowserTab[]>([
    { id: "1", title: "New Tab", url: "" }
  ]);
  const [activeBrowserTab, setActiveBrowserTab] = useState("1");
  const [urlInput, setUrlInput] = useState("");
  const [bookmarked, setBookmarked] = useState(false);
  const [showDevtools, setShowDevtools] = useState(false);

  const toggleBookmark = () => {
    if (!currentUrl) return;
    setBookmarked((prev) => {
      let saved: string[] = [];
      try { saved = JSON.parse(localStorage.getItem("mark.imti.bookmarks") || "[]"); } catch { saved = []; }
      if (!Array.isArray(saved)) saved = [];
      saved = prev ? saved.filter((u) => u !== currentUrl) : [...new Set([...saved, currentUrl])];
      try { localStorage.setItem("mark.imti.bookmarks", JSON.stringify(saved)); } catch { /* quota */ }
      return !prev;
    });
  };

  const currentUrl = browserTabs.find((t) => t.id === activeBrowserTab)?.url || browserUrl || "";

  useEffect(() => {
    let cancelled = false;
    browserApi.createSession(false)
      .then(({ session_id }) => {
        if (!cancelled) {
          setBrowserSessionId(session_id);
          setBrowserStatus("Browser automation ready");
        }
      })
      .catch(() => {
        if (!cancelled) setBrowserStatus("Embedded preview mode");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const navigateTo = useCallback((url: string) => {
    let finalUrl = url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      finalUrl = "https://" + url;
    }
    setBrowserTabs((prev) => prev.map((t) => t.id === activeBrowserTab ? { ...t, url: finalUrl, title: finalUrl.replace(/https?:\/\//, "").split("/")[0] } : t));
    setUrlInput(finalUrl);
    if (browserSessionId) {
      browserApi.navigate({ url: finalUrl, session_id: browserSessionId })
        .then((result) => setBrowserStatus(result.success ? "Page loaded in automation session" : "Page opened in embedded preview"))
        .catch(() => setBrowserStatus("Page opened in embedded preview"));
    }
  }, [activeBrowserTab, browserSessionId]);

  const addTab = useCallback(() => {
    const id = Date.now().toString();
    setBrowserTabs((prev) => [...prev, { id, title: "New Tab", url: "" }]);
    setActiveBrowserTab(id);
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setBrowserTabs((prev) => {
      const next = prev.filter((t) => t.id !== tabId);
      if (next.length === 0) {
        const id = Date.now().toString();
        setActiveBrowserTab(id);
        return [{ id, title: "New Tab", url: "" }];
      }
      if (activeBrowserTab === tabId) {
        setActiveBrowserTab(next[next.length - 1].id);
      }
      return next;
    });
  }, [activeBrowserTab]);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const onMove = (ev: MouseEvent) => {
      const x = ev.clientX - rect.left;
      const pct = (x / rect.width) * 100;
      setChatWidth(Math.min(80, Math.max(20, pct)));
    };
    const onUp = () => {
      draggingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  // Bookmarks are real and persisted per browser profile.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("mark.imti.bookmarks") || "[]");
      setBookmarked(Array.isArray(saved) && !!currentUrl && saved.includes(currentUrl));
    } catch { /* ignore malformed storage */ }
  }, [currentUrl]);

  return (
    <div ref={containerRef} className="flex-1 flex min-h-0">
      {/* Left: chat with agent */}
      <div className="flex flex-col min-w-0" style={{ width: `${chatWidth}%` }}>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Globe className="h-8 w-8 text-zinc-300 dark:text-zinc-700 mb-2" />
              <p className="text-sm font-medium text-zinc-500">What should I browse?</p>
              <p className="text-xs text-zinc-400 mt-1">Tell me a website to open or a topic to research</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={cn("flex", msg.role === "USER" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm", msg.role === "USER" ? "bg-sky-700 dark:bg-sky-700 text-white shadow-sm shadow-sky-700/25" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100")}>
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="shrink-0 border-t">
          <ChatInput onSend={onSend} onFile={onFile} disabled={sending || !activeChatId} mode="browse" onVoiceAsk={onVoiceAsk} />
        </div>
      </div>

      {/* Draggable divider */}
      <div onMouseDown={startDrag} className="w-1.5 cursor-col-resize hover:bg-blue-400 bg-zinc-200 dark:bg-zinc-700 shrink-0 transition-colors" title="Drag to resize" />

      {/* Right: real browser */}
      <div className="flex flex-col min-w-0" style={{ width: `${100 - chatWidth}%` }}>
        {/* Browser tabs bar */}
        <div className="h-8 shrink-0 bg-zinc-100 dark:bg-zinc-800 flex items-end gap-0.5 px-1 overflow-x-auto scrollbar-none">
          {browserTabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveBrowserTab(tab.id)}
              className={cn(
                "group flex items-center gap-1.5 rounded-t-lg px-2.5 py-1 text-[11px] cursor-pointer max-w-[160px] shrink-0 border-b-2 transition-colors",
                tab.id === activeBrowserTab
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-blue-500"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 border-transparent"
              )}
            >
              <Globe className="h-3 w-3 shrink-0" />
              <span className="truncate flex-1">{tab.title}</span>
              <button onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }} className="shrink-0 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-opacity">
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
          <button onClick={addTab} className="shrink-0 rounded-t-lg p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors" title="New tab">
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {/* Browser toolbar */}
        <div className="h-10 shrink-0 bg-white dark:bg-zinc-900 border-b flex items-center gap-1 px-2">
          <span className="text-[10px] text-zinc-400 truncate max-w-[150px]" title={browserStatus}>{browserStatus}</span>
          {/* Nav buttons */}
          <button onClick={() => { try { iframeRef.current?.contentWindow?.history.back(); setBrowserStatus("Navigating back"); } catch { setBrowserStatus("Back navigation unavailable for this page"); } }} className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors" title="Back">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button onClick={() => { try { iframeRef.current?.contentWindow?.history.forward(); setBrowserStatus("Navigating forward"); } catch { setBrowserStatus("Forward navigation unavailable for this page"); } }} className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors" title="Forward">
            <ArrowRight className="h-4 w-4" />
          </button>
          <button onClick={() => {
            iframeRef.current?.contentWindow?.location.reload();
            if (browserSessionId && currentUrl) {
              browserApi.navigate({ url: currentUrl, session_id: browserSessionId }).catch(() => undefined);
            }
          }} className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>

          {/* URL bar */}
          <div className="flex-1 flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2.5 py-1 mx-1">
            <Shield className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
            <input
              type="text"
              value={urlInput || currentUrl}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && urlInput) navigateTo(urlInput); }}
              placeholder="Search or enter URL"
              className="flex-1 bg-transparent text-xs text-zinc-700 dark:text-zinc-300 outline-none placeholder:text-zinc-400"
            />
            {urlInput && (
              <button onClick={() => navigateTo(urlInput)} className="shrink-0 text-zinc-400 hover:text-blue-500">
                <Search className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Action buttons */}
          <button onClick={toggleBookmark} className={cn("p-1.5 rounded-md transition-colors", bookmarked ? "text-yellow-500" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200")} title={bookmarked ? "Remove bookmark" : "Bookmark this page"}>
            <Star className={cn("h-4 w-4", bookmarked && "fill-current")} />
          </button>
          <button onClick={() => { if (currentUrl) navigator.clipboard.writeText(currentUrl).catch(() => undefined); }} className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors" title="Copy link">
            <Copy className="h-4 w-4" />
          </button>
          <button onClick={() => { if (currentUrl) window.open(currentUrl, "_blank"); }} className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors" title="Open in new window">
            <ExternalLink className="h-4 w-4" />
          </button>
          <button
            onClick={async () => {
              if (!currentUrl) return;
              // A cross-origin iframe cannot be downloaded directly, so fetch
              // the page through the backend and save that.
              try {
                const res = await fetch(`/api/v1/browser/fetch?url=${encodeURIComponent(currentUrl)}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = currentUrl.replace(/^https?:\/\//, "").replace(/[^\w.-]+/g, "_") || "page.html";
                a.click();
                URL.revokeObjectURL(a.href);
              } catch {
                toast.add({
                  title: "Download blocked",
                  description: "This site does not allow automated downloads. Use 'Open in new window' and save it manually.",
                  type: "error",
                });
              }
            }}
            className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
            title="Download this page"
          >
            <Download className="h-4 w-4" />
          </button>
          <button onClick={() => setShowDevtools(!showDevtools)} className={cn("p-1.5 rounded-md transition-colors", showDevtools ? "text-blue-500 bg-blue-50 dark:bg-blue-900/30" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200")} title="Page details">
            <Code className="h-4 w-4" />
          </button>
        </div>

        {/* Browser content */}
        <div className="flex-1 min-h-0 bg-white dark:bg-zinc-950 relative">
          {currentUrl ? (
            <iframe ref={iframeRef} src={currentUrl} className="w-full h-full border-0" title="Browser view" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads" />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Globe className="h-12 w-12 text-zinc-200 dark:text-zinc-800 mb-3" />
              <p className="text-sm font-medium text-zinc-400">New Tab</p>
              <p className="text-xs text-zinc-300 mt-1">Search or enter a URL to start browsing</p>
            </div>
          )}

          {/* DevTools panel */}
          {showDevtools && currentUrl && (
            <div className="absolute bottom-0 left-0 right-0 h-48 bg-zinc-900 border-t border-zinc-700 overflow-auto p-3 font-mono text-xs text-zinc-300">
              <div className="flex items-center gap-2 mb-2">
                <Code className="h-3 w-3 text-green-400" />
                <span className="text-green-400 font-semibold">DevTools</span>
                <button onClick={() => setShowDevtools(false)} className="ml-auto text-zinc-500 hover:text-zinc-300"><X className="h-3 w-3" /></button>
              </div>
              <div className="space-y-1 text-[11px]">
                <p><span className="text-zinc-500">URL:</span> <span className="text-blue-400 break-all">{currentUrl}</span></p>
                <p><span className="text-zinc-500">Rendered:</span> <span className="text-green-400">in an embedded frame</span></p>
                <p><span className="text-zinc-500">Session:</span> <span className="text-zinc-400">{sessions[0]?.id?.slice(0, 12) || "None"}</span></p>
                <p className="text-zinc-500 mt-2">
                  This panel shows what Mark-Imti knows about the page. Live DevTools, console logs and
                  the DOM require the desktop app or a Playwright session - a cross-origin frame cannot
                  expose them.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
