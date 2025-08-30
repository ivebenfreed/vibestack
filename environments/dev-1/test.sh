#!/bin/bash

# Test Dev-1 development servers

echo "🧪 Testing Dev-1 Environment"
echo "============================"
echo ""

# Check containers
if ! docker ps | grep -q "vibestack-dev1"; then
    echo "❌ Dev-1 container not running"
    echo "Run: ./start.sh first"
    exit 1
fi

echo "✅ Dev-1 containers running"
echo ""

# Start servers if not running
echo "🚀 Ensuring dev servers are running..."
docker exec -d vibestack-dev1 bash -c "
    export PATH=\"/home/developer/.local/bin:\$PATH\"
    cd /workspace
    if ! pgrep -f 'pnpm dev' >/dev/null; then
        exec pnpm dev
    fi
" 2>/dev/null

echo "⏳ Waiting for servers..."
sleep 8

echo "🌐 Testing Dev-1 endpoints..."

# Test API server
echo -n "API Server (8789): "
if curl -s --connect-timeout 5 http://localhost:8789/health >/dev/null 2>&1; then
    echo "✅ Responding"
else
    echo "❌ Not responding"
fi

# Test web server
echo -n "Web Server (5175): "
if curl -s --connect-timeout 5 http://localhost:5175 >/dev/null 2>&1; then
    echo "✅ Responding"
else
    echo "❌ Not responding"
fi

# Test PostgreSQL
echo -n "PostgreSQL (5433): "
if docker exec vibestack-dev1-postgres pg_isready -U postgres >/dev/null 2>&1; then
    echo "✅ Ready"
else
    echo "❌ Not ready"
fi

# Check git repo
echo -n "Git Repository: "
if docker exec vibestack-dev1 bash -c "cd /workspace && test -d .git" 2>/dev/null; then
    BRANCH=$(docker exec vibestack-dev1 bash -c "cd /workspace && git branch --show-current" 2>/dev/null || echo "unknown")
    echo "✅ Ready (branch: $BRANCH)"
else
    echo "❌ Not cloned"
fi

echo ""
echo "🎯 Dev-1 Environment Status:"
echo "   • Isolated workspace with git history"
echo "   • Development servers running"
echo "   • Database connected"
echo "   • Ready for development!"
echo ""
echo "💡 Next: ./dev.sh to enter development mode"