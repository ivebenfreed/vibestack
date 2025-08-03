#!/bin/bash

# dev-start.sh - Wrapper for starting development servers
# This starts the VibeStack development environment in the background
# Usage: ./scripts/dev-start.sh

set -euo pipefail

SESSION_NAME="vibestack-dev"
DEV_COMMAND="pnpm dev:local"

echo "Starting VibeStack development servers..."
echo "Session: $SESSION_NAME"
echo "Command: $DEV_COMMAND"
echo ""

# Use the tmux-bg.sh script to start the dev servers
./scripts/tmux-bg.sh "$SESSION_NAME" "$DEV_COMMAND"

if [ $? -eq 0 ]; then
    echo ""
    echo "🚀 Development servers starting in background!"
    echo ""
    echo "Quick commands:"
    echo "  📋 Status:  ./scripts/bg-status.sh $SESSION_NAME"
    echo "  📄 Logs:    ./scripts/dev-logs.sh [lines]"
    echo "  🛑 Stop:    ./scripts/bg-stop.sh $SESSION_NAME"
    echo ""
    echo "Once servers are up, you can access:"
    echo "  🌐 Web:     http://localhost:5213"
    echo "  🔧 API:     http://localhost:8827"
fi