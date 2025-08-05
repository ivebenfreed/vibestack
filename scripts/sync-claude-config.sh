#!/bin/bash

# Sync Claude and MCP configurations to worktrees
# This script copies Claude settings from the main repository to worktrees

set -e

WORKTREE_PATH="$1"
FLAG="$2"
ISSUE_NUMBER="$3"
# Get the actual main repository root, not the worktree root
MAIN_REPO_ROOT="$(git worktree list | head -1 | awk '{print $1}')"

# Check flags
IS_TEST_SETUP="false"
UPDATE_AUTH_STATE="false"

if [ "$FLAG" = "--test-setup" ]; then
    IS_TEST_SETUP="true"
elif [ "$FLAG" = "--update-auth-state" ]; then
    UPDATE_AUTH_STATE="true"
fi

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
    local issue_number="$2"
    local test_setup_flag="$3"
    local claude_md="$dest_dir/CLAUDE.md"
    
    if [ ! -f "$claude_md" ]; then
        return
    fi
    
    # Calculate ports based on issue number
    local port_offset=$((issue_number * 10))
    local web_port=$((5173 + port_offset))
    local server_port=$((8787 + port_offset))
    local db_port=$((5432 + port_offset))
    local proxy_port=$((65432 - 60978 + port_offset))  # 4454 for Issue #1
    
    echo "📝 Updating CLAUDE.md configuration for Issue #$issue_number..."
    
    # Create a temporary file with updated content
    local temp_file=$(mktemp)
    
    # Add or update the worktree-specific section
    if grep -q "## Current Worktree Configuration" "$claude_md"; then
        # Update existing section
        sed -i "/## Current Worktree Configuration/,/^##[^#]/{
            s/\*\*This is.*worktree with the following ports:\*\*/\*\*This is Issue #$issue_number worktree with the following ports:\*\*/
            s/- Web application: .*/- Web application: \`http:\/\/localhost:$web_port\`/
            s/- Server API: .*/- Server API: \`http:\/\/localhost:$server_port\`/
            s/- Database: .*/- Database: \`postgres:\/\/postgres:postgres@localhost:$db_port\/vibestack_dev_issue_$issue_number\`/
            s/- Proxy: .*/- Proxy: Port $proxy_port/
        }" "$claude_md"
    else
        # Add new section after the header
        awk -v web="$web_port" -v server="$server_port" -v db="$db_port" -v proxy="$proxy_port" -v issue="$issue_number" -v test_setup="$test_setup_flag" '
            /^# CLAUDE.md/ {
                print
                print ""
                print "## Current Worktree Configuration"
                print ""
                print "**This is Issue #" issue " worktree with the following ports:**"
                print ""
                print "- Web application: `http://localhost:" web "`"
                print "- Server API: `http://localhost:" server "`"
                print "- Database: `postgres://postgres:postgres@localhost:" db "/vibestack_dev_issue_" issue "`"
                print "- Proxy: Port " proxy
                print ""
                if (test_setup == "true") {
                    print "### Playwright Test Environment"
                    print ""
                    print "**✅ READY TO USE** - This worktree has pre-configured Playwright authentication:"
                    print ""
                    print "- **Auth file**: `.playwright/auth/auth-" issue ".json` (will be created after setup)"
                    print "- **User**: ben@getelevra.com (authenticated with valid session)"
                    print "- **Profile**: Isolated browser profile in `.playwright/profiles/profile-" issue "/`"
                    print ""
                    print "**Tests will use existing auth state automatically** - no manual setup needed."
                    print ""
                }
                next
            }
            {print}
        ' "$claude_md" > "$temp_file"
        
        mv "$temp_file" "$claude_md"
    fi
}

# Function to update CLAUDE.md with actual auth state after tests complete
update_claude_md_auth_state() {
    local dest_dir="$1"
    local issue_number="$2"
    local claude_md="$dest_dir/CLAUDE.md"
    local auth_file="$dest_dir/.playwright/auth/auth-$issue_number.json"
    
    if [ ! -f "$claude_md" ] || [ ! -f "$auth_file" ]; then
        return
    fi
    
    echo "📝 Updating CLAUDE.md with actual auth state for Issue #$issue_number..."
    
    # Extract LSN from auth file
    local lsn=$(grep -o '"currentLSN":"[^"]*"' "$auth_file" | sed 's/"currentLSN":"\([^"]*\)"/\1/')
    local file_size=$(stat -c%s "$auth_file" 2>/dev/null || stat -f%z "$auth_file" 2>/dev/null || echo "unknown")
    
    # Update the Playwright Test Environment section if it exists
    if grep -q "### Playwright Test Environment" "$claude_md"; then
        # Create a temporary file with updated content
        local temp_file=$(mktemp)
        
        awk -v lsn="$lsn" -v size="$file_size" -v issue="$issue_number" '
            /### Playwright Test Environment/ {
                print
                print ""
                print "**✅ READY TO USE** - This worktree has pre-configured Playwright authentication:"
                print ""
                print "- **Auth file**: `.playwright/auth/auth-" issue ".json` (" size " bytes)"
                print "- **Current LSN**: `" lsn "` (sync state persisted)"
                print "- **User**: ben@getelevra.com (authenticated with valid session)"
                print "- **Profile**: Isolated browser profile in `.playwright/profiles/profile-" issue "/`"
                print ""
                print "**DO NOT re-run auth setup** - use existing state for all tests."
                print ""
                # Skip the old content until next section
                in_section = 1
                next
            }
            /^##[^#]/ && in_section {
                in_section = 0
                print
                next
            }
            !in_section {
                print
            }
        ' "$claude_md" > "$temp_file"
        
        mv "$temp_file" "$claude_md"
    fi
}

# Function to copy config files
copy_config_files() {
    local source_dir="$1"
    local dest_dir="$2"
    local test_setup="$3"
    
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
        
        # Update configuration if this is an issue worktree
        local issue_number=$(get_pr_number "$dest_dir")
        if [ -n "$issue_number" ]; then
            update_claude_md_ports "$dest_dir" "$issue_number" "$test_setup"
        fi
    fi
}

# Main logic
if [ "$UPDATE_AUTH_STATE" = "true" ]; then
    # Update auth state in CLAUDE.md
    if [ -z "$WORKTREE_PATH" ] || [ -z "$ISSUE_NUMBER" ]; then
        echo "❌ Error: --update-auth-state requires worktree path and issue number"
        exit 1
    fi
    
    if [ ! -d "$WORKTREE_PATH" ]; then
        echo "❌ Error: Worktree path does not exist: $WORKTREE_PATH"
        exit 1
    fi
    
    update_claude_md_auth_state "$WORKTREE_PATH" "$ISSUE_NUMBER"
elif [ -z "$WORKTREE_PATH" ]; then
    # If no worktree path provided, sync all worktrees
    echo "🔄 Syncing Claude configs to all worktrees..."
    
    # Get list of worktrees (excluding main repo)
    git worktree list --porcelain | grep "^worktree" | grep -v "$MAIN_REPO_ROOT$" | cut -d' ' -f2 | while read -r worktree; do
        if [ -d "$worktree" ]; then
            echo ""
            echo "📁 Syncing to: $worktree"
            copy_config_files "$MAIN_REPO_ROOT" "$worktree" "$IS_TEST_SETUP"
        fi
    done
else
    # Sync to specific worktree
    if [ ! -d "$WORKTREE_PATH" ]; then
        echo "❌ Error: Worktree path does not exist: $WORKTREE_PATH"
        exit 1
    fi
    
    echo "🔄 Syncing Claude configs to: $WORKTREE_PATH"
    copy_config_files "$MAIN_REPO_ROOT" "$WORKTREE_PATH" "$IS_TEST_SETUP"
fi

echo ""
echo "✅ Claude configuration sync complete!"