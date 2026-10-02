"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar, SidebarChatData } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { ProjectWorkspace } from "@/components/project-workspace/project-workspace";
import { projectsApi, Project } from "@/lib/api/projects";
import { chatApi, Chat } from "@/lib/api/chat";
import { Button } from "@/components/ui/button";
import { Loader2, FolderKanban, Copy, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "@/components/ui/toast";

const PIN_KEY = "mark.pinnedChats";
function loadPinned(): number[] {
  try { return JSON.parse(localStorage.getItem(PIN_KEY) || "[]"); } catch { return []; }
}

export default function ProjectDetailPage() {
  const router = useRouter();
  const [id, setId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  // Sidebar data
  const [projects, setProjects] = useState<Project[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number[]>([]);
  const [mode, setMode] = useState<"chat" | "work" | "browse">(() => {
    try { return (localStorage.getItem("mark.sidebarMode") as any) || "chat"; } catch { return "chat"; }
  });

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("projectId");
    const parsed = raw ? Number(raw) : NaN;
    setId(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
  }, []);

  const fetchProject = useCallback(async () => {
    if (!id || Number.isNaN(id)) { setLoading(false); return; }
    setLoading(true);
    try { setProject(await projectsApi.get(id)); } catch { setProject(null); } finally { setLoading(false); }
  }, [id]);

  const fetchProjects = useCallback(async () => {
    try { const r = await projectsApi.list({ page_size: 100 }); setProjects(r.projects); } catch {}
  }, []);

  const fetchChats = useCallback(async () => {
    setLoadingChats(true);
    try {
      const res = await chatApi.list({ page: 1, page_size: 50 });
      setChats(res.chats);
      setPinned(loadPinned());
      if (res.chats.length && !activeChatId) setActiveChatId(res.chats[0].id);
    } catch {} finally { setLoadingChats(false); }
  }, [activeChatId]);

  useEffect(() => { if (id) { fetchProject(); fetchProjects(); fetchChats(); } }, [id, fetchProject, fetchProjects, fetchChats]);
  useEffect(() => { try { localStorage.setItem("mark.sidebarMode", mode); } catch {} }, [mode]);

  const handleNewChat = useCallback(async () => {
    if (!id) return;
    try {
      const c = await chatApi.create({ project_id: id });
      setChats((prev) => [c, ...prev]);
      setActiveChatId(c.id);
      router.push("/chat");
    } catch { toast.add({ title: "Couldn't create chat", type: "error" }); }
  }, [id, router]);

  const handleNewProject = useCallback(async () => {
    try {
      const p = await projectsApi.create({ name: "New project" });
      fetchProjects();
      router.push(`/projects/view?projectId=${p.id}`);
    } catch { toast.add({ title: "Couldn't create project", type: "error" }); }
  }, [fetchProjects, router]);

  const handleDuplicate = async () => {
    if (!id) return;
    try {
      const dup = await projectsApi.duplicate(id);
      toast.add({ title: "Project duplicated", description: dup.name, type: "success" });
      fetchProject();
    } catch { toast.add({ title: "Duplicate failed", type: "error" }); }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await projectsApi.delete(id);
      toast.add({ title: "Project deleted", type: "success" });
      router.push("/projects");
    } catch { toast.add({ title: "Couldn't delete project", type: "error" }); }
  };

  const chatData: SidebarChatData = {
    mode,
    onModeChange: (m) => { setMode(m); router.push("/chat"); },
    chats,
    loadingChats,
    activeChatId,
    onSelectChat: (chatId) => { setActiveChatId(chatId); router.push("/chat"); },
    onNewChat: handleNewChat,
    pinned,
    onTogglePin: (id) => {
      setPinned((prev) => {
        const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
        localStorage.setItem(PIN_KEY, JSON.stringify(next));
        return next;
      });
    },
    onDelete: (c) => {
      chatApi.delete(c.id).then(() => setChats((prev) => prev.filter((ch) => ch.id !== c.id)));
    },
    projects,
    projectId: id || undefined,
    onSelectProject: (pid) => { if (pid) router.push(`/projects/view?projectId=${pid}`); },
    onNewProject: handleNewProject,
    browseSessions: [],
    onRenameProject: (pid, name) => setProjects((prev) => prev.map((p) => p.id === pid ? { ...p, name } : p)),
    onDeleteProject: (pid) => {
      setProjects((prev) => prev.filter((p) => p.id !== pid));
      router.push("/projects");
    },
  };

  return (
    <ProtectedLayout>
      <div className="h-dvh overflow-hidden bg-zinc-50 dark:bg-zinc-950 flex">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} chatData={chatData} />
        <div className={`flex-1 flex flex-col min-w-0 transition-all ${sidebarOpen ? "ml-64" : "ml-16"}`}>
          {/* Top bar with project name */}
          <header className="h-14 shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 backdrop-blur-sm dark:bg-zinc-900/80 sticky top-0 z-40 flex items-center px-4 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-600">
                <FolderKanban className="h-3.5 w-3.5 text-white" />
              </div>
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
              ) : project ? (
                <span className="truncate text-sm font-medium">{project.name}</span>
              ) : (
                <span className="text-sm text-zinc-400">Project not found</span>
              )}
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleDuplicate}>
                <Copy className="mr-1 h-3 w-3" /> Duplicate
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500 hover:text-red-600" onClick={handleDelete}>
                <Trash2 className="mr-1 h-3 w-3" /> Delete
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <div className="px-6 py-4">
              {loading ? (
                <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : !project ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FolderKanban className="h-12 w-12 mb-3 text-zinc-300 dark:text-zinc-700" />
                  <p className="text-lg font-medium">Project not found</p>
                  <p className="text-sm text-zinc-500">It may have been deleted, or you don&apos;t have access.</p>
                  <Button className="mt-4" variant="outline" onClick={() => router.push("/projects")}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to projects
                  </Button>
                </div>
              ) : (
                id ? <ProjectWorkspace projectId={id} /> : null
              )}
            </div>
          </main>
        </div>
      </div>
    </ProtectedLayout>
  );
}
