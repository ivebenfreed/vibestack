#!/bin/bash

# tmux-bg.sh - Universal background process runner
# Usage: ./scripts/tmux-bg.sh <session-name> <command>
# Example: ./scripts/tmux-bg.sh dev-servers "pnpm dev:local"

set -euo pipefail

# Check if tmux is available
if ! command -v tmux &> /dev/null; then
    echo "Error: tmux is not installed. Please install tmux to use background process management."
    exit 1
fi

# Check arguments
if [ $# -lt 2 ]; then
    echo "Usage: $0 <session-name> <command>"
    echo "Example: $0 dev-servers \"pnpm dev:local\""
    exit 1
fi

SESSION_NAME="$1"
COMMAND="$2"

# Validate session name (alphanumeric, hyphens, underscores only)
if [[ ! "$SESSION_NAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    echo "Error: Session name must contain only alphanumeric characters, hyphens, and underscores"
    exit 1
fi

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
BASE_DB_PORT=5432
BASE_PROXY_PORT=4444

# Calculate ports with offset
export SERVER_PORT=$((BASE_SERVER_PORT + OFFSET))
export WEB_PORT=$((BASE_WEB_PORT + OFFSET))
export DB_PORT=$((BASE_DB_PORT + OFFSET))
export PROXY_PORT=$((BASE_PROXY_PORT + OFFSET))
export PR_NUMBER="$ISSUE_NUMBER"

# Check if session already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "✓ Session '$SESSION_NAME' already exists."
    echo "Use './scripts/bg-status.sh' to check status or './scripts/bg-stop.sh $SESSION_NAME' to stop it."
    exit 0
fi

# Create new detached session and run command
echo "Starting background process in tmux session: $SESSION_NAME"
if [ "$ISSUE_NUMBER" != "0" ]; then
    echo "Issue/PR: #$ISSUE_NUMBER"
fi
echo "Ports: Web=$WEB_PORT, Server=$SERVER_PORT, DB=$DB_PORT"
echo "Command: $COMMAND"

# Create session and run command with environment variables
tmux new-session -d -s "$SESSION_NAME" -c "$(pwd)" \
    "SERVER_PORT=$SERVER_PORT WEB_PORT=$WEB_PORT DB_PORT=$DB_PORT PROXY_PORT=$PROXY_PORT PR_NUMBER=$PR_NUMBER $COMMAND"

# Wait a moment for the command to start
sleep 2

# Verify session was created successfully
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "✓ Background process started successfully in session '$SESSION_NAME'"
    echo "  Use './scripts/bg-logs.sh $SESSION_NAME' to view logs"
    echo "  Use './scripts/bg-status.sh' to check all sessions"
    echo "  Use './scripts/bg-stop.sh $SESSION_NAME' to stop"
    
    # Check if the process is still running after a brief delay
    sleep 3
    if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
        echo ""
        echo "⚠️  WARNING: Session died immediately after starting!"
        echo "This usually means the command failed. Here's the last output:"
        echo "================================================================"
        # Try to capture any logs that might have been written
        tmux capture-pane -t "$SESSION_NAME" -p 2>/dev/null | tail -50 || echo "Could not capture output"
        echo "================================================================"
        exit 1
    fi
else
    echo "Error: Failed to create tmux session"
    exit 1
fi