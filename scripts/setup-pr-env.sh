#!/bin/bash

# Setup complete PR environment with fresh data
# Usage: PR_NUMBER=123 ./scripts/setup-pr-env.sh

set -e

# If PR_NUMBER not provided, try to detect it
if [ -z "$PR_NUMBER" ]; then
    # Try git branch first
    PR_NUMBER=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | grep -o '[0-9]\+' | head -1 || true)
    
    # If still empty, try to extract from working directory
    if [ -z "$PR_NUMBER" ]; then
        CWD=$(pwd)
        if [[ "$CWD" =~ /issue-([0-9]+) ]]; then
            PR_NUMBER="${BASH_REMATCH[1]}"
        fi
    fi
    
    # Default to 0 if still not found
    PR_NUMBER=${PR_NUMBER:-0}
fi
# Setup .env.local if it doesn't exist
if [ ! -f "apps/server/.env.local" ]; then
    echo "📝 Generating .env.local..."
    npm run setup:env
fi

echo "🚀 Setting up PR environment..."
echo "   PR Number: ${PR_NUMBER:-"main"}"
echo ""

# Step 1: Configure environment (single source of truth)
echo "1️⃣ Configuring ports and environment..."
PR_NUMBER=${PR_NUMBER} ./scripts/configure-worktree-env.sh

# Load the configured environment
set -a
source .env.local
set +a

# Step 1.5: Copy Claude configuration (skip - handled by postinstall)
# The postinstall script already handles Claude configuration

# Step 2: Start Docker containers with PR-specific ports
echo ""
echo "2️⃣ Starting Docker containers..."
if [ -n "$PR_NUMBER" ] && [ "$PR_NUMBER" != "0" ]; then
    # Ports are already loaded from .env.local
    # No need to calculate - single source of truth
    
    # Create .docker folder if it doesn't exist
    mkdir -p .docker
    
    # Generate PR-specific docker-compose with unique container names and volumes
    # This creates the config in the worktree's .docker directory
    sed -e "s/\"5432:5432\"/\"${DB_PORT}:5432\"/g" \
        -e "s/\"4444:4444\"/\"${PROXY_PORT}:4444\"/g" \
        -e "s/vibestack-postgres/vibestack-postgres-${PR_NUMBER}/g" \
        -e "s/vibestack-neon-proxy/vibestack-neon-proxy-${PR_NUMBER}/g" \
        -e "s/vibestack_dev/vibestack_dev_issue_${PR_NUMBER}/g" \
        -e "s/postgres_data:/postgres_data_pr_${PR_NUMBER}:/g" \
        docker-configs/docker-compose.yml > .docker/docker-compose.pr-${PR_NUMBER}.yml
    
    echo "   Using ports: DB=${DB_PORT}, Proxy=${PROXY_PORT}"
    docker compose -f .docker/docker-compose.pr-${PR_NUMBER}.yml up -d
    
    # Update local database URL for this PR
    LOCAL_DB_URL="postgresql://postgres:postgres@localhost:${DB_PORT}/vibestack_dev_issue_${PR_NUMBER}"
else
    # Use default ports
    docker compose -f docker-configs/docker-compose.yml up -d
    LOCAL_DB_URL="postgresql://postgres:postgres@localhost:5432/vibestack_dev"
fi

echo "   ⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Step 3: Run auto-configure-branch-db to set up and clone database
echo ""
echo "3️⃣ Setting up and cloning database..."
if [ -f "./scripts/auto-configure-branch-db.js" ]; then
    node ./scripts/auto-configure-branch-db.js
else
    echo "   ⚠️ Database configuration script not found, skipping automatic setup"
    echo "   You may need to manually run: node scripts/auto-configure-branch-db.js"
fi

echo ""
echo "✅ PR environment setup complete!"
echo ""
echo "🎯 Next steps:"
echo "   • Run: pnpm dev"
echo "   • Visit: http://localhost:$((5173 + ${PR_NUMBER:-0}))"
echo "   • API: http://localhost:$((8787 + ${PR_NUMBER:-0}))"
echo ""
echo "🔧 Cleanup when done:"
if [ -n "$PR_NUMBER" ] && [ "$PR_NUMBER" != "0" ]; then
    echo "   docker compose -f .docker/docker-compose.pr-${PR_NUMBER}.yml down"
    echo "   rm -rf .docker"
else
    echo "   docker compose -f docker-configs/docker-compose.yml down"
fi