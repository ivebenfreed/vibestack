#!/bin/bash

# bg-stop.sh - Stop specific background process
# Usage: ./scripts/bg-stop.sh <session-name>
# Example: ./scripts/bg-stop.sh dev-servers

set -euo pipefail

# Check if tmux is available
if ! command -v tmux &> /dev/null; then
    echo "Error: tmux is not installed."
    exit 1
fi

# Check arguments
if [ $# -ne 1 ]; then
    echo "Usage: $0 <session-name>"
    echo "Example: $0 dev-servers"
    echo ""
    echo "Available sessions:"
    ./scripts/bg-status.sh 2>/dev/null || echo "  No sessions running"
    exit 1
fi

SESSION_NAME="$1"

# Check if session exists
if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "Error: Session '$SESSION_NAME' not found"
    echo ""
    echo "Available sessions:"
    ./scripts/bg-status.sh 2>/dev/null || echo "  No sessions running"
    exit 1
fi

# Get session info before stopping
echo "Stopping session '$SESSION_NAME'..."

# Send Ctrl-C to gracefully stop any running processes
echo "Sending interrupt signal to running processes..."
tmux send-keys -t "$SESSION_NAME" C-c 2>/dev/null || true

# Wait a moment for graceful shutdown
sleep 2

# Check if session still exists (processes may have stopped gracefully)
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "Force killing session..."
    tmux kill-session -t "$SESSION_NAME"
fi

# Verify session is gone
if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "✓ Session '$SESSION_NAME' stopped successfully"
    
    # Show remaining sessions if any
    if tmux list-sessions &>/dev/null; then
        echo ""
        echo "Remaining sessions:"
        ./scripts/bg-status.sh 2>/dev/null || true
    else
        echo "No background sessions remaining."
    fi
else
    echo "Error: Failed to stop session '$SESSION_NAME'"
    exit 1
fi