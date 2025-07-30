#!/bin/bash

# Setup complete PR environment with fresh data
# Usage: PR_NUMBER=123 ./scripts/setup-pr-env.sh

set -e

PR_NUMBER=${PR_NUMBER:-$(git rev-parse --abbrev-ref HEAD | grep -o '[0-9]\+' | head -1)}
REMOTE_DATABASE_URL=${REMOTE_DATABASE_URL:-$(grep "^DATABASE_URL=" apps/server/.dev.vars | cut -d'=' -f2-)}

echo "🚀 Setting up PR environment..."
echo "   PR Number: ${PR_NUMBER:-"main"}"
echo ""

# Step 1: Setup ports and configs
echo "1️⃣ Configuring ports and environment..."
PR_NUMBER=${PR_NUMBER} node scripts/setup-dev-ports.js

# Step 2: Start Docker containers with PR-specific ports
echo ""
echo "2️⃣ Starting Docker containers..."
if [ -n "$PR_NUMBER" ] && [ "$PR_NUMBER" != "0" ]; then
    # Use PR-specific docker-compose with different ports
    DB_PORT=$((5432 + PR_NUMBER * 10))
    PROXY_PORT=$((4444 + PR_NUMBER * 10))
    
    # Generate PR-specific docker-compose
    sed "s/5432:5432/${DB_PORT}:5432/g; s/4444:4444/${PROXY_PORT}:4444/g" docker-compose.yml > docker-compose.pr-${PR_NUMBER}.yml
    
    echo "   Using ports: DB=${DB_PORT}, Proxy=${PROXY_PORT}"
    docker-compose -f docker-compose.pr-${PR_NUMBER}.yml up -d
    
    # Update local database URL for this PR
    LOCAL_DB_URL="postgresql://postgres:postgres@localhost:${DB_PORT}/vibestack_dev"
else
    # Use default ports
    docker-compose up -d
    LOCAL_DB_URL="postgresql://postgres:postgres@localhost:5432/vibestack_dev"
fi

echo "   ⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Step 3: Run migrations
echo ""
echo "3️⃣ Running database migrations..."
pnpm forge:migrate:run:local

# Step 4: Clone production data (optional)
if [ -n "$REMOTE_DATABASE_URL" ]; then
    echo ""
    echo "4️⃣ Cloning production data..."
    echo "   This will replace all local data with current production data."
    read -p "   Continue? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        REMOTE_DATABASE_URL="$REMOTE_DATABASE_URL" LOCAL_DATABASE_URL="$LOCAL_DB_URL" node scripts/clone-remote-data.js
    else
        echo "   ⏭️  Skipping data clone (you can run it later)"
    fi
else
    echo ""
    echo "4️⃣ Skipping data clone (REMOTE_DATABASE_URL not found)"
    echo "   To clone production data later, run:"
    echo "   REMOTE_DATABASE_URL='your-url' node scripts/clone-remote-data.js"
fi

echo ""
echo "✅ PR environment setup complete!"
echo ""
echo "🎯 Next steps:"
echo "   • Run: pnpm dev:local"
echo "   • Visit: http://localhost:$((5173 + (PR_NUMBER:-0) * 10))"
echo "   • API: http://localhost:$((8787 + (PR_NUMBER:-0) * 10))"
echo ""
echo "🔧 Cleanup when done:"
if [ -n "$PR_NUMBER" ] && [ "$PR_NUMBER" != "0" ]; then
    echo "   docker-compose -f docker-compose.pr-${PR_NUMBER}.yml down"
    echo "   rm docker-compose.pr-${PR_NUMBER}.yml"
else
    echo "   docker-compose down"
fi