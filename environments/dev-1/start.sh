#!/bin/bash
# Development Environment 1 (Containerized) Startup Script

set -e

echo "🐳 Starting Development Environment 1 (Containerized)"
echo "====================================================="

# Check if container is already running
if docker ps | grep -q vibestack-devenv1; then
    echo "✅ Container is already running"
else
    echo "📦 Starting container..."
    docker compose -f docker-compose.devenv-1.yml up -d
    echo "⏳ Waiting for container to be ready..."
    sleep 3
fi

# Check if development servers are running
if docker exec vibestack-devenv1 bash -c "pgrep -f 'pnpm dev' > /dev/null 2>&1"; then
    echo "⚠️  Development servers are already running in container"
else
    echo "🚀 Starting development servers in container..."
    docker exec -d vibestack-devenv1 bash -c "export PATH=\"~/.local/bin:\$PATH\" && cd /workspace && WEB_PORT=5173 pnpm dev:web"
fi

echo ""
echo "✅ Environment 1 is ready!"
echo "   Web: http://localhost:5175 (maps to container's 5173)"
echo "   API: http://localhost:8789 (maps to container's 8787)"
echo ""
echo "To enter the container with Claude Code:"
echo "   docker exec -it vibestack-devenv1 bash"
echo "   export PATH=\"~/.local/bin:\$PATH\""
echo "   cd /workspace"
echo "   claude"
echo ""
echo "To stop this environment:"
echo "   ./stop.sh"