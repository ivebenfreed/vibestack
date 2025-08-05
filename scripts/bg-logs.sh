#!/bin/bash

# bg-logs.sh - Get logs from any tmux session
# Usage: ./scripts/bg-logs.sh <session-name> [lines]
# Example: ./scripts/bg-logs.sh dev-servers 100
#          ./scripts/bg-logs.sh dev-servers     # Default 50 lines

set -euo pipefail

# Check if tmux is available
if ! command -v tmux &> /dev/null; then
    echo "Error: tmux is not installed."
    exit 1
fi

# Check arguments
if [ $# -lt 1 ]; then
    echo "Usage: $0 <session-name> [lines]"
    echo "Example: $0 dev-servers 100"
    echo "         $0 dev-servers      # Default 50 lines"
    exit 1
fi

SESSION_NAME="$1"
LINES="${2:-50}"

# Validate lines parameter is a number
if ! [[ "$LINES" =~ ^[0-9]+$ ]]; then
    echo "Error: Lines parameter must be a positive number"
    exit 1
fi

# Check if session exists
if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "Error: Session '$SESSION_NAME' not found"
    echo "Use './scripts/bg-status.sh' to see all active sessions"
    exit 1
fi

# Get session status first
session_info=$(tmux list-sessions -F "#{session_name}: #{session_windows} windows (created #{session_created_string})" | grep "^$SESSION_NAME:")

echo "=== Logs from session '$SESSION_NAME' (last $LINES lines) ==="
echo "Session info: $session_info"
echo "=================================================="

# Capture pane content (this gets the scrollback buffer)
tmux capture-pane -t "$SESSION_NAME" -p -S "-$LINES"

echo ""
echo "=================================================="
echo "End of logs. Use './scripts/bg-status.sh $SESSION_NAME' to check session status"
echo "Use './scripts/bg-stop.sh $SESSION_NAME' to stop the session"