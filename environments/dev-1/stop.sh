#!/bin/bash
# Development Environment 1 Stop Script

set -e

echo "🛑 Stopping Development Environment 1 (Containerized)"
echo "===================================================="

# Stop development servers in container
if docker ps | grep -q vibestack-devenv1; then
    echo "📦 Stopping development servers..."
    docker exec vibestack-devenv1 bash -c "pkill -f pnpm || true"
    docker exec vibestack-devenv1 bash -c "pkill -f vite || true"
    docker exec vibestack-devenv1 bash -c "pkill -f turbo || true"
    
    echo "🐳 Stopping container..."
    docker compose -f docker-compose.devenv-1.yml down
    
    echo "✅ Environment 1 stopped"
else
    echo "⚠️  Container is not running"
fi