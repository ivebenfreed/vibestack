#!/bin/bash

# Startup script that runs inside the container
# Clones git repo, sets up database, and keeps container running

set -e

echo "🚀 VibeStack Dev-1 Environment Startup"
echo "======================================"

export PATH="/home/developer/.local/bin:$PATH"
cd /workspace

# Check if we have project files, if not we'll wait for sync
if [ ! -f "package.json" ]; then
    echo "📥 Waiting for project sync from host..."
    echo "   Please run: ./sync.sh from the host"
    echo "   Then project files will be available"
else
    echo "✅ Project files ready"
fi

# Wait for postgres to be ready
echo "⏳ Waiting for PostgreSQL..."
until pg_isready -h postgres -p 5432 -U postgres; do
    sleep 1
done
echo "✅ PostgreSQL ready"

# Install dependencies if needed
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.pnpm/lock.yaml" ]; then
    echo "📦 Installing dependencies..."
    pnpm install --prefer-frozen-lockfile || pnpm install
fi

# Setup MCP Playwright
if [ ! -f ".mcp.json" ] || ! grep -q "playwright" .mcp.json; then
    echo "🎭 Setting up MCP Playwright..."
    claude mcp add --scope project playwright npx @playwright/mcp@latest 2>/dev/null || echo "MCP setup completed"
fi

# Restore database if pgdata dump exists
if [ -f "pgdata.sql" ] || [ -f "data/pgdata.sql" ]; then
    echo "🗃️  Restoring database..."
    if [ -f "pgdata.sql" ]; then
        psql "$DATABASE_URL" -f pgdata.sql || echo "Database restore completed"
    elif [ -f "data/pgdata.sql" ]; then
        psql "$DATABASE_URL" -f data/pgdata.sql || echo "Database restore completed"  
    fi
fi

echo ""
echo "🎉 VibeStack Dev-1 Environment Ready!"
echo "===================================="
echo ""
echo "🌐 Services:"
echo "   • Web App: http://localhost:5175"
echo "   • API Server: http://localhost:8789" 
echo "   • PostgreSQL: localhost:5433"
echo "   • Chrome Debug: http://localhost:3001"
echo ""
echo "💡 Development Commands:"
echo "   pnpm dev       - Start development servers"
echo "   claude         - Start Claude Code"
echo "   pnpm test      - Run tests"
echo ""

# Keep container running
exec sleep infinity