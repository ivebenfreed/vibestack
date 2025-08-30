#!/bin/bash
# Main Environment Sync Script

set -e

echo "🔄 Syncing Main Development Environment"
echo "======================================"

# Navigate to project root
cd "$(dirname "$0")/../.."

echo "📥 Pulling latest changes from git..."
git fetch origin
git pull origin staging

echo "📦 Installing/updating dependencies..."
pnpm install

echo "🗄️  Syncing database with remote data..."
if command -v ./scripts/sync-remote-to-local.sh >/dev/null 2>&1; then
    ./scripts/sync-remote-to-local.sh
else
    echo "⚠️  Database sync script not found - skipping database sync"
fi

echo "🔧 Running any pending migrations..."
# Add migration commands here if needed
# pnpm db:migrate

echo "✅ Main environment sync complete!"
echo "   Ready to start with: ./start.sh"