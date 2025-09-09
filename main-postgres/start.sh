#!/bin/bash

# Start Main Elevra PostgreSQL Database
# Simple, isolated, conflict-free startup

set -e

echo "🐘 Elevra Main PostgreSQL"
echo "============================"
echo ""

# Change to script directory
cd "$(dirname "$0")"

# Check if already running
if docker ps | grep -q "elevra-main-postgres"; then
    echo "✅ Main PostgreSQL already running"
    echo ""
    echo "🌐 Connection Details:"
    echo "   Host: localhost:5432"
    echo "   Database: elevra_dev"
    echo "   User: postgres"
    echo "   Password: postgres"
    echo ""
    echo "🔗 Connection String:"
    echo "   postgresql://postgres:postgres@localhost:5432/elevra_dev"
    exit 0
fi

# Check for port conflicts
if lsof -i :5432 >/dev/null 2>&1; then
    echo "❌ Port 5432 is already in use"
    echo "   Check what's running: lsof -i :5432"
    echo "   Stop conflicting service first"
    exit 1
fi

echo "🐳 Starting Main PostgreSQL..."
docker compose up -d --build

echo "⏳ Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker exec elevra-main-postgres pg_isready -U postgres >/dev/null 2>&1; then
        echo "✅ PostgreSQL is ready!"
        break
    fi
    echo "   Waiting for database... ($i/30)"
    sleep 2
done

# Verify health
if ! docker exec elevra-main-postgres pg_isready -U postgres >/dev/null 2>&1; then
    echo "❌ PostgreSQL failed to start properly"
    echo "Check logs: docker compose logs postgres"
    exit 1
fi

# Check if database exists and has tables
TABLE_COUNT=$(docker exec elevra-main-postgres psql -U postgres -d elevra_dev -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs || echo "0")

echo ""
echo "🎉 MAIN POSTGRESQL READY!"
echo "========================="
echo ""
echo "📊 Database Status:"
echo "   Container: elevra-main-postgres"
echo "   Status: $(docker ps --filter "name=elevra-main-postgres" --format "{{.Status}}")"
echo "   Tables: $TABLE_COUNT"
echo ""
echo "🌐 Connection Details:"
echo "   Host: localhost:5432"
echo "   Database: elevra_dev"
echo "   User: postgres"
echo "   Password: postgres"
echo ""
echo "🔗 Connection String:"
echo "   postgresql://postgres:postgres@localhost:5432/elevra_dev"
echo ""
echo "🛠️ Management Commands:"
echo "   ./stop.sh     - Stop PostgreSQL"
echo "   ./logs.sh     - View logs"
echo "   ./backup.sh   - Create backup"
echo "   ./psql.sh     - Connect with psql"
echo ""