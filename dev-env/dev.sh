#!/bin/bash

# Enter the development environment with auto-starting dev servers

echo "🎉 VibeStack Development Environment"
echo "===================================="
echo ""

# Check if containers are running
if ! docker ps | grep -q "vibestack-dev"; then
    echo "❌ Development environment not running"
    echo "Run: ./start.sh first"
    exit 1
fi

# Start dev servers in background
echo "🚀 Starting development servers..."
docker exec -d vibestack-dev bash -c "
    export PATH=\"/home/developer/.local/bin:\$PATH\"
    cd /workspace
    pkill -f 'pnpm dev' 2>/dev/null || true
    sleep 2
    exec pnpm dev
"

sleep 3

echo "✅ Development servers started!"
echo ""
echo "🌐 Access URLs:"
echo "   • Web App: http://localhost:5175"
echo "   • API Server: http://localhost:8789"
echo "   • PostgreSQL: localhost:5433"
echo ""
echo "💡 Available Commands:"
echo "   claude         - Start Claude Code"
echo "   pnpm dev       - Restart dev servers"  
echo "   pnpm test      - Run tests"
echo "   pnpm build     - Build project"
echo "   exit           - Exit (servers keep running)"
echo ""

# Enter container with interactive bash
docker exec -it vibestack-dev bash -c "
    export PATH=\"/home/developer/.local/bin:\$PATH\"
    cd /workspace
    
    echo '🎯 Ready for Development!'
    echo 'Servers running. Type \"claude\" to start Claude Code.'
    echo ''
    
    exec bash -l
"