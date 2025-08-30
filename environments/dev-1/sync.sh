#!/bin/bash
# Development Environment 1 Sync Script

set -e

echo "🔄 Syncing Development Environment 1 (Containerized)"
echo "=================================================="

# Navigate to project root
cd "$(dirname "$0")/../.."

echo "📥 Pulling latest changes from git..."
git fetch origin
git pull origin staging

echo "📦 Installing/updating dependencies on host..."
pnpm install

# Check if container exists
if ! docker ps -a | grep -q vibestack-devenv1; then
    echo "🐳 Container doesn't exist - will be created on first start"
else
    # Stop container if running
    if docker ps | grep -q vibestack-devenv1; then
        echo "🛑 Stopping container for sync..."
        docker compose -f docker/environments/docker-compose.devenv-1.yml down
    fi
    
    echo "🗑️  Removing old container for clean sync..."
    docker rm vibestack-devenv1 2>/dev/null || true
fi

echo "🐳 Starting fresh container..."
docker compose -f docker/environments/docker-compose.devenv-1.yml up -d

echo "⏳ Waiting for container to be ready..."
sleep 5

echo "📂 Syncing source code to container..."
# Copy essential files to container
docker cp package.json vibestack-devenv1:/workspace/
docker cp pnpm-workspace.yaml vibestack-devenv1:/workspace/
docker cp turbo.json vibestack-devenv1:/workspace/
docker cp pnpm-lock.yaml vibestack-devenv1:/workspace/
docker cp scripts vibestack-devenv1:/workspace/
docker cp apps/web/package.json vibestack-devenv1:/workspace/apps/web/
docker cp apps/server/package.json vibestack-devenv1:/workspace/apps/server/
docker cp apps/server/wrangler.toml vibestack-devenv1:/workspace/apps/server/
docker cp apps/web/src vibestack-devenv1:/workspace/apps/web/
docker cp apps/server/src vibestack-devenv1:/workspace/apps/server/

echo "📦 Installing dependencies in container..."
docker exec vibestack-devenv1 bash -c "cd /workspace && pnpm install"

echo "🗄️  Loading fresh database data..."
# Check if we have a database dump
if [ -f "data/vibestack_dev_dump.sql" ]; then
    echo "📋 Loading database dump into container..."
    docker exec vibestack-postgres-devenv1 bash -c "psql -U postgres -d vibestack_dev -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'"
    docker exec -i vibestack-postgres-devenv1 psql -U postgres -d vibestack_dev < data/vibestack_dev_dump.sql
elif command -v ./scripts/sync-remote-to-local.sh >/dev/null 2>&1; then
    echo "📊 Syncing database from remote..."
    # First sync to local, then copy to container
    ./scripts/sync-remote-to-local.sh
    
    # Export local data and import to container
    echo "📤 Exporting local database..."
    pg_dump postgres://postgres:postgres@localhost:5432/vibestack_dev > /tmp/local_dump.sql
    
    echo "📥 Importing to container database..."
    docker exec vibestack-postgres-devenv1 bash -c "psql -U postgres -d vibestack_dev -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'"
    docker exec -i vibestack-postgres-devenv1 psql -U postgres -d vibestack_dev < /tmp/local_dump.sql
    rm /tmp/local_dump.sql
else
    echo "⚠️  No database sync available - container will use default setup"
fi

echo "✅ Development Environment 1 sync complete!"
echo "   Container: vibestack-devenv1"
echo "   Web: http://localhost:5175"
echo "   API: http://localhost:8789"
echo ""
echo "To start development servers:"
echo "   ./start.sh"
echo ""
echo "To enter with Claude Code:"
echo "   ./enter.sh"