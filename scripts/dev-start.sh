#!/bin/bash

# dev-start.sh - Wrapper for starting development servers
# This starts the VibeStack development environment in the background
# Usage: ./scripts/dev-start.sh

set -euo pipefail

DEV_COMMAND="pnpm dev:local"

# Function to detect issue number from branch/directory
detect_issue_number() {
    # 1. Environment variable (manual override)
    if [ -n "${PR_NUMBER:-}" ]; then
        echo "$PR_NUMBER"
        return
    fi
    
    # 2. Git branch name (issue-123, feature-456, pr-789)
    if command -v git &> /dev/null; then
        local branch=$(git branch --show-current 2>/dev/null || true)
        if [[ "$branch" =~ (issue-|feature-|pr-)([0-9]+) ]]; then
            echo "${BASH_REMATCH[2]}"
            return
        fi
    fi
    
    # 3. Working directory name (worktrees/issue-123)
    local cwd=$(pwd)
    if [[ "$cwd" =~ /issue-([0-9]+) ]]; then
        echo "${BASH_REMATCH[1]}"
        return
    fi
    
    # Default to 0 (main development)
    echo "0"
}

# Calculate ports based on issue number
ISSUE_NUMBER=$(detect_issue_number)
OFFSET=$((ISSUE_NUMBER * 10))

# Base ports
BASE_SERVER_PORT=8787
BASE_WEB_PORT=5173

# Calculate ports with offset
WEB_PORT=$((BASE_WEB_PORT + OFFSET))
SERVER_PORT=$((BASE_SERVER_PORT + OFFSET))

# Dynamic session name based on issue number
if [ "$ISSUE_NUMBER" != "0" ]; then
    SESSION_NAME="vibestack-dev-issue-$ISSUE_NUMBER"
else
    SESSION_NAME="vibestack-dev-main"
fi

echo "Starting VibeStack development servers..."
if [ "$ISSUE_NUMBER" != "0" ]; then
    echo "Issue/PR: #$ISSUE_NUMBER"
fi
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
    echo "  🌐 Web:     http://localhost:$WEB_PORT"
    echo "  🔧 API:     http://localhost:$SERVER_PORT"
fi