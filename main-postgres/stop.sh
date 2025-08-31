#!/bin/bash

# Stop Main VibeStack PostgreSQL Database

set -e

echo "🛑 Stopping Main PostgreSQL"
echo "=========================="

cd "$(dirname "$0")"

if ! docker ps | grep -q "vibestack-main-postgres"; then
    echo "✅ Main PostgreSQL is already stopped"
    exit 0
fi

echo "🐳 Stopping PostgreSQL container..."
docker compose down

echo "✅ Main PostgreSQL stopped"
echo ""
echo "💡 To start again: ./start.sh"