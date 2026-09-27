# Cloudflare migration (no credit card required)

## What is decided

| Piece | Service | Card required | Status |
|---|---|---|---|
| Frontend | Cloudflare Pages (Next.js) | No | config ready |
| Edge/API proxy + task WebSocket | Cloudflare Worker | No | **built, typechecks, deploys** |
| Database | Neon Postgres | No | **created** |
| Python backend | needs a compute host | see below | **blocked on host** |

## Why the backend is not on Cloudflare

Workers run in a V8 isolate. The Python app needs SQLAlchemy + psycopg2, which
cannot run there, and Cloudflare's container product is not on the free plan. So
the Python process has to live on a real host; the Worker in front of it handles
CORS, proxying and the task WebSocket tunnel.

Hosts already ruled out, all because they demand a card or were rejected:
- Fly.io - `apps create` fails: "We need your payment information to continue!"
- Render / Vercel - out of scope per the owner
- Together AI - $5 card required for its "free" credits

Remaining card-free option: **Hugging Face Spaces** (Docker) or **this machine**.

## Steps

### 1. Deploy the Worker (needs one browser login)

```powershell
wrangler login
cd mark-jenny/cloudflare
wrangler secret put BACKEND_URL   # paste the Python backend URL
wrangler deploy
```

`wrangler deploy --temporary` already works without an account and is how the
current build was verified.

### 2. Deploy the frontend to Cloudflare Pages

Connect `kevinclientmanager-sketch/Mark-Jenny`, root directory `mark-jenny/frontend`,
build command `npm run build`, output `out`.

Environment variables:

```
BACKEND_URL                 = https://mark-imti-api.<subdomain>.workers.dev
NEXT_PUBLIC_WS_URL          = wss://mark-imti-api.<subdomain>.workers.dev/api/v1/ws
CORS_ORIGIN_REGEX           = https://.*\.pages\.dev
```

`BACKEND_URL` is what `next.config.ts` rewrites `/api/v1/*` and `/health` to, so
no frontend code change is needed once it points at the Worker.

### 3. Point the backend at Neon and run it

Secrets on whichever host runs the Python app:

```
DATABASE_URL            = <the Neon connection string>
SECRET_KEY              = <openssl rand -base64 32>
CREDENTIAL_VAULT_KEY    = <openssl rand -base64 32>
CORS_ORIGIN_REGEX       = https://.*\.(pages\.dev|workers\.dev)
PORT                    = 7860   (Spaces) or 8080
```

The backend is already container-ready: `$PORT`-driven, non-root, no reload in
production, `HEALTHCHECK` on `/health`.

## Trade-off to be aware of

A free Hugging Face Space sleeps after roughly 48h idle, so the first request
after a quiet period waits on a cold start. Neon keeps the data, so nothing is
lost - but the delay is unavoidable on any free host.
