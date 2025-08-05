#!/bin/bash

# Clone Remote Database Data to Local
# Usage: ./scripts/clone-data.sh

set -e

echo "🚀 Starting database clone process..."
echo ""

# Check if Docker containers are running
if ! docker ps | grep -q "vibestack-postgres"; then
    echo "📦 Starting Docker containers..."
    docker-compose up -d
    echo "⏳ Waiting for PostgreSQL to be ready..."
    sleep 5
else
    echo "✅ Docker containers already running"
fi

# Check if REMOTE_DATABASE_URL is set
if [ -z "${REMOTE_DATABASE_URL}" ]; then
    echo "❌ Error: REMOTE_DATABASE_URL environment variable is required"
    echo ""
    echo "Usage:"
    echo "  REMOTE_DATABASE_URL='your-neon-url' ./scripts/clone-data.sh"
    echo ""
    echo "Or set it in your shell:"
    echo "  export REMOTE_DATABASE_URL='your-neon-url'"
    echo "  ./scripts/clone-data.sh"
    exit 1
fi

# Run the clone script
echo "🔄 Cloning data from remote to local database..."
node scripts/clone-remote-data.js

echo ""
echo "✅ Database clone completed!"
echo ""
echo "You can now run: pnpm dev:local"