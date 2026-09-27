# Cloudflare + Neon Migration Plan

## Current State
- Render Web (Next.js) + Render Backend (FastAPI) + SQLite (ephemeral)
- Problems: SQLite wipes on deploy, Render cold starts, WebSocket 403, deploy failures

## Target Architecture (Free Tier)
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Cloudflare Pages│────▶│ Cloudflare Workers│────▶│ Neon Postgres   │
│ (Next.js static)│     │ (Edge proxy)      │     │ (Serverless PG) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                            │
                            ▼
                     ┌──────────────────┐
                     │ Python Backend   │
                     │ (Fly.io/Railway) │
                     └──────────────────┘
```

## Free Tier Resources
| Service | Free Tier |
|---------|-----------|
| Cloudflare Pages | Unlimited requests, 500 builds/mo |
| Cloudflare Workers | 100k requests/day |
| Neon Postgres | 0.5 GB storage, unlimited projects |
| Fly.io | 3 shared-cpu VMs, 3GB RAM |

## Migration Steps

### 1. Neon Database (5 min)
```bash
# Create Neon project at https://console.neon.tech
# Copy connection string: postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname
# Run migrations: DATABASE_URL="..." python -m alembic upgrade head
```

### 2. Python Backend on Fly.io (15 min)
```bash
cd mark-jenny/backend
fly launch --name mark-imti-backend --region iad --no-deploy
fly secrets set DATABASE_URL="postgresql://..." SECRET_KEY="..." CREDENTIAL_VAULT_KEY="..."
fly deploy
```

### 3. Cloudflare Workers (Edge Proxy) (10 min)
```bash
cd cloudflare
npm init -y
npm install hono
wrangler deploy --env production
wrangler secret put BACKEND_URL  # https://mark-imti-backend.fly.dev
wrangler secret put DATABASE_URL # for any edge DB access
```

### 4. Next.js Frontend on Cloudflare Pages (10 min)
```bash
cd frontend
npm run build
# next.config.js: output: 'export'
# Cloudflare Pages: connect GitHub repo, build: npm run build, output: out
# Env: NEXT_PUBLIC_API_URL=https://mark-imti-api.your-subdomain.workers.dev/api/v1
```

### 5. WebSocket (Durable Objects)
```typescript
// cloudflare/src/durable-objects/TaskWebSocket.ts
export class TaskWebSocket extends DurableObject {
  // WebSocket hibernation for real-time updates
}
```

## Cost: $0/month (entirely free tiers)

## Next Actions
1. Create Neon project → get connection string
2. Deploy Python backend to Fly.io with Neon URL
3. Deploy Cloudflare Workers with Fly.io backend URL
4. Deploy Next.js to Cloudflare Pages
5. Update DNS: mark-imti.pages.dev → Cloudflare Pages
6. Delete Render services