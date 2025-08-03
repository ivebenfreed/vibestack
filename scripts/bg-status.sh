#!/bin/bash

# bg-status.sh - Check all background processes
# Usage: ./scripts/bg-status.sh [session-name]
# Example: ./scripts/bg-status.sh           # Show all sessions
#          ./scripts/bg-status.sh dev-servers # Check specific session

set -euo pipefail

# Check if tmux is available
if ! command -v tmux &> /dev/null; then
    echo "Error: tmux is not installed."
    exit 1
fi

# Function to get process info for a session
get_session_info() {
    local session="$1"
    local pane_info
    local command_info
    
    # Get the command running in the session
    pane_info=$(tmux list-panes -t "$session" -F "#{pane_current_command}" 2>/dev/null | head -1)
    
    # Get more detailed command if available
    command_info=$(tmux capture-pane -t "$session" -p | tail -5 | grep -v "^$" | tail -1 2>/dev/null || echo "")
    
    echo "  Command: $pane_info"
    if [ -n "$command_info" ] && [ "$command_info" != "$pane_info" ]; then
        echo "  Latest: $command_info"
    fi
}

# Function to check if specific session exists
check_specific_session() {
    local session_name="$1"
    
    if tmux has-session -t "$session_name" 2>/dev/null; then
        echo "✓ Session '$session_name' is running"
        get_session_info "$session_name"
        return 0
    else
        echo "✗ Session '$session_name' not found"
        return 1
    fi
}

# Main logic
if [ $# -eq 1 ]; then
    # Check specific session
    check_specific_session "$1"
    exit $?
fi

# List all tmux sessions
if ! tmux list-sessions &>/dev/null; then
    echo "No tmux sessions are currently running."
    exit 0
fi

echo "Background processes (tmux sessions):"
echo "======================================"

# Get list of sessions and process each one
while IFS= read -r session_line; do
    # Extract session name (before the colon)
    session_name=$(echo "$session_line" | cut -d: -f1)
    
    # Extract session info (after the colon)
    session_info=$(echo "$session_line" | cut -d: -f2-)
    
    echo ""
    echo "📋 Session: $session_name"
    echo "  Status: $session_info"
    get_session_info "$session_name"
    
done < <(tmux list-sessions 2>/dev/null)

echo ""
echo "Use './scripts/bg-logs.sh <session-name>' to view logs"
echo "Use './scripts/bg-stop.sh <session-name>' to stop a session"