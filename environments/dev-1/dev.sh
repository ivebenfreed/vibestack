#!/bin/bash

# Enter Dev-1 development environment with auto-starting servers

echo "🎉 VibeStack Dev-1 Development"
echo "============================="
echo ""

# Check if containers are running
if ! docker ps | grep -q "vibestack-dev1"; then
    echo "❌ Dev-1 environment not running"
    echo "Run: ./start.sh first"
    exit 1
fi

# Start dev servers in background
echo "🚀 Starting development servers..."
docker exec -d vibestack-dev1 bash -c "
    export PATH=\"/home/developer/.local/bin:\$PATH\"
    cd /workspace
    pkill -f 'pnpm dev' 2>/dev/null || true
    sleep 2
    exec pnpm dev
"

sleep 3

echo "✅ Development servers started!"
echo ""
echo "🌐 Dev-1 Access URLs:"
echo "   • Web App: http://localhost:5175"
echo "   • API Server: http://localhost:8789"
echo "   • PostgreSQL: localhost:5433"
echo ""
echo "💡 Available Commands:"
echo "   claude         - Start Claude Code"
echo "   pnpm dev       - Restart dev servers"
echo "   pnpm test      - Run tests"
echo "   git status     - Check git status"
echo "   exit           - Exit (servers keep running)"
echo ""

# Enter container with interactive bash
docker exec -it vibestack-dev1 bash -c "
    export PATH=\"/home/developer/.local/bin:\$PATH\"
    cd /workspace
    
    echo '🎯 Dev-1 Ready for Development!'
    echo 'You are in an isolated workspace with full git history.'
    echo 'Servers running. Type \"claude\" to start Claude Code.'
    echo ''
    
    exec bash -l
"