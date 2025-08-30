#!/bin/bash

# Start VibeStack Dev-1 Environment
# Creates isolated environment by cloning git repo inside container

set -e

echo "🚀 VibeStack Dev-1 Environment"
echo "=============================="
echo ""

# Change to script directory
cd "$(dirname "$0")"

echo "🐳 Starting containers..."
docker compose up -d --build

echo "⏳ Waiting for environment setup..."
echo "   (This includes git clone, dependency install, database setup)"
echo ""

# Wait and show progress
for i in {1..30}; do
    if docker exec vibestack-dev1 test -f /workspace/.git/config 2>/dev/null; then
        echo "✅ Git repository cloned"
        break
    fi
    echo "   Cloning repository... ($i/30)"
    sleep 2
done

# Wait for dependencies
for i in {1..20}; do
    if docker exec vibestack-dev1 test -d /workspace/node_modules 2>/dev/null; then
        echo "✅ Dependencies installed"
        break
    fi
    echo "   Installing dependencies... ($i/20)"
    sleep 3
done

echo ""
echo "🧪 Checking services..."

# Check containers
if ! docker ps | grep -q "vibestack-dev1"; then
    echo "❌ Main container failed to start"
    docker compose logs dev
    exit 1
fi

echo "✅ Dev-1 environment running"
echo ""
echo "🎉 DEV-1 ENVIRONMENT READY!"
echo "==========================="
echo ""
echo "🌐 Access URLs:"
echo "   • Web App: http://localhost:5175"
echo "   • API Server: http://localhost:8789"
echo "   • PostgreSQL: localhost:5433"
echo "   • Chrome Debug: http://localhost:3001"
echo ""
echo "🎯 Next Steps:"
echo "   ./dev.sh    - Enter development environment"
echo "   ./test.sh   - Test development servers"  
echo "   ./stop.sh   - Stop all services"
echo ""