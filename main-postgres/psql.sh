#!/bin/bash

# Connect to Main PostgreSQL with psql

set -e

cd "$(dirname "$0")"

if ! docker ps | grep -q "elevra-main-postgres"; then
    echo "❌ Main PostgreSQL is not running"
    echo "Start it first: ./start.sh"
    exit 1
fi

echo "🐘 Connecting to Main PostgreSQL..."
docker exec -it elevra-main-postgres psql -U postgres -d elevra_dev