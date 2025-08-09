#!/bin/bash

# Start DataForge Cloudflare Worker test in tmux session
SESSION_NAME="dataforge-cf-worker"
PORT=9876
CONFIG=${1:-"wrangler-minimal.toml"}

echo "🚀 Starting DataForge Cloudflare Worker test with config: $CONFIG"

# Kill existing session if it exists
tmux kill-session -t $SESSION_NAME 2>/dev/null || true

# Start new tmux session in detached mode
tmux new-session -d -s $SESSION_NAME

# Run the worker in the session
tmux send-keys -t $SESSION_NAME "cd /home/benfreed/vibestack/worktrees/issue-64/packages/dataforge/src/worker-test" C-m
tmux send-keys -t $SESSION_NAME "wrangler dev --config $CONFIG --port $PORT" C-m

echo "✅ Worker starting in tmux session '$SESSION_NAME' on port $PORT"
echo ""
echo "Commands:"
echo "  View logs:    tmux attach -t $SESSION_NAME"
echo "  Stop worker:  tmux kill-session -t $SESSION_NAME"
echo "  Test worker:  curl http://localhost:$PORT/?type=health"
echo ""

# Wait a moment and show initial output
sleep 3
echo "📋 Initial logs:"
tmux capture-pane -t $SESSION_NAME -p | tail -10