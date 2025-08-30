#!/bin/bash

# Host script to sync current staging branch into dev-1 container

set -e

echo "🔄 Syncing Staging Branch to Dev-1"
echo "=================================="
echo ""

# Check if container is running
if ! docker ps | grep -q "vibestack-dev1"; then
    echo "❌ Dev-1 container not running"
    echo "Run: ./start.sh first"
    exit 1
fi

echo "📂 Syncing current staging branch content..."

HOST_PROJECT_ROOT="/home/benfreed/dev/vibestack"
CONTAINER_NAME="vibestack-dev1"

# Copy essential files and directories
echo "   Copying apps, packages, scripts..."
docker cp "$HOST_PROJECT_ROOT/apps" "$CONTAINER_NAME:/workspace/" 2>/dev/null || echo "   apps/ not found, skipping"
docker cp "$HOST_PROJECT_ROOT/packages" "$CONTAINER_NAME:/workspace/" 2>/dev/null || echo "   packages/ not found, skipping" 
docker cp "$HOST_PROJECT_ROOT/scripts" "$CONTAINER_NAME:/workspace/" 2>/dev/null || echo "   scripts/ not found, skipping"

# Copy config files
echo "   Copying config files..."
docker cp "$HOST_PROJECT_ROOT/package.json" "$CONTAINER_NAME:/workspace/" 2>/dev/null || echo "   package.json not found"
docker cp "$HOST_PROJECT_ROOT/pnpm-lock.yaml" "$CONTAINER_NAME:/workspace/" 2>/dev/null || echo "   pnpm-lock.yaml not found"
docker cp "$HOST_PROJECT_ROOT/pnpm-workspace.yaml" "$CONTAINER_NAME:/workspace/" 2>/dev/null || echo "   pnpm-workspace.yaml not found"
docker cp "$HOST_PROJECT_ROOT/tsconfig.json" "$CONTAINER_NAME:/workspace/" 2>/dev/null || true
docker cp "$HOST_PROJECT_ROOT/tsconfig.base.json" "$CONTAINER_NAME:/workspace/" 2>/dev/null || true
docker cp "$HOST_PROJECT_ROOT/turbo.json" "$CONTAINER_NAME:/workspace/" 2>/dev/null || true
docker cp "$HOST_PROJECT_ROOT/eslint.config.mjs" "$CONTAINER_NAME:/workspace/" 2>/dev/null || true

# Copy environment and config files
echo "   Copying environment files..."
docker cp "$HOST_PROJECT_ROOT/.env.local" "$CONTAINER_NAME:/workspace/" 2>/dev/null || echo "   .env.local not found"
docker cp "$HOST_PROJECT_ROOT/.env.example" "$CONTAINER_NAME:/workspace/" 2>/dev/null || true
docker cp "$HOST_PROJECT_ROOT/patches" "$CONTAINER_NAME:/workspace/" 2>/dev/null || echo "   patches/ not found, skipping"
docker cp "$HOST_PROJECT_ROOT/data" "$CONTAINER_NAME:/workspace/" 2>/dev/null || echo "   data/ not found, skipping"
docker cp "$HOST_PROJECT_ROOT/.git" "$CONTAINER_NAME:/workspace/" 2>/dev/null || echo "   .git/ not found, skipping"
docker cp "$HOST_PROJECT_ROOT/.mcp.json" "$CONTAINER_NAME:/workspace/" 2>/dev/null || true
docker cp "$HOST_PROJECT_ROOT/README.md" "$CONTAINER_NAME:/workspace/" 2>/dev/null || true
docker cp "$HOST_PROJECT_ROOT/CLAUDE.md" "$CONTAINER_NAME:/workspace/" 2>/dev/null || true

# Fix ownership and trigger dependency install
echo "   Fixing permissions and installing dependencies..."
docker exec "$CONTAINER_NAME" bash -c "
    cd /workspace
    sudo chown -R developer:developer . 2>/dev/null || true
    
    # Install dependencies if we have package.json
    if [ -f package.json ]; then
        echo 'Installing dependencies...'
        pnpm install --prefer-frozen-lockfile || pnpm install
    fi
    
    # Setup MCP if not done
    if [ ! -f .mcp.json ] || ! grep -q 'playwright' .mcp.json; then
        echo 'Setting up MCP Playwright...'
        export PATH=\"/home/developer/.local/bin:\$PATH\"
        claude mcp add --scope project playwright npx @playwright/mcp@latest 2>/dev/null || echo 'MCP setup completed'
    fi
"

echo ""
echo "✅ Dev-1 Sync Complete!"
echo "======================"
echo ""
echo "🎯 Ready Commands:"
echo "   ./dev.sh    - Enter development environment"
echo "   ./test.sh   - Test development servers"
echo ""