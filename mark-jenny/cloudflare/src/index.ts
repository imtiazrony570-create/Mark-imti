import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";

// Note: This is a Cloudflare Workers wrapper. The actual FastAPI app runs in Python.
// For Cloudflare Workers, we have two options:
// 1. Run Python via Pyodide (limited)
// 2. Keep Python backend on a separate host (Fly.io/Railway) and use Workers as edge proxy
// 3. Rewrite backend in TypeScript for Workers (major rewrite)

// This is a minimal edge proxy that:
// - Handles CORS at edge
// - Proxies API requests to the Python backend (on Fly.io/Railway)
// - Serves static assets from Cloudflare Pages

const app = new Hono();

app.use("*", cors({
  origin: ["https://mark-imti.pages.dev", "http://localhost:3000"],
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
}));

// Health check at edge (instant, no cold start)
app.get("/health", (c) => c.json({ status: "healthy", edge: true }));

// Proxy all /api/v1/* to the Python backend
app.all("/api/v1/*", async (c) => {
  const backendUrl = c.env.BACKEND_URL || "https://mark-imti-backend.fly.dev"; // Set via wrangler secret
  const url = new URL(c.req.url);
  url.hostname = new URL(backendUrl).hostname;
  url.protocol = new URL(backendUrl).protocol;
  url.port = new URL(backendUrl).port;

  const headers = new Headers(c.req.header());
  headers.set("host", url.hostname);
  headers.set("x-forwarded-for", c.req.header("cf-connecting-ip") || "");
  headers.set("x-forwarded-proto", "https");

  const response = await fetch(url.toString(), {
    method: c.req.method,
    headers,
    body: c.req.method !== "GET" && c.req.method !== "HEAD" ? await c.req.arrayBuffer() : undefined,
    redirect: "manual",
  });

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
});

// WebSocket proxy for /api/v1/ws/tasks
app.get("/api/v1/ws/tasks", async (c) => {
  const backendUrl = c.env.BACKEND_URL || "https://mark-imti-backend.fly.dev";
  const wsUrl = backendUrl.replace("https://", "wss://") + "/api/v1/ws/tasks" + c.req.url.split("/api/v1/ws/tasks")[1];
  
  const upgradeHeader = c.req.header("upgrade");
  if (upgradeHeader !== "websocket") {
    return c.text("Expected WebSocket upgrade", 400);
  }

  // Cloudflare Workers doesn't support WebSocket proxy directly in the same way
  // This is a placeholder - actual WS proxy requires Durable Objects
  return c.text("WebSocket proxy requires Durable Objects. Use backend directly: " + wsUrl, 501);
});

export default app;