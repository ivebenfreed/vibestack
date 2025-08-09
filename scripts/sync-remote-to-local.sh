#!/bin/bash

# Sync remote Neon database to local
# This updates an existing local database with latest remote data
# Usage: ./scripts/sync-remote-to-local.sh

set -e

echo "🔄 Syncing remote Neon database to local..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the Neon database URL from .dev.vars
if [ -f "apps/server/.dev.vars" ]; then
    export REMOTE_DATABASE_URL=$(grep "^DATABASE_URL=" apps/server/.dev.vars | cut -d '=' -f2-)
    echo -e "${GREEN}✅ Found Neon database URL in apps/server/.dev.vars${NC}"
else
    echo -e "${RED}❌ Error: apps/server/.dev.vars not found${NC}"
    echo "Please ensure you have the .dev.vars file with DATABASE_URL set"
    exit 1
fi

# Check if Docker containers are running
if ! docker ps | grep -q "vibestack-postgres"; then
    echo -e "${YELLOW}⚠️  PostgreSQL container is not running${NC}"
    echo "Starting Docker containers..."
    docker-compose up -d
    
    # Wait for PostgreSQL to be ready
    echo "⏳ Waiting for PostgreSQL to be ready..."
    for i in {1..30}; do
        if docker exec vibestack-postgres pg_isready -U postgres > /dev/null 2>&1; then
            echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${RED}❌ PostgreSQL failed to start${NC}"
            exit 1
        fi
        sleep 1
    done
    sleep 2
else
    echo -e "${GREEN}✅ Docker containers already running${NC}"
fi

echo ""
echo "📊 Syncing data from remote..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Use the TypeScript sync script
npx tsx scripts/full-sync-remote-to-local.ts

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✨ Sync complete!${NC}"
echo ""
echo "Your local database is now in sync with the remote Neon database."