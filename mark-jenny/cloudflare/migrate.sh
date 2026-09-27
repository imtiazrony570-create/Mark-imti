#!/usr/bin/env bash
# Cloudflare + Neon Migration Script
# Run AFTER creating Neon project and Fly.io app

set -e

echo "=== Cloudflare + Neon Migration ==="
echo ""

# 1. Neon connection string (user must provide)
read -p "Enter Neon connection string (postgresql://...): " NEON_URL
if [ -z "$NEON_URL" ]; then
  echo "ERROR: Neon URL required"
  exit 1
fi

# 2. Fly.io app name
read -p "Fly.io app name (default: mark-imti-backend): " FLY_APP
FLY_APP=${FLY_APP:-mark-imti-backend}

# 3. Generate secure secrets
SECRET_KEY=$(openssl rand -base64 32)
CREDENTIAL_VAULT_KEY=$(openssl rand -base64 32)

echo ""
echo "=== Generated secrets ==="
echo "SECRET_KEY=$SECRET_KEY"
echo "CREDENTIAL_VAULT_KEY=$CREDENTIAL_VAULT_KEY"
echo ""

# 4. Deploy to Fly.io
echo ""
echo "=== Deploying to Fly.io ==="
cd mark-jenny/backend

# Create fly.toml if not exists
if [ ! -f fly.toml ]; then
  fly launch --name "$FLY_APP" --region iad --no-deploy --dockerfile Dockerfile
fi

# Set secrets
fly secrets set \
  DATABASE_URL="$NEON_URL" \
  SECRET_KEY="$SECRET_KEY" \
  CREDENTIAL_VAULT_KEY="$CREDENTIAL_VAULT_KEY" \
  CORS_ORIGIN_REGEX="https://.*\.pages\.dev" \
  -a "$FLY_APP"

# Deploy
fly deploy -a "$FLY_APP"

BACKEND_URL="https://$FLY_APP.fly.dev"
echo "Backend deployed to: $BACKEND_URL"

# 5. Run migrations
fly ssh console -a "$FLY_APP" -C "alembic upgrade head"

# 6. Deploy Cloudflare Workers
echo ""
echo "=== Deploying Cloudflare Workers ==="
cd ../../cloudflare
npm install
wrangler secret put BACKEND_URL --env production <<< "$BACKEND_URL"
wrangler deploy --env production

WORKER_URL="https://$FLY_APP-api.your-subdomain.workers.dev"
echo "Worker deployed to: $WORKER_URL"

# 7. Build and deploy frontend to Cloudflare Pages
echo ""
echo "=== Building Frontend ==="
cd ../frontend
npm run build
npx wrangler pages deploy out --project-name=mark-imti

echo ""
echo "=== Migration Complete ==="
echo "Backend:  $BACKEND_URL"
echo "Worker:   $WORKER_URL"
echo "Frontend: https://mark-imti.pages.dev"
echo ""
echo "Add these to Cloudflare Pages env vars:"
echo "  NEXT_PUBLIC_API_URL=$WORKER_URL/api/v1"
echo "  NEXT_PUBLIC_WS_URL=${BACKEND_URL/https:/wss:}/api/v1/ws"