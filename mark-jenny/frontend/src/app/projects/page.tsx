"use client";
import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { projectsApi, Project } from "@/lib/api/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FolderKanban, Loader2, Trash2, Copy, ExternalLink, ArrowRight } from "lucide-react";
import Link from "next/link";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose,
} from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";

export default function ProjectsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await projectsApi.list({ search: search || undefined, page_size: 50 });
      setProjects(res.projects);
    } catch {} finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const created = await projectsApi.create({ name: form.name.trim(), description: form.description.trim() || undefined });
      setShowForm(false); setForm({ name: "", description: "" }); fetchProjects();
      toast.add({
        title: "Project created",
        description: created.name,
        type: "success",
        actionProps: { children: "Open", onClick: () => { window.location.href = `/projects/view?projectId=${created.id}`; } },
      });
    } catch (e: any) {
      toast.add({ title: "Couldn't create project", description: e?.message || "Try again.", type: "error" });
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await projectsApi.delete(deleteTarget.id);
      fetchProjects();
      toast.add({ title: "Project deleted", type: "success" });
    } catch {
      toast.add({ title: "Couldn't delete project", type: "error" });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleDuplicate = async (p: Project) => {
    try {
      const dup = await projectsApi.duplicate(p.id);
      toast.add({ title: "Project duplicated", description: dup.name, type: "success" });
      fetchProjects();
    } catch { toast.add({ title: "Duplicate failed", type: "error" }); }
  };

  return (
    <ProtectedLayout>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className={`flex-1 flex flex-col min-w-0 transition-all ${sidebarOpen ? "ml-64" : "ml-16"}`}>
          <Header />
          <main className="flex-1 p-6 overflow-auto">
            <div className="mx-auto max-w-5xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
                  <p className="text-sm text-zinc-500">{projects.length} projects · Mark auto-creates these as you build</p>
                </div>
                <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />New Project</Button>
              </div>

              <div className="mb-4 max-w-md relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                <Input placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
              </div>

              {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : projects.length === 0 ? (
                <Card className="p-8 flex flex-col items-center justify-center text-center">
                  <FolderKanban className="h-12 w-12 mx-auto mb-3 text-zinc-300 dark:text-zinc-700" />
                  <p className="mb-1 font-medium">No projects yet</p>
                  <p className="mb-4 text-sm text-zinc-500">Ask Mark to build something in Chat, or create one now.</p>
                  <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />Create Project</Button>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {projects.map(p => (
                    <Card key={p.id} className="transition-shadow hover:shadow-md">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <Link href={`/projects/view?projectId=${p.id}`} className="group flex items-center gap-1 font-medium hover:text-blue-600">
                            {p.name} <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                          </Link>
                          <Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge>
                        </div>
                        {p.description && <p className="text-sm text-zinc-500 line-clamp-2 mb-3">{p.description}</p>}
                        <div className="flex gap-3 text-xs text-zinc-400 mb-3">
                          <span>{p.task_count} tasks</span>
                          <span>{p.file_count} files</span>
                          <span>{p.skill_count} skills</span>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleDuplicate(p)} title="Duplicate"><Copy className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(p)} title="Delete"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* New project */}
      <Sheet open={showForm} onOpenChange={(o) => { if (!o) setShowForm(false); }}>
        <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>New Project</SheetTitle>
            <SheetDescription>Projects are folders Mark uses to keep builds, files, and skills organized.</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Marketing website" autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What is this project about?" />
            </div>
          </div>
          <SheetFooter>
            <SheetClose render={<Button variant="outline" />}>Cancel</SheetClose>
            <Button onClick={handleCreate} disabled={saving || !form.name.trim()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Create
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <Sheet open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Delete this project?</SheetTitle>
            <SheetDescription>“{deleteTarget?.name || "Project"}” will be permanently removed with its tasks and files.</SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <SheetClose render={<Button variant="outline" />}>Cancel</SheetClose>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ProtectedLayout>
  );
}


