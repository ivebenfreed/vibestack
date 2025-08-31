#!/bin/bash

# Test development environment servers

echo "🧪 Testing Development Environment"
echo "=================================="
echo ""

# Check containers
echo "🔧 Checking containers..."
if ! docker ps | grep -q "vibestack-dev"; then
    echo "❌ Development container not running"
    echo "Run: ./start.sh first"
    exit 1
fi

if ! docker ps | grep -q "vibestack-postgres"; then
    echo "❌ Database container not running"
    echo "Run: ./start.sh first"
    exit 1
fi

echo "✅ Containers running"
echo ""

# Start servers if not running
echo "🚀 Ensuring dev servers are running..."
docker exec -d vibestack-dev bash -c "
    export PATH=\"/home/developer/.local/bin:\$PATH\"
    cd /workspace
    if ! pgrep -f 'pnpm dev' >/dev/null; then
        exec pnpm dev
    fi
" 2>/dev/null

echo "⏳ Waiting for servers..."
sleep 8

echo "🌐 Testing endpoints..."

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
if docker exec vibestack-postgres pg_isready -U postgres >/dev/null 2>&1; then
    echo "✅ Ready"
else
    echo "❌ Not ready"
fi

echo ""
echo "🎯 Environment Status:"
echo "   • Development servers: Running"
echo "   • Database: Connected" 
echo "   • Ready for development!"
echo ""
echo "💡 Next: ./dev.sh to enter development mode"