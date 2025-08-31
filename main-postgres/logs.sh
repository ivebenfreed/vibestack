#!/bin/bash

# View Main PostgreSQL logs

set -e

cd "$(dirname "$0")"

if ! docker ps | grep -q "vibestack-main-postgres"; then
    echo "❌ Main PostgreSQL is not running"
    echo "Start it first: ./start.sh"
    exit 1
fi

echo "📋 Main PostgreSQL Logs (Ctrl+C to exit):"
echo "=========================================="
docker compose logs -f postgres