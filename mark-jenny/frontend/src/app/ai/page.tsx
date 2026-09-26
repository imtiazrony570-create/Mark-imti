"use client";
import { useState, useEffect, useMemo } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ProtectedLayout } from "@/components/layout/protected-layout";
import { modelsApi, AIModel, ProviderConfig, Agent, ProviderCatalogEntry } from "@/lib/api/models";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cpu, Key, Bot, CheckCircle2, AlertCircle, Loader2, Zap, DollarSign, Eye, EyeOff, ExternalLink } from "lucide-react";
import { toast } from "@/components/ui/toast";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose,
} from "@/components/ui/sheet";

// Provider list is loaded from the backend catalogue (GET /ai/providers/catalog)
// so newly supported providers appear without a frontend release.
const FALLBACK_PROVIDERS = [
  { id: "GOOGLE", name: "Google AI (Gemini)", models: "", color: "bg-blue-100 text-blue-700", url: "https://aistudio.google.com/apikey", desc: "Free tier. Gemini models with vision." },
  { id: "OPENROUTER", name: "OpenRouter", models: "", color: "bg-cyan-100 text-cyan-700", url: "https://openrouter.ai/keys", desc: "One key, hundreds of models. ':free' models are free." },
  { id: "OLLAMA", name: "Ollama (Local)", models: "", color: "bg-purple-100 text-purple-700", url: "https://ollama.ai", desc: "Runs on your machine. No key, no cost." },
];

export default function AIPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("providers");
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Record<string, string>>({});
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<ProviderCatalogEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modelFilter, setModelFilter] = useState("");

  // Build the renderable provider list from the backend catalogue.
  const PROVIDERS = useMemo(() => {
    if (!catalog.length) return FALLBACK_PROVIDERS;
    const palette = [
      "bg-green-100 text-green-700", "bg-orange-100 text-orange-700",
      "bg-blue-100 text-blue-700", "bg-cyan-100 text-cyan-700",
      "bg-purple-100 text-purple-700", "bg-red-100 text-red-700",
      "bg-indigo-100 text-indigo-700", "bg-teal-100 text-teal-700",
      "bg-pink-100 text-pink-700", "bg-amber-100 text-amber-700",
    ];
    const base = catalog.map((c, i) => ({
      id: c.provider,
      name: c.label,
      models: "",
      color: palette[i % palette.length],
      url: c.signup_url || "#",
      desc: c.note,
      free: c.free_tier,
    }));
    // Put Together AI first as the recommended default (free tier, vision + code + reasoning)
    return base.sort((a, b) => (a.id === "TOGETHER" ? -1 : b.id === "TOGETHER" ? 1 : 0));
  }, [catalog]);

  const handleRefreshModels = async () => {
    setRefreshing(true);
    try {
      const r = await modelsApi.refreshModels();
      const m = await modelsApi.listModels();
      setModels(m);
      const found = Object.entries(r?.report?.providers || {})
        .map(([k, v]: any) => `${k}: ${v.found}`).join(", ");
      toast.add({
        title: "Model list refreshed",
        description: `${r?.total_models ?? m.length} models available. ${found || "No providers connected yet."}`,
        type: "success",
      });
    } catch (e: any) {
      toast.add({ title: "Refresh failed", description: e?.message || "", type: "error" });
    } finally { setRefreshing(false); }
  };

  const visibleModels = useMemo(() => {
    const q = modelFilter.trim().toLowerCase();
    const list = q
      ? models.filter((m) => `${m.provider} ${m.model_id} ${m.display_name || ""}`.toLowerCase().includes(q))
      : models;
    return [...list].sort((a, b) => {
      const af = (a.config as any)?.free ? 0 : 1;
      const bf = (b.config as any)?.free ? 0 : 1;
      if (af !== bf) return af - bf;
      return a.provider.localeCompare(b.provider) || a.model_id.localeCompare(b.model_id);
    });
  }, [models, modelFilter]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [p, m] = await Promise.all([modelsApi.listProviders(), modelsApi.listModels()]);
        setProviders(p);
        setModels(m);
      } catch {} finally { setLoading(false); }
      // Agents come from the database, never a hardcoded list.
      try {
        setAgents(await modelsApi.listAgents());
        setAgentsError(null);
      } catch (e: any) {
        setAgents([]);
        setAgentsError(e?.message || "request failed");
      }
      // Provider catalogue (free-tier flags, signup links) from the backend.
      try {
        const c = await modelsApi.providerCatalog();
        setCatalog(c.providers || []);
      } catch { setCatalog([]); }
    })();
  }, []);

  const isConfigured = (providerId: string) => providers.some(p => p.provider === providerId && p.has_key);

  const handleSave = async (providerId: string) => {
    const key = keys[providerId];
    if (!key?.trim()) { toast.add({ title: "Enter an API key first", type: "error" }); return; }
    setSaving(providerId);
    try {
      // Prove the key works before claiming it is connected.
      const test = await modelsApi.testProvider({ provider: providerId as any, api_key: key, base_url: urls[providerId] || undefined, model: selectedModel[providerId] || undefined });
      if (!test?.ok) {
        toast.add({ title: `${providerId} key rejected`, description: test?.detail || "Provider refused the key.", type: "error" });
        return;
      }
      await modelsApi.upsertProvider({
        provider: providerId as any,
        api_key: key,
        base_url: urls[providerId] || undefined,
        config: selectedModel[providerId] ? { model: selectedModel[providerId] } : undefined,
        is_default: true,
      });
      setKeys(prev => ({ ...prev, [providerId]: "" }));
      const p = await modelsApi.listProviders();
      setProviders(p);
      toast.add({ title: "Provider connected", description: `${providerId} verified successfully.`, type: "success" });
    } catch (e: any) { toast.add({ title: "Couldn't save key", description: e?.message || "Try again.", type: "error" }); } finally { setSaving(null); }
  };

  const handleSelectModel = async (providerId: string, modelId: string) => {
    setSelectedModel(prev => ({ ...prev, [providerId]: modelId }));
    try {
      await modelsApi.selectModel(providerId as any, modelId);
      const p = await modelsApi.listProviders();
      setProviders(p);
      toast.add({ title: "Model selected", description: `${modelId} is now the default for ${providerId}.`, type: "success" });
    } catch (e: any) { toast.add({ title: "Couldn't set model", description: e?.message || "Try again.", type: "error" }); }
  };

  const handleReTest = async (providerId: string) => {
    setSaving(providerId);
    try {
      const test = await modelsApi.testProvider({ provider: providerId as any, model: selectedModel[providerId] || undefined });
      toast.add({
        title: test?.ok ? `${providerId} reachable` : `${providerId} problem`,
        description: test?.detail,
        type: test?.ok ? "success" : "error",
      });
    } catch (e: any) { toast.add({ title: "Test failed", description: e?.message || "", type: "error" }); } finally { setSaving(null); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await modelsApi.deleteProvider(deleteTarget);
      const p = await modelsApi.listProviders();
      setProviders(p);
      toast.add({ title: "Provider removed", description: deleteTarget, type: "success" });
    } catch (e: any) { toast.add({ title: "Couldn't remove provider", description: e?.message || "Try again.", type: "error" }); } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <ProtectedLayout>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div className={`flex-1 flex flex-col min-w-0 transition-all ${sidebarOpen ? "ml-64" : "ml-16"}`}>
          <Header />
          <main className="flex-1 p-6 overflow-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold flex items-center gap-2"><Cpu className="h-6 w-6" /> AI Models</h1>
              <p className="text-sm text-zinc-500">Add your API keys below. MARK automatically picks the best model for each task.</p>
            </div>

            <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-3 mb-6 h-auto">
                <TabsTrigger value="providers"><Key className="mr-1 h-3 w-3" />API Keys</TabsTrigger>
                <TabsTrigger value="models"><Cpu className="mr-1 h-3 w-3" />Models ({models.length})</TabsTrigger>
                <TabsTrigger value="agents"><Bot className="mr-1 h-3 w-3" />Agents</TabsTrigger>
              </TabsList>

              <TabsContent value="providers" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PROVIDERS.map(prov => {
                    const configured = isConfigured(prov.id);
                    return (
                      <Card key={prov.id} className={`transition-all ${configured ? "ring-2 ring-green-500/30" : ""}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${prov.color}`}>{prov.name}</span>
                              {(prov as any).free && <Badge className="bg-emerald-600 text-[10px]">FREE TIER</Badge>}
                              {configured && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                            </CardTitle>
                            {configured ? (
                              <Badge variant="default" className="bg-green-600">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Not set</Badge>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500 mt-1">{prov.desc}</p>
                          <p className="text-xs text-zinc-400">Models: {prov.models}</p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <label className="text-xs font-medium text-zinc-600">
                              {prov.id === "OLLAMA" ? "Base URL (default: http://localhost:11434)" : "API Key"}
                            </label>
                            {prov.id === "OLLAMA" ? (
                              <Input
                                type="text"
                                value={urls[prov.id] || "http://localhost:11434"}
                                onChange={e => setUrls(prev => ({ ...prev, [prov.id]: e.target.value }))}
                                placeholder="http://localhost:11434"
                                className="mt-1"
                              />
                            ) : (
                              <div className="relative mt-1">
                                <Input
                                  type={showKeys[prov.id] ? "text" : "password"}
                                  value={keys[prov.id] || ""}
                                  onChange={e => setKeys(prev => ({ ...prev, [prov.id]: e.target.value }))}
                                  placeholder={configured ? "•••••••• (key saved)" : "sk-... or your API key"}
                                  className="pr-10"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowKeys(prev => ({ ...prev, [prov.id]: !prev[prov.id] }))}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                                >
                                  {showKeys[prov.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                            )}
                          </div>
                          {(() => {
                            const provModels = models.filter(m => m.provider === prov.id);
                            if (!provModels.length) return null;
                            return (
                              <div>
                                <label className="text-xs font-medium text-zinc-600">Model used for {prov.name}</label>
                                <select
                                  value={selectedModel[prov.id] || ""}
                                  onChange={e => handleSelectModel(prov.id, e.target.value)}
                                  className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
                                >
                                  <option value="">Automatic (provider default)</option>
                                  {provModels.map(m => (
                                    <option key={m.id} value={m.model_id}>{m.display_name || m.name} — {m.model_id}</option>
                                  ))}
                                </select>
                                <p className="text-[11px] text-zinc-500 mt-1">{provModels.length} model{provModels.length === 1 ? "" : "s"} available from the backend catalogue.</p>
                              </div>
                            );
                          })()}
<div className="flex gap-2">
                             <Button
                               size="sm"
                               onClick={() => handleSave(prov.id)}
                               disabled={(!keys[prov.id]?.trim() && prov.id !== "OLLAMA") || saving === prov.id}
                             >
                               {saving === prov.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Key className="mr-1 h-3 w-3" />}
                               {configured ? "Update Key" : "Save Key"}
                             </Button>
                             {!configured && prov.url && prov.url !== "#" && (
                               <a
                                 href={prov.url}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors"
                               >
                                 <ExternalLink className="h-3 w-3" /> Get Free Key
                               </a>
                             )}
                             {configured && prov.id !== "OLLAMA" && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => handleReTest(prov.id)} disabled={saving === prov.id}>
                                  {saving === prov.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Zap className="mr-1 h-3 w-3" />}
                                  Test
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setDeleteTarget(prov.id)}>Remove</Button>
                              </>
                            )}
                            <a href={prov.url} target="_blank" rel="noopener noreferrer" className="ml-auto">
                              <Button size="sm" variant="ghost"><ExternalLink className="h-3 w-3" /></Button>
                            </a>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Status summary */}
                <Card className="p-4">
                  <h3 className="font-medium mb-2 flex items-center gap-2"><Zap className="h-4 w-4" /> How MARK Routes Models</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Every provider you connect is verified with a live API call before it is marked Active. You can pin a
                    specific model per provider above; otherwise MARK uses that provider&apos;s default model and routes by
                    <span className="font-medium"> task type</span> (coding, research, vision),
                    <span className="font-medium"> cost</span> (prefers cheapest),
                    <span className="font-medium"> speed</span> (fast tasks use fast models),
                    <span className="font-medium"> availability</span> (falls back if provider is down),
                    <span className="font-medium"> local preference</span> (uses Ollama when available).
                  </p>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {PROVIDERS.filter(p => isConfigured(p.id)).map(p => (
                      <Badge key={p.id} className={p.color}>{p.name} ✓</Badge>
                    ))}
                  </div>
                  {PROVIDERS.filter(p => isConfigured(p.id)).length === 0 && (
                    <p className="text-sm text-amber-600 mt-2 flex items-center gap-1"><AlertCircle className="h-4 w-4" /> Add at least one API key above to start using MARK.</p>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="models" className="overflow-auto">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Input
                    value={modelFilter}
                    onChange={(e) => setModelFilter(e.target.value)}
                    placeholder="Search models by name or provider..."
                    className="max-w-sm"
                  />
                  <span className="text-xs text-zinc-500">{visibleModels.length} of {models.length} models</span>
                  <Button size="sm" variant="outline" className="ml-auto" onClick={handleRefreshModels} disabled={refreshing}>
                    {refreshing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Zap className="mr-1 h-3 w-3" />}
                    Refresh from providers
                  </Button>
                </div>
                {loading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {visibleModels.map(m => {
                      const isFree = !!(m.config as any)?.free;
                      const apiBase = (m.config as any)?.api_base;
                      return (
                      <Card key={`${m.provider}-${m.model_id}`} className="p-3">
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <p className="font-medium text-sm truncate">{m.display_name || m.name}</p>
                          <div className="flex gap-1 shrink-0">
                            {isFree && <Badge className="bg-emerald-600 text-[10px]">FREE</Badge>}
                            <Badge variant={m.is_local ? "default" : "outline"} className="text-[10px]">{m.is_local ? "Local" : "Cloud"}</Badge>
                          </div>
                        </div>
                        <p className="text-xs text-zinc-500 break-all">{m.provider} • {m.model_id}</p>
                        {apiBase && <p className="text-[10px] text-zinc-400 break-all mt-0.5">via {apiBase}</p>}
                        <div className="flex flex-wrap gap-1 mt-1">{m.capabilities?.slice(0, 4).map(c => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}</div>
                        <div className="flex gap-3 mt-1 text-[10px] text-zinc-400">
                          <span className="flex items-center gap-0.5"><DollarSign className="h-2.5 w-2.5" />{m.cost_per_1k_input ?? 0}¢/1k</span>
                          <span>{m.context_window ? `${Math.round(m.context_window / 1000)}k ctx` : "ctx n/a"}</span>
                        </div>
                        <div className="flex gap-1 mt-2">
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                            onClick={() => handleSelectModel(m.provider as any, m.model_id)}>
                            Use for {m.provider}
                          </Button>
                        </div>
                      </Card>
                    );
                    })}
                    {visibleModels.length === 0 && (
                      <div className="col-span-3 text-center p-8">
                        <p className="text-zinc-500">
                          {models.length === 0
                            ? "No models yet. Connect a provider above (free options exist) or press Refresh."
                            : "No model matches that search."}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="agents" className="overflow-auto">
                {loading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : agentsError ? (
                  <Card className="p-4 border-red-300 dark:border-red-800">
                    <p className="text-sm text-red-600 flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Could not load agents: {agentsError}</p>
                  </Card>
                ) : agents.length === 0 ? (
                  <Card className="p-6 text-center">
                    <p className="text-sm text-zinc-500">No agents are registered in the database yet.</p>
                    <p className="text-xs text-zinc-400 mt-1">Agents are created from the backend <code className="text-[10px]">agents</code> table (type, tools, skills, model binding).</p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {agents.map(a => (
                      <Card key={a.id} className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Bot className="h-4 w-4 text-blue-500" />
                          <p className="font-medium text-sm">{a.name}</p>
                          <Badge variant="outline" className="text-[10px]">{a.type}</Badge>
                        </div>
                        {a.description && <p className="text-xs text-zinc-500">{a.description}</p>}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {a.model_name && <Badge variant="secondary" className="text-[10px]">{a.model_name}</Badge>}
                          {(a.available_tools || []).slice(0, 3).map(t => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                          {(a.available_skills || []).slice(0, 2).map(s => <Badge key={s} className="text-[10px] bg-indigo-100 text-indigo-700">{s}</Badge>)}
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1">
                          {a.available_tools?.length || 0} tools &middot; {a.available_skills?.length || 0} skills
                        </p>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>

      <Sheet open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Remove this provider?</SheetTitle>
            <SheetDescription>“{deleteTarget || "Provider"}” won't be available to MARK until you add its key again.</SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <SheetClose render={<Button variant="outline" />}>Cancel</SheetClose>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Remove
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ProtectedLayout>
  );
}


