"use client";

import { Plus, Grid, List, MoreHorizontal, FolderOpen, Copy, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback } from "react";
import { projectsApi, Project } from "@/lib/api/projects";
import { useRouter } from "next/navigation";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose,
} from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";

export function ProjectsTab() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await projectsApi.list({
        page,
        page_size: pageSize,
        search: searchQuery || undefined,
      });
      setProjects(response.projects);
      setTotal(response.total);
    } catch (err) {
      setError("Failed to load projects");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchQuery]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "RUNNING": return <Badge variant="default" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Running</Badge>;
      case "ACTIVE": return <Badge variant="default" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Active</Badge>;
      case "COMPLETED": return <Badge variant="default" className="bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400">Completed</Badge>;
      case "ARCHIVED": return <Badge variant="secondary">Archived</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleCreateProject = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const created = await projectsApi.create({ name: form.name.trim(), description: form.description.trim() || undefined });
      setShowForm(false); setForm({ name: "", description: "" }); fetchProjects();
      toast.add({ title: "Project created", description: created.name, type: "success" });
    } catch (e: any) {
      toast.add({ title: "Couldn't create project", description: e?.message || "Try again.", type: "error" });
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      const dup = await projectsApi.duplicate(id);
      toast.add({ title: "Project duplicated", description: dup.name, type: "success" });
      fetchProjects();
    } catch (err) {
      toast.add({ title: "Duplicate failed", type: "error" });
      console.error(err);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await projectsApi.delete(deleteTarget.id);
      fetchProjects();
      toast.add({ title: "Project deleted", type: "success" });
    } catch (err) {
      toast.add({ title: "Couldn't delete project", type: "error" });
      console.error(err);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
        <p className="mb-4 text-red-600">{error}</p>
        <Button onClick={fetchProjects}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={handleSearch}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setViewMode("grid")}>
            <Grid className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setViewMode("list")}>
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((project) => (
              <Card key={project.id} className="h-full">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 text-2xl">
                      {project.icon || "📁"}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/projects/view?projectId=${project.id}`)}><FolderOpen className="mr-2 h-4 w-4" />Open</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(project.id)}><Copy className="mr-2 h-4 w-4" />Duplicate</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600" onClick={() => setDeleteTarget(project)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <h3 className="font-semibold mb-1">{project.name}</h3>
                  <p className="text-sm text-zinc-500 mb-3 line-clamp-2">{project.description || "No description"}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {getStatusBadge(project.running_status || project.status)}
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm text-zinc-500 border-t pt-3">
                    <div>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{project.task_count}</span>
                      <span className="ml-1">Tasks</span>
                    </div>
                    <div>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{project.file_count}</span>
                      <span className="ml-1">Files</span>
                    </div>
                    <div>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{project.skill_count}</span>
                      <span className="ml-1">Skills</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="p-4 border-t flex items-center justify-between">
                  <span className="text-xs text-zinc-500">{formatDate(project.last_modified)}</span>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => router.push(`/projects/view?projectId=${project.id}`)} title="Open"><ExternalLink className="h-4 w-4" /></Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <Card key={project.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 text-xl">
                      {project.icon || "📁"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{project.name}</h3>
                        {getStatusBadge(project.running_status || project.status)}
                      </div>
                      <p className="text-sm text-zinc-500 truncate">{project.description || "No description"}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-zinc-500">
                      <span>{project.task_count} tasks</span>
                      <span>{project.file_count} files</span>
                      <span>{project.skill_count} skills</span>
                      <span>{formatDate(project.last_modified)}</span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/projects/view?projectId=${project.id}`)}><FolderOpen className="mr-2 h-4 w-4" />Open</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(project.id)}><Copy className="mr-2 h-4 w-4" />Duplicate</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600" onClick={() => setDeleteTarget(project)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {projects.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
            <p className="mb-4">No projects found</p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          </div>
        )}
        {total > pageSize && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
              Previous
            </Button>
            <span className="text-sm text-zinc-500">Page {page} of {Math.ceil(total / pageSize)}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))} disabled={page >= Math.ceil(total / pageSize)}>
              Next
            </Button>
          </div>
        )}
      </div>

      {/* New project */}
      <Sheet open={showForm} onOpenChange={(o) => { if (!o) setShowForm(false); }}>
        <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>New Project</SheetTitle>
            <SheetDescription>Give the project a name and let Mark know what it's about.</SheetDescription>
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
            <Button onClick={handleCreateProject} disabled={saving || !form.name.trim()}>
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
    </div>
  );
}

