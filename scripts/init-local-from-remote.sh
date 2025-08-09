#!/bin/bash

# Initialize local database from remote Neon database
# This is used when starting fresh on the main/staging branch
# Usage: ./scripts/init-local-from-remote.sh

set -e

echo "🚀 Initializing local database from remote Neon database..."
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

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Check if the main postgres container exists
if docker ps -a | grep -q "vibestack-postgres"; then
    echo -e "${YELLOW}⚠️  Found existing vibestack-postgres container${NC}"
    read -p "Do you want to reset the local database? This will delete all local data! (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📦 Stopping and removing existing containers..."
        docker-compose down -v
        echo "✅ Removed existing containers and volumes"
    else
        echo "Cancelled. Exiting..."
        exit 0
    fi
fi

# Start fresh Docker containers
echo "📦 Starting Docker containers..."
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

# Additional wait to ensure database is fully initialized
sleep 2

# Clone data from remote
echo ""
echo "🔄 Cloning data from remote Neon database..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Use the existing clone script with our environment variable
REMOTE_DATABASE_URL="$REMOTE_DATABASE_URL" node scripts/clone-remote-data.js

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✨ Local database initialized successfully!${NC}"
echo ""
echo "Your local database now contains all data from the remote Neon database."
echo ""
echo "You can now run:"
echo "  pnpm dev:local    # Start development servers"
echo ""
echo "To sync again later, run:"
echo "  ./scripts/sync-remote-to-local.sh"