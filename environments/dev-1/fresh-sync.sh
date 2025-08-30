#!/bin/bash
# Fresh Sync - Complete Environment Reset and Sync

set -e

echo "🔥 Fresh Sync - Complete Environment Reset"
echo "========================================="
echo "⚠️  This will:"
echo "   • Stop and remove the container"
echo "   • Pull latest code changes"
echo "   • Create a fresh container"
echo "   • Load latest database dump"
echo ""

read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

# Navigate to project root
cd "$(dirname "$0")/../.."

echo "🛑 Stopping and removing existing container..."
docker compose -f docker/environments/docker-compose.devenv-1.yml down || true
docker rm vibestack-devenv1 2>/dev/null || true
docker rm vibestack-postgres-devenv1 2>/dev/null || true
docker rm vibestack-chrome-devenv1 2>/dev/null || true

echo "🗑️  Cleaning up volumes..."
docker volume rm vibestack-postgres-devenv1-data 2>/dev/null || true

echo "📥 Pulling latest changes..."
git fetch origin
git stash push -m "fresh-sync-$(date +%Y%m%d-%H%M%S)" || true
git pull origin staging

echo "📦 Installing dependencies..."
pnpm install

echo "🐳 Creating fresh container environment..."
docker compose -f docker/environments/docker-compose.devenv-1.yml up -d

echo "⏳ Waiting for services to be ready..."
sleep 10

# Wait for postgres to be healthy
echo "🔄 Waiting for database to be ready..."
timeout=60
while ! docker exec vibestack-postgres-devenv1 pg_isready -U postgres > /dev/null 2>&1; do
    sleep 1
    timeout=$((timeout - 1))
    if [ $timeout -eq 0 ]; then
        echo "❌ Database failed to start"
        exit 1
    fi
done

echo "📂 Copying source code to container..."
# Copy all essential files
docker cp package.json vibestack-devenv1:/workspace/
docker cp pnpm-workspace.yaml vibestack-devenv1:/workspace/
docker cp turbo.json vibestack-devenv1:/workspace/
docker cp pnpm-lock.yaml vibestack-devenv1:/workspace/
docker cp scripts vibestack-devenv1:/workspace/
docker cp apps vibestack-devenv1:/workspace/
docker cp packages vibestack-devenv1:/workspace/

echo "📦 Installing dependencies in container..."
docker exec vibestack-devenv1 bash -c "cd /workspace && pnpm install"

echo "🗄️  Loading latest database data..."
if command -v ./scripts/init-local-from-remote.sh >/dev/null 2>&1; then
    echo "📊 Syncing from remote database..."
    ./scripts/init-local-from-remote.sh
    
    # Export and load to container
    echo "📤 Exporting local database..."
    pg_dump postgres://postgres:postgres@localhost:5432/vibestack_dev > /tmp/fresh_dump.sql
    
    echo "📥 Loading to container database..."
    docker exec -i vibestack-postgres-devenv1 psql -U postgres -d vibestack_dev < /tmp/fresh_dump.sql
    rm /tmp/fresh_dump.sql
elif [ -f "data/vibestack_dev_dump.sql" ]; then
    echo "📋 Loading from local dump file..."
    docker exec -i vibestack-postgres-devenv1 psql -U postgres -d vibestack_dev < data/vibestack_dev_dump.sql
else
    echo "⚠️  No database source available - using empty database"
fi

echo ""
echo "🎉 Fresh sync complete!"
echo "   Container: vibestack-devenv1"
echo "   Database: Fresh with latest data"
echo "   Code: Latest from staging branch"
echo ""
echo "Next steps:"
echo "   ./start.sh    # Start development servers"
echo "   ./enter.sh    # Enter container with Claude Code"