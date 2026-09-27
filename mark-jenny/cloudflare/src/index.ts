/**
 * Mark-Imti edge API.
 *
 * Sits in front of the Python backend and does three things at the edge:
 *  1. CORS, so the browser never needs the backend's origin allow-list.
 *  2. A reverse proxy for /api/v1/* so the frontend can call a single origin.
 *  3. A WebSocket proxy for /api/v1/ws/tasks, which is what carries live task
 *     updates. Without this the task stream silently dies.
 *
 * The Python app itself cannot run in Workers (SQLAlchemy/psycopg2 are not
 * available in the isolate), so BACKEND_URL must point at a real host.
 */

export interface Env {
  BACKEND_URL: string;
  CORS_ORIGINS?: string;
}

const WS_PATHS = ["/api/v1/ws/tasks"];

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = (env.CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const allow = origin && allowed.includes(origin) ? origin : allowed[0] ?? "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function backendOrigin(env: Env): URL {
  // BACKEND_URL is a secret so the real host is not baked into the bundle.
  return new URL(env.BACKEND_URL);
}

/** Turn an incoming request into the equivalent request for the backend. */
function rewrite(request: Request, env: Env, path: string): Request {
  const target = new URL(path, backendOrigin(env));
  return new Request(target.toString(), request);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // Edge-local health check: answers even if the backend is cold or down,
    // which makes "is the edge up" and "is the app up" separate questions.
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "healthy", edge: true }), {
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    if (WS_PATHS.includes(url.pathname)) {
      return proxyWebSocket(request, env, cors);
    }

    if (url.pathname.startsWith("/api/")) {
      const upstream = await fetch(rewrite(request, env, url.pathname + url.search));
      const headers = new Headers(upstream.headers);
      for (const [k, v] of Object.entries(cors)) headers.set(k, v);
      return new Response(upstream.body, { status: upstream.status, headers });
    }

    return new Response("Not found", { status: 404, headers: cors });
  },
};

/**
 * Cloudflare gives us a WebSocketPair; one end goes to the browser, the other is
 * handed to fetch() as the request body, which tunnels it to the backend.
 */
async function proxyWebSocket(
  request: Request,
  env: Env,
  cors: Record<string, string>,
): Promise<Response> {
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return new Response("Expected a WebSocket upgrade", { status: 400, headers: cors });
  }

  const target = new URL(request.url);
  const upstreamUrl = new URL(backendOrigin(env));
  target.protocol = upstreamUrl.protocol === "https:" ? "wss:" : "ws:";
  target.host = upstreamUrl.host;

  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];

  server.accept();
  try {
    const upstream = await fetch(target.toString(), { headers: request.headers });
    if (upstream.webSocket) {
      // Relay frames in both directions until either side closes.
      client.addEventListener("message", (e) => {
        try {
          server.send(e.data as string | ArrayBuffer);
        } catch {
          /* peer went away */
        }
      });
      client.addEventListener("close", () => server.close(1000, "client closed"));
      server.addEventListener("message", (e) => {
        try {
          client.send(e.data as string | ArrayBuffer);
        } catch {
          /* peer went away */
        }
      });
      server.addEventListener("close", () => client.close(1000, "backend closed"));
    } else {
      server.close(1011, "backend refused the upgrade");
    }
  } catch (err) {
    server.close(1011, `edge error: ${String(err)}`);
  }

  return new Response(null, { status: 101, webSocket: client, headers: cors });
}
