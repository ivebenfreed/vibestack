#!/bin/bash

# Sync Claude and MCP configurations to worktrees
# This script copies Claude settings from the main repository to worktrees

set -e

WORKTREE_PATH="$1"
MAIN_REPO_ROOT="$(git rev-parse --show-toplevel)"

# Function to get PR number from worktree branch
get_pr_number() {
    local worktree_path="$1"
    local branch_name=$(cd "$worktree_path" && git rev-parse --abbrev-ref HEAD)
    
    # Extract PR number from branch name (e.g., issue-1, pr-1, etc.)
    if [[ "$branch_name" =~ (issue|pr)-([0-9]+) ]]; then
        echo "${BASH_REMATCH[2]}"
    else
        echo ""
    fi
}

# Function to update port numbers in CLAUDE.md
update_claude_md_ports() {
    local dest_dir="$1"
    local pr_number="$2"
    local claude_md="$dest_dir/CLAUDE.md"
    
    if [ ! -f "$claude_md" ]; then
        return
    fi
    
    # Calculate ports based on PR number
    local port_offset=$((pr_number * 10))
    local web_port=$((5173 + port_offset))
    local server_port=$((8787 + port_offset))
    local db_port=$((5432 + port_offset))
    local proxy_port=$((65432 - 60978 + port_offset))  # 4454 for PR #1
    
    echo "📝 Updating port numbers in CLAUDE.md for PR #$pr_number..."
    
    # Create a temporary file with updated content
    local temp_file=$(mktemp)
    
    # Add or update the worktree-specific section
    if grep -q "## Current Worktree Configuration" "$claude_md"; then
        # Update existing section
        sed -i "/## Current Worktree Configuration/,/^##[^#]/{
            s/- Web application: .*/- Web application: \`http:\/\/localhost:$web_port\`/
            s/- Server API: .*/- Server API: \`http:\/\/localhost:$server_port\`/
            s/- Database: .*/- Database: \`postgres:\/\/postgres:postgres@localhost:$db_port\/vibestack_dev_issue_$pr_number\`/
            s/- Proxy: .*/- Proxy: Port $proxy_port/
        }" "$claude_md"
    else
        # Add new section after the header
        awk -v web="$web_port" -v server="$server_port" -v db="$db_port" -v proxy="$proxy_port" -v pr="$pr_number" '
            /^# CLAUDE.md/ {
                print
                print ""
                print "## Current Worktree Configuration"
                print ""
                print "**This is PR #" pr " worktree with the following ports:**"
                print ""
                print "- Web application: `http://localhost:" web "`"
                print "- Server API: `http://localhost:" server "`"
                print "- Database: `postgres://postgres:postgres@localhost:" db "/vibestack_dev_issue_" pr "`"
                print "- Proxy: Port " proxy
                print ""
                next
            }
            {print}
        ' "$claude_md" > "$temp_file"
        
        mv "$temp_file" "$claude_md"
    fi
}

# Function to copy config files
copy_config_files() {
    local source_dir="$1"
    local dest_dir="$2"
    
    # Ensure destination directory exists
    mkdir -p "$dest_dir"
    
    # Copy .claude directory if it exists and is different
    if [ -d "$source_dir/.claude" ] && [ "$source_dir" != "$dest_dir" ]; then
        echo "📋 Copying .claude directory..."
        cp -r "$source_dir/.claude" "$dest_dir/"
    fi
    
    # Copy CLAUDE.md if it exists
    if [ -f "$source_dir/CLAUDE.md" ]; then
        echo "📋 Copying CLAUDE.md..."
        cp "$source_dir/CLAUDE.md" "$dest_dir/"
        
        # Update ports if this is a PR worktree
        local pr_number=$(get_pr_number "$dest_dir")
        if [ -n "$pr_number" ]; then
            update_claude_md_ports "$dest_dir" "$pr_number"
        fi
    fi
}

# Main logic
if [ -z "$WORKTREE_PATH" ]; then
    # If no worktree path provided, sync all worktrees
    echo "🔄 Syncing Claude configs to all worktrees..."
    
    # Get list of worktrees (excluding main repo)
    git worktree list --porcelain | grep "^worktree" | grep -v "$MAIN_REPO_ROOT$" | cut -d' ' -f2 | while read -r worktree; do
        if [ -d "$worktree" ]; then
            echo ""
            echo "📁 Syncing to: $worktree"
            copy_config_files "$MAIN_REPO_ROOT" "$worktree"
        fi
    done
else
    # Sync to specific worktree
    if [ ! -d "$WORKTREE_PATH" ]; then
        echo "❌ Error: Worktree path does not exist: $WORKTREE_PATH"
        exit 1
    fi
    
    echo "🔄 Syncing Claude configs to: $WORKTREE_PATH"
    copy_config_files "$MAIN_REPO_ROOT" "$WORKTREE_PATH"
fi

echo ""
echo "✅ Claude configuration sync complete!"