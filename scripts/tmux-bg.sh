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

# Check if session already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "✓ Session '$SESSION_NAME' already exists."
    echo "Use './scripts/bg-status.sh' to check status or './scripts/bg-stop.sh $SESSION_NAME' to stop it."
    exit 0
fi

# Create new detached session and run command
echo "Starting background process in tmux session: $SESSION_NAME"
echo "Command: $COMMAND"

# Create session and run command
tmux new-session -d -s "$SESSION_NAME" -c "$(pwd)" "$COMMAND"

# Verify session was created successfully
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "✓ Background process started successfully in session '$SESSION_NAME'"
    echo "  Use './scripts/bg-logs.sh $SESSION_NAME' to view logs"
    echo "  Use './scripts/bg-status.sh' to check all sessions"
    echo "  Use './scripts/bg-stop.sh $SESSION_NAME' to stop"
else
    echo "Error: Failed to create tmux session"
    exit 1
fi