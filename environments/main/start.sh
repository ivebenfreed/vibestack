#!/bin/bash
# Main Development Environment Startup Script

set -e

echo "🚀 Starting Main Development Environment"
echo "========================================"

# Check if already running
if pgrep -f "pnpm dev" > /dev/null; then
    echo "⚠️  Main development servers are already running"
    echo "   Web: http://localhost:5173"
    echo "   API: http://localhost:8787"
    exit 0
fi

# Navigate to project root
cd "$(dirname "$0")/../.."

echo "📦 Starting development servers..."
echo "   Web: http://localhost:5173"
echo "   API: http://localhost:8787"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Start development servers
exec pnpm dev