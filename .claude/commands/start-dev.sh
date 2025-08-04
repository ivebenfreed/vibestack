#!/bin/bash

echo "Starting development servers..."

# Start the dev servers using the existing script
./scripts/tmux-bg.sh vibestack-dev "pnpm dev:local"

echo "✅ Development servers starting in background"
echo ""
echo "Use these commands to manage the servers:"
echo "- View logs: ./scripts/bg-logs.sh vibestack-dev"
echo "- Check status: ./scripts/bg-status.sh vibestack-dev"
echo "- Stop servers: ./scripts/bg-stop.sh vibestack-dev"