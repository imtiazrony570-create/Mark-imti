export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://mark-imti-api.imtiazrony570.workers.dev/api/v1';
const STATIC_MODE = process.env.NEXT_PUBLIC_STATIC_MODE === 'true';

class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

type LocalProvider = {
  id: number;
  provider: string;
  base_url: string | null;
  has_key: boolean;
  is_default: boolean;
  created_at: string;
  api_key?: string;
  model?: string;
};

type LocalMessage = {
  id: number;
  chat_id: number;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: string | null;
  created_at: string;
};

type LocalChat = {
  id: number;
  title: string | null;
  owner_id: number;
  project_id: number | null;
  project_name: string | null;
  task_id: number | null;
  model_used: string | null;
  message_count: number;
  last_message: string | null;
  created_at: string;
  updated_at: string | null;
  messages: LocalMessage[];
};

const LOCAL_KEY = 'mark.localdb.v2';
const uid = () => Math.floor(Date.now() + Math.random() * 100000);

function readDB(): any {
  if (typeof window === 'undefined') return { user: null, chats: [], providers: [], projects: [], settings: {} };
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '') || { user: null, chats: [], providers: [], projects: [], settings: {} }; }
  catch { return { user: null, chats: [], providers: [], projects: [], settings: {} }; }
}
function writeDB(db: any) {
  if (typeof window !== 'undefined') localStorage.setItem(LOCAL_KEY, JSON.stringify(db));
}
function ensureDB() {
  const db = readDB();
  if (!db.user) db.user = { id: 1, email: (typeof window !== 'undefined' && localStorage.getItem('mark.local.email')) || 'local@mark-imti.app', full_name: 'Local User', avatar_url: null, role: 'user', is_active: true, is_verified: true, created_at: new Date().toISOString(), last_login_at: null };
  if (!Array.isArray(db.chats)) db.chats = [];
  if (!Array.isArray(db.providers)) db.providers = [];
  if (!Array.isArray(db.projects)) db.projects = [];
  if (!db.settings) db.settings = {};
  writeDB(db); return db;
}

function providerDefaults(provider: string) {
  const map: Record<string,{base:string,model:string}> = {
    OPENAI: { base: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    OPENROUTER: { base: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
    DEEPSEEK: { base: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    MISTRAL: { base: 'https://api.mistral.ai/v1', model: 'mistral-small-latest' },
    XAI: { base: 'https://api.x.ai/v1', model: 'grok-3-mini' },
    TOGETHER: { base: 'https://api.together.xyz/v1', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
  };
  return map[provider] || { base: '', model: 'gpt-4o-mini' };
}

async function directAiReply(messages: Array<{role:'user'|'assistant'|'system';content:string}>, requestedModel?: string): Promise<{text:string; provider:string; model:string}> {
  const db = ensureDB();
  const providers: LocalProvider[] = db.providers || [];
  const active = [...providers].filter(p => p.has_key && p.api_key).sort((a,b) => Number(b.is_default)-Number(a.is_default));
  if (!active.length) throw new ApiError(503, 'No AI provider is configured. Open AI Models and add an API key.');
  let lastErr = '';
  for (const p of active) {
    try {
      if (p.provider === 'ANTHROPIC') {
        const model = requestedModel || p.model || 'claude-3-5-haiku-latest';
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': p.api_key!, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
          body: JSON.stringify({ model, max_tokens: 2048, messages: messages.filter(m => m.role !== 'system'), system: messages.find(m => m.role === 'system')?.content }),
        });
        const raw = await r.text(); if (!r.ok) throw new Error(raw.slice(0,500));
        const data = JSON.parse(raw); const text = (data.content || []).filter((x:any)=>x.type === 'text').map((x:any)=>x.text).join('');
        if (text) return { text, provider:p.provider, model };
        throw new Error('Provider returned no text');
      }
      const d = providerDefaults(p.provider);
      const base = (p.base_url || d.base).replace(/\/$/, '');
      if (!base) throw new Error('Provider base URL is missing');
      const model = requestedModel || p.model || d.model;
      const headers: Record<string,string> = { 'content-type':'application/json', authorization:`Bearer ${p.api_key}` };
      if (p.provider === 'OPENROUTER') { headers['HTTP-Referer'] = window.location.origin; headers['X-Title'] = 'Mark-Imti'; }
      const r = await fetch(`${base}/chat/completions`, { method:'POST', headers, body:JSON.stringify({ model, messages, temperature:0.4 }) });
      const raw = await r.text(); if (!r.ok) throw new Error(raw.slice(0,500));
      const data = JSON.parse(raw); const text = data?.choices?.[0]?.message?.content;
      if (typeof text === 'string' && text.trim()) return { text, provider:p.provider, model };
      throw new Error('Provider returned no text');
    } catch (e:any) { lastErr = e?.message || String(e); }
  }
  throw new ApiError(502, `All configured AI providers failed. ${lastErr}`);
}

async function localResponse(endpoint:string, method:string, body:any): Promise<any> {
  const db = ensureDB();
  const path = endpoint.split('?')[0].replace(/^\//,'');

  if (path === 'auth/me' && method === 'GET') return db.user;
  if (path === 'auth/login' && method === 'POST') return { access_token:'local', refresh_token:'local', token_type:'bearer' };
  if (path === 'auth/register' && method === 'POST') { db.user = { ...db.user, email: body?.email || db.user.email, full_name: body?.full_name || db.user.full_name }; writeDB(db); return db.user; }
  if (path === 'auth/logout') return { ok:true };

  if (path === 'ai/providers/catalog' && method === 'GET') return { providers:[
    {provider:'OPENAI',label:'OpenAI',free_tier:false,api_base:'https://api.openai.com/v1',signup_url:'https://platform.openai.com/api-keys',note:'Direct browser connection using your key.',discovery:false},
    {provider:'OPENROUTER',label:'OpenRouter',free_tier:true,api_base:'https://openrouter.ai/api/v1',signup_url:'https://openrouter.ai/keys',note:'One key for many models, including free options.',discovery:false},
    {provider:'DEEPSEEK',label:'DeepSeek',free_tier:false,api_base:'https://api.deepseek.com/v1',signup_url:'https://platform.deepseek.com/api_keys',note:'OpenAI-compatible chat API.',discovery:false},
    {provider:'MISTRAL',label:'Mistral',free_tier:false,api_base:'https://api.mistral.ai/v1',signup_url:'https://console.mistral.ai/api-keys',note:'OpenAI-compatible chat API.',discovery:false},
    {provider:'XAI',label:'xAI',free_tier:false,api_base:'https://api.x.ai/v1',signup_url:'https://console.x.ai',note:'Grok via OpenAI-compatible API.',discovery:false},
  ], note:'Static WebApp mode stores provider credentials locally in this browser.' };
  if (path === 'ai/providers' && method === 'GET') return (db.providers || []).map((p:LocalProvider)=>({...p,api_key:undefined}));
  if (path === 'ai/providers' && method === 'POST') {
    const provider = String(body?.provider || '').toUpperCase();
    let p = db.providers.find((x:LocalProvider)=>x.provider===provider);
    if (!p) { const d=providerDefaults(provider); p={id:uid(),provider,base_url:body?.base_url||d.base,has_key:false,is_default:false,created_at:new Date().toISOString()}; db.providers.push(p); }
    if (body?.api_key) { p.api_key = String(body.api_key); p.has_key = true; }
    if (body?.base_url) p.base_url = body.base_url;
    if (body?.config?.model) p.model = body.config.model;
    if (body?.is_default) db.providers.forEach((x:LocalProvider)=>x.is_default=x===p);
    writeDB(db); return {...p,api_key:undefined};
  }
  if (path.startsWith('ai/providers/test') && method === 'POST') {
    const provider=String(body?.provider||'').toUpperCase();
    let p=db.providers.find((x:LocalProvider)=>x.provider===provider);
    if (body?.api_key) { p=p||{id:uid(),provider,base_url:body?.base_url||providerDefaults(provider).base,has_key:true,is_default:true,created_at:new Date().toISOString()}; p.api_key=body.api_key; p.has_key=true; if (!db.providers.includes(p)) db.providers.push(p); writeDB(db); }
    if (!p?.api_key) throw new ApiError(400,'No local API key saved for this provider.');
    const test=await directAiReply([{role:'user',content:'Reply with exactly: OK'}],body?.model||p.model);
    return {ok:true,provider,model:test.model,detail:'Provider responded successfully.'};
  }
  if (path.startsWith('ai/providers/') && method === 'DELETE') { const provider=path.split('/').pop(); db.providers=db.providers.filter((x:LocalProvider)=>x.provider!==provider); writeDB(db); return {ok:true}; }
  if (path === 'ai/models' && method === 'GET') return (db.providers||[]).map((p:LocalProvider)=>({id:uid(),name:p.model||providerDefaults(p.provider).model,display_name:p.model||providerDefaults(p.provider).model,provider:p.provider,model_id:p.model||providerDefaults(p.provider).model,capabilities:['CHAT','REASONING','CODING'],context_window:null,max_output_tokens:null,cost_per_1k_input:null,cost_per_1k_output:null,is_local:false,is_active:true,config:null,created_at:p.created_at}));
  if (path === 'ai/models/refresh') return {report:{providers:{}},total_models:(db.providers||[]).length};
  if (path === 'ai/agents' && method === 'GET') return [];

  if (path === 'chats' && method === 'GET') {
    const q = new URLSearchParams(endpoint.split('?')[1]||''); const search=(q.get('search')||'').toLowerCase();
    const chats=db.chats.filter((c:LocalChat)=>!search || (c.title||'').toLowerCase().includes(search) || (c.last_message||'').toLowerCase().includes(search));
    return {chats:chats.map(({messages,...c}:LocalChat)=>c),total:chats.length,page:1,page_size:50};
  }
  if (path === 'chats' && method === 'POST') {
    const c:LocalChat={id:uid(),title:body?.title||'New chat',owner_id:db.user.id,project_id:body?.project_id||null,project_name:null,task_id:null,model_used:null,message_count:0,last_message:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),messages:[]}; db.chats.unshift(c); writeDB(db); return c;
  }
  const chatMatch=path.match(/^chats\/(\d+)$/); if (chatMatch) { const c=db.chats.find((x:LocalChat)=>x.id===Number(chatMatch[1])); if (!c && method==='GET') throw new ApiError(404,'Chat not found'); if (method==='GET') return c; if (method==='PATCH') { c.title=body?.title ?? c.title; c.updated_at=new Date().toISOString(); writeDB(db); const {messages,...rest}=c; return rest; } if (method==='DELETE') { db.chats=db.chats.filter((x:LocalChat)=>x.id!==c.id); writeDB(db); return {message:'Deleted'}; } }
  const msgMatch=path.match(/^chats\/(\d+)\/messages$/); if (msgMatch) {
    const c=db.chats.find((x:LocalChat)=>x.id===Number(msgMatch[1])); if (!c) throw new ApiError(404,'Chat not found');
    if (method==='GET') return c.messages;
    if (method==='POST') {
      const userMsg:LocalMessage={id:uid(),chat_id:c.id,role:'USER',content:String(body?.content||''),created_at:new Date().toISOString()}; c.messages.push(userMsg); c.message_count=c.messages.length; c.last_message=userMsg.content; c.updated_at=new Date().toISOString();
      const system='You are Mark-Imti, a professional autonomous AI assistant. Be helpful, accurate, and action-oriented.';
      const history=c.messages.slice(-20).map((m: LocalMessage)=>({role:m.role==='ASSISTANT'?'assistant' as const:'user' as const,content:m.content||''}));
      const ai=await directAiReply([{role:'system',content:system},...history],body?.model);
      const assistant:LocalMessage={id:uid(),chat_id:c.id,role:'ASSISTANT',content:ai.text,created_at:new Date().toISOString()}; c.messages.push(assistant); c.message_count=c.messages.length; c.last_message=assistant.content; c.model_used=`${ai.provider}:${ai.model}`; c.updated_at=new Date().toISOString(); writeDB(db); return assistant;
    }
  }
  if (path.endsWith('/messages') && method==='GET') return [];
  if (path === 'projects' && method === 'GET') return db.projects;
  if (path === 'projects' && method === 'POST') { const p={id:uid(),name:body?.name||'Untitled project',description:body?.description||'',created_at:new Date().toISOString(),updated_at:new Date().toISOString()}; db.projects.push(p); writeDB(db); return p; }
  if (path === 'health' && method === 'GET') return {status:'healthy',mode:'static-local'};
  if (method === 'GET') return [];
  return {ok:true};
}

async function request<T>(endpoint:string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...options.headers };
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (token) (headers as Record<string,string>)['Authorization'] = `Bearer ${token}`;
  try {
    const response = await fetch(url, { ...options, headers, credentials:'include' });
    if (!response.ok) {
      if (response.status >= 500 || response.status === 404 || response.status === 401) throw new Error(`HTTP ${response.status}`);
      const raw=await response.text().catch(()=>""); throw new ApiError(response.status, raw || `Request failed (${response.status})`, raw);
    }
    if (response.status===204) return undefined as T;
    return response.json();
  } catch (err) {
    return await localResponse(endpoint, String(options.method||'GET').toUpperCase(), options.body ? JSON.parse(String(options.body)) : undefined) as T;
  }
}

export const api = {
  get: <T>(endpoint:string) => request<T>(endpoint,{method:'GET'}),
  post: <T>(endpoint:string,data:unknown) => request<T>(endpoint,{method:'POST',body:JSON.stringify(data)}),
  patch: <T>(endpoint:string,data:unknown) => request<T>(endpoint,{method:'PATCH',body:JSON.stringify(data)}),
  delete: <T>(endpoint:string) => request<T>(endpoint,{method:'DELETE'}),
  put: <T>(endpoint:string,data:unknown) => request<T>(endpoint,{method:'PUT',body:JSON.stringify(data)}),
};
export { ApiError, directAiReply };
