#!/bin/bash

# sync-postgres-to-git.sh - Sync live PostgreSQL data to git-tracked location
# This updates data/postgres-live/ with current container data
# Usage: ./scripts/sync-postgres-to-git.sh

set -euo pipefail

echo "🔄 Syncing live PostgreSQL data to git-tracked location..."

# Check if postgres container is running
if ! docker ps | grep -q vibestack-postgres; then
    echo "❌ PostgreSQL container (vibestack-postgres) is not running"
    exit 1
fi

echo "📋 Copying live database state..."

# Copy current live data from container volume
docker run --rm \
  -v vibestack_postgres_data:/source:ro \
  -v "${PWD}/data/postgres-live:/target" \
  alpine:latest \
  sh -c "
    rm -rf /target/* /target/.[^.]* 2>/dev/null || true
    cp -a /source/. /target/
  "

# Fix permissions  
docker run --rm \
  -v "${PWD}/data:/data" \
  alpine:latest \
  sh -c "chown -R $(id -u):$(id -g) /data/postgres-live"

echo "✅ PostgreSQL data synced to data/postgres-live/"
echo "💡 You can now commit this to git for other machines/worktrees to use"
echo ""
echo "Next steps:"
echo "  git add data/postgres-live/"
echo "  git commit -m 'feat: update PostgreSQL data with latest staging state'"