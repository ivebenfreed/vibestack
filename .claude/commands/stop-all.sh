#!/bin/bash

echo "Stopping all development servers..."

# Stop all vibestack tmux sessions
for session in $(tmux ls 2>/dev/null | grep -E "vibestack-" | awk -F: '{print $1}'); do
    echo "Stopping $session..."
    ./scripts/bg-stop.sh "$session"
done

echo ""
echo "✅ All development servers stopped"