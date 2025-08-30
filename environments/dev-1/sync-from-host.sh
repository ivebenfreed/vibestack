#!/bin/bash

# Sync current staging branch content from host into the container workspace

set -e

echo "🔄 Syncing from host staging branch..."

# This script will be called from the host and copies current staging content
# into the container workspace

HOST_PROJECT_ROOT="/home/benfreed/dev/vibestack"
CONTAINER_NAME="vibestack-dev1"

if [ ! -d "$HOST_PROJECT_ROOT" ]; then
    echo "❌ Host project root not found: $HOST_PROJECT_ROOT"
    exit 1
fi

if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "❌ Container $CONTAINER_NAME not running"
    exit 1
fi

echo "📂 Copying current staging branch content..."

# Copy essential files and directories
docker exec "$CONTAINER_NAME" bash -c "cd /workspace && rm -rf .git apps packages scripts data *.json *.md *.yaml *.toml *.js *.ts .env* patches 2>/dev/null || true"

# Copy main project files
docker cp "$HOST_PROJECT_ROOT/apps" "$CONTAINER_NAME:/workspace/"
docker cp "$HOST_PROJECT_ROOT/packages" "$CONTAINER_NAME:/workspace/"
docker cp "$HOST_PROJECT_ROOT/scripts" "$CONTAINER_NAME:/workspace/"

# Copy config files
docker cp "$HOST_PROJECT_ROOT/package.json" "$CONTAINER_NAME:/workspace/"
docker cp "$HOST_PROJECT_ROOT/pnpm-lock.yaml" "$CONTAINER_NAME:/workspace/"
docker cp "$HOST_PROJECT_ROOT/pnpm-workspace.yaml" "$CONTAINER_NAME:/workspace/"
docker cp "$HOST_PROJECT_ROOT/tsconfig.json" "$CONTAINER_NAME:/workspace/"
docker cp "$HOST_PROJECT_ROOT/tsconfig.base.json" "$CONTAINER_NAME:/workspace/"
docker cp "$HOST_PROJECT_ROOT/turbo.json" "$CONTAINER_NAME:/workspace/"
docker cp "$HOST_PROJECT_ROOT/eslint.config.mjs" "$CONTAINER_NAME:/workspace/"

# Copy environment files
if [ -f "$HOST_PROJECT_ROOT/.env.local" ]; then
    docker cp "$HOST_PROJECT_ROOT/.env.local" "$CONTAINER_NAME:/workspace/"
fi

if [ -f "$HOST_PROJECT_ROOT/.env.example" ]; then
    docker cp "$HOST_PROJECT_ROOT/.env.example" "$CONTAINER_NAME:/workspace/"
fi

# Copy patches if they exist
if [ -d "$HOST_PROJECT_ROOT/patches" ]; then
    docker cp "$HOST_PROJECT_ROOT/patches" "$CONTAINER_NAME:/workspace/"
fi

# Copy data directory if it exists (for pgdata.sql)
if [ -d "$HOST_PROJECT_ROOT/data" ]; then
    docker cp "$HOST_PROJECT_ROOT/data" "$CONTAINER_NAME:/workspace/"
fi

# Copy git directory for history
if [ -d "$HOST_PROJECT_ROOT/.git" ]; then
    docker cp "$HOST_PROJECT_ROOT/.git" "$CONTAINER_NAME:/workspace/"
fi

# Copy MCP config
if [ -f "$HOST_PROJECT_ROOT/.mcp.json" ]; then
    docker cp "$HOST_PROJECT_ROOT/.mcp.json" "$CONTAINER_NAME:/workspace/"
fi

# Copy README and docs
if [ -f "$HOST_PROJECT_ROOT/README.md" ]; then
    docker cp "$HOST_PROJECT_ROOT/README.md" "$CONTAINER_NAME:/workspace/"
fi

if [ -f "$HOST_PROJECT_ROOT/CLAUDE.md" ]; then
    docker cp "$HOST_PROJECT_ROOT/CLAUDE.md" "$CONTAINER_NAME:/workspace/"
fi

# Fix ownership
docker exec "$CONTAINER_NAME" bash -c "cd /workspace && sudo chown -R developer:developer . 2>/dev/null || true"

echo "✅ Sync completed successfully!"
echo ""
echo "💡 Now run: ./dev.sh to enter the development environment"