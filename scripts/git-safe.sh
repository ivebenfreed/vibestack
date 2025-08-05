#!/bin/bash

# Git wrapper that automatically restores package names before operations
# This prevents worktree-specific package names from being committed

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESTORE_SCRIPT="$SCRIPT_DIR/restore-package-names.sh"

# Commands that should trigger package name restoration
RESTORE_COMMANDS=("add" "commit" "push" "merge" "rebase" "cherry-pick" "stash")

# Function to check if we should restore package names
should_restore() {
    local command="$1"
    
    for restore_cmd in "${RESTORE_COMMANDS[@]}"; do
        if [[ "$command" == "$restore_cmd"* ]]; then
            return 0
        fi
    done
    
    return 1
}

# Get the git command being executed
GIT_COMMAND="$1"

# Check if we need to restore package names
if should_restore "$GIT_COMMAND" && [ -f "$RESTORE_SCRIPT" ]; then
    echo "🔍 Git operation detected: $GIT_COMMAND"
    
    # Check if we're in a worktree with package backup
    if [ -f ".worktree-package-backup.json" ]; then
        echo "🛡️ Restoring original package names before git operation..."
        "$RESTORE_SCRIPT" restore
        
        # Store flag to reapply worktree names after operation
        REAPPLY_AFTER=true
    fi
fi

# Execute the actual git command
echo "⚡ Executing: git $*"
git "$@"
GIT_EXIT_CODE=$?

# Reapply worktree names after successful git operation (if needed)
if [ "${REAPPLY_AFTER:-false}" = "true" ] && [ $GIT_EXIT_CODE -eq 0 ] && [ -f "$RESTORE_SCRIPT" ]; then
    echo "🔄 Reapplying worktree-specific package names..."
    "$RESTORE_SCRIPT" reapply
fi

exit $GIT_EXIT_CODE