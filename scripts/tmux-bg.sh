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
    # 1. Check for explicit MAIN_MODE flag
    if [ "${MAIN_MODE:-}" = "true" ]; then
        echo "0"
        return
    fi
    
    # 2. Environment variable (manual override)
    if [ -n "${PR_NUMBER:-}" ]; then
        echo "$PR_NUMBER"
        return
    fi
    
    # 3. Git branch name (issue-123, feature-456, pr-789)
    if command -v git &> /dev/null; then
        local branch=$(git branch --show-current 2>/dev/null || true)
        if [[ "$branch" =~ (issue-|feature-|pr-)([0-9]+) ]]; then
            echo "${BASH_REMATCH[2]}"
            return
        fi
    fi
    
    # 4. Working directory name (worktrees/issue-123)
    local cwd=$(pwd)
    if [[ "$cwd" =~ /issue-([0-9]+) ]]; then
        echo "${BASH_REMATCH[1]}"
        return
    fi
    
    # Default to 0 (main development)
    echo "0"
}

# Get issue number for session naming
ISSUE_NUMBER=$(detect_issue_number)

# Load environment from .env.local (single source of truth)
if [ -f ".env.local" ]; then
    set -a
    source .env.local
    set +a
else
    echo "⚠️  Warning: .env.local not found. Running configure-worktree-env.sh..."
    ./scripts/configure-worktree-env.sh
    
    # Now load the created .env.local
    set -a
    source .env.local
    set +a
fi

# Export for child processes
export SERVER_PORT
export WEB_PORT
export DB_PORT
export PROXY_PORT
export PR_NUMBER
export ISSUE_NUMBER

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
else
    echo "Mode: Main/Staging (default ports)"
fi
echo "Ports: Web=$WEB_PORT, Server=$SERVER_PORT, DB=$DB_PORT"
echo "Command: $COMMAND"

# If the command is "pnpm dev", we need to run the setup-dev-ports script
# which will detect the issue number and pass the right ports to turbo
if [[ "$COMMAND" == "pnpm dev" ]]; then
    # Just run pnpm dev as-is, which already includes setup-dev-ports.js
    ACTUAL_COMMAND="pnpm dev"
    echo "Running with dynamic ports via setup-dev-ports.js"
else
    ACTUAL_COMMAND="$COMMAND"
fi

# Create session with bash that stays alive even if command fails
# The session will remain open for debugging
tmux new-session -d -s "$SESSION_NAME" -c "$(pwd)" \
    bash -c "SERVER_PORT=$SERVER_PORT WEB_PORT=$WEB_PORT DB_PORT=$DB_PORT PROXY_PORT=$PROXY_PORT PR_NUMBER=$PR_NUMBER $ACTUAL_COMMAND; echo ''; echo '⚠️  Command exited with code: $?'; echo 'Session kept alive for debugging. Press Ctrl+C to close.'; exec bash"

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