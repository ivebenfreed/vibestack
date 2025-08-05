#!/bin/bash

# Setup complete PR environment with fresh data
# Usage: PR_NUMBER=123 ./scripts/setup-pr-env.sh

set -e

PR_NUMBER=${PR_NUMBER:-$(git rev-parse --abbrev-ref HEAD | grep -o '[0-9]\+' | head -1)}
# Try to get remote database URL from .dev.vars if it exists
if [ -f "apps/server/.dev.vars" ]; then
    REMOTE_DATABASE_URL=${REMOTE_DATABASE_URL:-$(grep "^DATABASE_URL=" apps/server/.dev.vars | cut -d'=' -f2-)}
else
    REMOTE_DATABASE_URL=${REMOTE_DATABASE_URL:-""}
fi

echo "🚀 Setting up PR environment..."
echo "   PR Number: ${PR_NUMBER:-"main"}"
echo ""

# Step 1: Setup ports and configs
echo "1️⃣ Configuring ports and environment..."
PR_NUMBER=${PR_NUMBER} node scripts/setup-dev-ports.js

# Step 1.5: Copy Claude configuration (skip - handled by postinstall)
# The postinstall script already handles Claude configuration

# Step 2: Start Docker containers with PR-specific ports
echo ""
echo "2️⃣ Starting Docker containers..."
if [ -n "$PR_NUMBER" ] && [ "$PR_NUMBER" != "0" ]; then
    # Use PR-specific docker-compose with different ports
    DB_PORT=$((5432 + PR_NUMBER * 10))
    PROXY_PORT=$((4444 + PR_NUMBER * 10))
    
    # Generate PR-specific docker-compose with unique container names and volumes
    sed -e "s/\"5432:5432\"/\"${DB_PORT}:5432\"/g" \
        -e "s/\"4444:4444\"/\"${PROXY_PORT}:4444\"/g" \
        -e "s/vibestack-postgres/vibestack-postgres-${PR_NUMBER}/g" \
        -e "s/vibestack-neon-proxy/vibestack-neon-proxy-${PR_NUMBER}/g" \
        -e "s/vibestack_dev/vibestack_dev_issue_${PR_NUMBER}/g" \
        -e "s/postgres_data:/postgres_data_pr_${PR_NUMBER}:/g" \
        docker-compose.yml > docker-compose.pr-${PR_NUMBER}.yml
    
    echo "   Using ports: DB=${DB_PORT}, Proxy=${PROXY_PORT}"
    docker compose -f docker-compose.pr-${PR_NUMBER}.yml up -d
    
    # Update local database URL for this PR
    LOCAL_DB_URL="postgresql://postgres:postgres@localhost:${DB_PORT}/vibestack_dev_issue_${PR_NUMBER}"
else
    # Use default ports
    docker compose up -d
    LOCAL_DB_URL="postgresql://postgres:postgres@localhost:5432/vibestack_dev"
fi

echo "   ⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Step 3: Database setup will be handled by pnpm dev:local
echo ""
echo "3️⃣ Database setup will be handled automatically by pnpm dev:local"

# Step 4: Database cloning will be handled by auto-configure-branch-db.js
echo ""
echo "4️⃣ Database setup and cloning will be handled automatically by pnpm dev:local"

echo ""
echo "✅ PR environment setup complete!"
echo ""
echo "🎯 Next steps:"
echo "   • Run: pnpm dev:local"
echo "   • Visit: http://localhost:$((5173 + ${PR_NUMBER:-0} * 10))"
echo "   • API: http://localhost:$((8787 + ${PR_NUMBER:-0} * 10))"
echo ""
echo "🔧 Cleanup when done:"
if [ -n "$PR_NUMBER" ] && [ "$PR_NUMBER" != "0" ]; then
    echo "   docker compose -f docker-compose.pr-${PR_NUMBER}.yml down"
    echo "   rm docker-compose.pr-${PR_NUMBER}.yml"
else
    echo "   docker compose down"
fi