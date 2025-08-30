#!/bin/bash
# Main Development Environment Stop Script

set -e

echo "🛑 Stopping Main Development Environment"
echo "========================================"

# Find and kill pnpm dev processes
if pgrep -f "pnpm dev" > /dev/null; then
    echo "📦 Stopping development servers..."
    pkill -f "pnpm dev" || true
    pkill -f "vite" || true
    pkill -f "wrangler" || true
    pkill -f "turbo" || true
    sleep 2
    echo "✅ Main development servers stopped"
else
    echo "⚠️  No development servers running"
fi