#!/bin/bash

# Start VibeStack Development Environment
# Simple, clean version that mounts the current vibestack project

set -e

echo "🚀 VibeStack Development Environment"
echo "===================================="
echo ""

# Change to the dev-env directory
cd "$(dirname "$0")"

echo "🐳 Starting containers..."
docker compose up -d

echo "⏳ Waiting for services to be ready..."
sleep 10

echo "🧪 Checking services..."

# Check if containers are running
if ! docker ps | grep -q "vibestack-dev"; then
    echo "❌ Main container failed to start"
    docker compose logs dev
    exit 1
fi

if ! docker ps | grep -q "vibestack-postgres"; then
    echo "❌ Database container failed to start" 
    docker compose logs postgres
    exit 1
fi

echo "✅ All containers running"
echo ""

# Setup inside container
echo "🔧 Setting up environment..."
docker exec vibestack-dev bash -c "
    export PATH=\"/home/developer/.local/bin:\$PATH\"
    cd /workspace
    
    # Ensure proper ownership
    sudo chown -R developer:developer /workspace 2>/dev/null || true
    
    # Install dependencies if needed
    if [ ! -d node_modules ] || [ ! -f node_modules/.pnpm/lock.yaml ]; then
        echo 'Installing dependencies...'
        pnpm install --prefer-frozen-lockfile
    fi
    
    # Setup MCP Playwright if not already done
    if ! grep -q 'playwright' .mcp.json 2>/dev/null; then
        echo 'Setting up MCP Playwright...'
        claude mcp add --scope project playwright npx @playwright/mcp@latest 2>/dev/null || echo 'MCP setup completed'
    fi
"

echo ""
echo "🎉 DEVELOPMENT ENVIRONMENT READY!"
echo "================================="
echo ""
echo "🌐 Access URLs:"
echo "   • Web App: http://localhost:5175"
echo "   • API Server: http://localhost:8789" 
echo "   • PostgreSQL: localhost:5433"
echo "   • Chrome Debug: http://localhost:3001"
echo ""
echo "🎯 Next Steps:"
echo "   ./dev.sh    - Enter development environment"
echo "   ./stop.sh   - Stop all services"
echo ""