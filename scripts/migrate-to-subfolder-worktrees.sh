#!/bin/bash

# Script to update worktree scripts for subfolder-based structure
# Instead of ../vibestack-issue-N, use ./worktrees/issue-N

set -e

echo "🔄 Updating worktree scripts for new subfolder structure..."

# Update start-issue.sh
echo "📝 Updating start-issue.sh..."
sed -i 's|WORKTREE_PATH="../vibestack-issue-${ISSUE_NUMBER}"|WORKTREE_PATH="./worktrees/issue-${ISSUE_NUMBER}"|g' scripts/start-issue.sh
sed -i 's|echo "  1. Create worktree ../vibestack-issue-123"|echo "  1. Create worktree ./worktrees/issue-123"|g' scripts/start-issue.sh
sed -i 's|if \[ -d "../vibestack/.claude" \]; then|if [ -d "./.claude" ]; then|g' scripts/start-issue.sh
sed -i 's|cp -r ../vibestack/.claude ./.claude|cp -r ./.claude "$WORKTREE_PATH/.claude"|g' scripts/start-issue.sh
sed -i 's|if \[ -d "../vibestack/packages/dataforge/src/generated" \]; then|if [ -d "./packages/dataforge/src/generated" ]; then|g' scripts/start-issue.sh
sed -i 's|cp -r ../vibestack/packages/dataforge/src/generated/\* ./packages/dataforge/src/generated/|cp -r ./packages/dataforge/src/generated/* "$WORKTREE_PATH/packages/dataforge/src/generated/"|g' scripts/start-issue.sh

# Update finish-issue.sh
echo "📝 Updating finish-issue.sh..."
sed -i 's|WORKTREE_PATH="../vibestack-issue-${ISSUE_NUMBER}"|WORKTREE_PATH="./worktrees/issue-${ISSUE_NUMBER}"|g' scripts/finish-issue.sh
sed -i 's|echo "  2. Remove worktree ../vibestack-issue-123"|echo "  2. Remove worktree ./worktrees/issue-123"|g' scripts/finish-issue.sh

# Update fix-worktree-deps.sh
echo "📝 Updating fix-worktree-deps.sh..."
sed -i 's|echo "  ./scripts/fix-worktree-deps.sh ../vibestack-issue-1"|echo "  ./scripts/fix-worktree-deps.sh ./worktrees/issue-1"|g' scripts/fix-worktree-deps.sh
sed -i 's|if \[ -d "../vibestack/packages/dataforge/src/generated" \]; then|if [ -d "$(git rev-parse --show-toplevel)/packages/dataforge/src/generated" ]; then|g' scripts/fix-worktree-deps.sh
sed -i 's|cp -r ../vibestack/packages/dataforge/src/generated/\* packages/dataforge/src/generated/|cp -r "$(git rev-parse --show-toplevel)/packages/dataforge/src/generated/"* packages/dataforge/src/generated/|g' scripts/fix-worktree-deps.sh

# Update list-issues.sh
echo "📝 Updating list-issues.sh..."
sed -i 's|echo "   cd ../vibestack-issue-\[N\]        # Switch to issue worktree"|echo "   cd ./worktrees/issue-[N]        # Switch to issue worktree"|g' scripts/list-issues.sh

# Create worktrees directory if it doesn't exist
if [ ! -d "worktrees" ]; then
    echo "📁 Creating worktrees directory..."
    mkdir -p worktrees
fi

echo ""
echo "✅ Scripts updated for new subfolder structure!"
echo ""
echo "📍 New worktree structure:"
echo "   vibestack/"
echo "   ├── .claude/          # Shared Claude settings"
echo "   ├── worktrees/"
echo "   │   ├── main/        # Main branch"
echo "   │   ├── issue-123/   # Issue branches"
echo "   │   └── pr-456/      # PR branches"
echo "   └── (current staging branch files)"
echo ""
echo "🎯 Usage examples:"
echo "   ./scripts/start-issue.sh 123    # Creates ./worktrees/issue-123"
echo "   ./scripts/finish-issue.sh 123   # Cleans up ./worktrees/issue-123"