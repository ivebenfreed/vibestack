#!/bin/bash

# dev-main.sh - Start development servers with main/staging default ports
# Usage: ./scripts/dev-main.sh

set -euo pipefail

# Force main mode to use default ports
export MAIN_MODE=true

# Start the dev server in tmux background session
./scripts/tmux-bg.sh vibestack-dev-main "pnpm dev:local"