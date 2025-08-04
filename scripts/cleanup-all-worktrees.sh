#!/bin/bash

# Master cleanup script for all worktree-related resources
# This script cleans up:
# - Git worktrees
# - Docker containers and volumes
# - tmux background sessions
# - Local git branches

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🧹 VibeStack Master Cleanup"
echo "=========================="
echo ""

# Function to cleanup a specific worktree
cleanup_worktree() {
    local worktree_path=$1
    local worktree_name=$(basename "$worktree_path")
    
    echo "📁 Cleaning up worktree: $worktree_name"
    
    # Extract issue number if it's an issue worktree
    if [[ "$worktree_name" =~ issue-([0-9]+) ]]; then
        local issue_num="${BASH_REMATCH[1]}"
        
        # Stop tmux sessions for this issue
        local tmux_sessions=$(tmux ls 2>/dev/null | grep -E "vibestack-.*-issue-${issue_num}:" | cut -d: -f1 || true)
        if [ -n "$tmux_sessions" ]; then
            echo "$tmux_sessions" | while read session; do
                echo "   Stopping tmux session: $session"
                "$SCRIPT_DIR/bg-stop.sh" "$session" >/dev/null 2>&1 || true
            done
        fi
        
        # Clean up Docker resources for this issue
        if [ -x "$SCRIPT_DIR/cleanup-pr-docker.sh" ]; then
            echo "   Cleaning Docker resources for issue #$issue_num..."
            "$SCRIPT_DIR/cleanup-pr-docker.sh" "$issue_num" >/dev/null 2>&1 || true
        fi
    fi
    
    # Remove the worktree
    echo "   Removing worktree: $worktree_path"
    git worktree remove --force "$worktree_path" 2>/dev/null || true
}

# Step 1: Stop all tmux sessions
echo "🔄 Stopping all background tmux sessions..."
TMUX_SESSIONS=$(tmux ls 2>/dev/null | grep -E "vibestack-" | cut -d: -f1 || true)
if [ -n "$TMUX_SESSIONS" ]; then
    echo "$TMUX_SESSIONS" | while read session; do
        echo "   Stopping: $session"
        "$SCRIPT_DIR/bg-stop.sh" "$session" >/dev/null 2>&1 || true
    done
else
    echo "   No tmux sessions found"
fi
echo ""

# Step 2: Clean up all git worktrees
echo "🌳 Cleaning up git worktrees..."
WORKTREES=$(git worktree list --porcelain | grep "^worktree " | cut -d' ' -f2- | grep -v "^$PROJECT_ROOT$" || true)
if [ -n "$WORKTREES" ]; then
    echo "$WORKTREES" | while read worktree; do
        cleanup_worktree "$worktree"
    done
else
    echo "   No worktrees found"
fi

# Remove worktrees directory if empty
if [ -d "$PROJECT_ROOT/worktrees" ]; then
    if [ -z "$(ls -A "$PROJECT_ROOT/worktrees" 2>/dev/null)" ]; then
        rmdir "$PROJECT_ROOT/worktrees" 2>/dev/null || true
        echo "   Removed empty worktrees directory"
    fi
fi
echo ""

# Step 3: Clean up all Docker resources
echo "🐳 Cleaning up Docker resources..."
if [ -x "$SCRIPT_DIR/cleanup-pr-docker.sh" ]; then
    # Get all PR numbers from Docker resources
    PR_NUMBERS=$("$SCRIPT_DIR/cleanup-pr-docker.sh" 2>&1 | grep "Found resources for PRs:" | sed 's/Found resources for PRs://' | tr ' ' '\n' | sort -u | grep -v "^$" || true)
    if [ -n "$PR_NUMBERS" ]; then
        echo "$PR_NUMBERS" | while read pr; do
            if [ -n "$pr" ]; then
                echo "   Cleaning PR #$pr Docker resources..."
                "$SCRIPT_DIR/cleanup-pr-docker.sh" "$pr" >/dev/null 2>&1 || true
            fi
        done
    else
        echo "   No PR Docker resources found"
    fi
else
    echo "   Docker cleanup script not found"
fi
echo ""

# Step 4: Clean up local git branches
echo "🌿 Cleaning up local git branches..."
LOCAL_BRANCHES=$(git branch | grep -E "^\s+(issue-|pr-)" | sed 's/^\s*//' || true)
if [ -n "$LOCAL_BRANCHES" ]; then
    echo "$LOCAL_BRANCHES" | while read branch; do
        echo "   Deleting branch: $branch"
        git branch -D "$branch" 2>/dev/null || true
    done
else
    echo "   No issue/PR branches found"
fi
echo ""

# Step 5: Final verification
echo "✅ Cleanup Complete!"
echo ""
echo "Final Status:"
echo "============="

# Check worktrees
REMAINING_WORKTREES=$(git worktree list | grep -v "^$PROJECT_ROOT " | wc -l)
echo "📁 Worktrees: $REMAINING_WORKTREES remaining"

# Check tmux sessions
REMAINING_TMUX=$(tmux ls 2>/dev/null | grep -E "vibestack-" | wc -l || echo "0")
echo "🔄 Tmux sessions: $REMAINING_TMUX remaining"

# Check Docker resources
REMAINING_CONTAINERS=$(docker ps -a --format "{{.Names}}" | grep -E "vibestack-.*-[0-9]+" | wc -l || echo "0")
REMAINING_VOLUMES=$(docker volume ls --format "{{.Name}}" | grep -E "(issue-|pr.*)[0-9]+" | wc -l || echo "0")
echo "🐳 Docker containers: $REMAINING_CONTAINERS remaining"
echo "🐳 Docker volumes: $REMAINING_VOLUMES remaining"

# Check branches
REMAINING_BRANCHES=$(git branch | grep -E "^\s+(issue-|pr-)" | wc -l || echo "0")
echo "🌿 Local branches: $REMAINING_BRANCHES remaining"

echo ""
echo "🎉 All worktree-related resources have been cleaned up!"