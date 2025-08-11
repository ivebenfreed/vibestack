#!/bin/bash

# Create a worktree for a GitHub issue with full development environment
# Usage: ./scripts/create-issue-worktree.sh [ISSUE_NUMBER]

set -e

ISSUE_NUMBER="$1"

# Validate input
if [ -z "$ISSUE_NUMBER" ]; then
    echo "❌ Error: Issue number is required"
    echo ""
    echo "Usage: ./scripts/create-issue-worktree.sh [ISSUE_NUMBER]"
    echo ""
    echo "Example:"
    echo "  ./scripts/create-issue-worktree.sh 123"
    echo ""
    echo "This will:"
    echo "  1. Create worktree ./worktrees/issue-123"
    echo "  2. Create branch issue-123"
    echo "  3. Setup PR environment with isolated database"
    echo "  4. Start development server"
    exit 1
fi

# Validate issue number is numeric
if ! [[ "$ISSUE_NUMBER" =~ ^[0-9]+$ ]]; then
    echo "❌ Error: Issue number must be numeric"
    exit 1
fi

BRANCH_NAME="issue-${ISSUE_NUMBER}"
WORKTREE_PATH="./worktrees/issue-${ISSUE_NUMBER}"

echo "🚀 Starting work on GitHub issue #${ISSUE_NUMBER}"
echo ""

# Check if worktree already exists
if [ -d "$WORKTREE_PATH" ]; then
    echo "⚠️  Worktree already exists: $WORKTREE_PATH"
    echo "   Do you want to:"
    echo "   1) Remove existing and create fresh (r)"
    echo "   2) Switch to existing worktree (s)"
    echo "   3) Cancel (c)"
    read -p "   Choice (r/s/c): " -n 1 -r
    echo
    
    case $REPLY in
        [Rr])
            echo "🗑️  Removing existing worktree..."
            # Cleanup existing PR environment first
            cd "$WORKTREE_PATH" 2>/dev/null && PR_NUMBER="$ISSUE_NUMBER" ./scripts/cleanup-pr-env.sh 2>/dev/null || true
            cd "$(dirname "$0")/.."
            git worktree remove "$WORKTREE_PATH" --force
            ;;
        [Ss])
            echo "📂 Switching to existing worktree..."
            cd "$WORKTREE_PATH"
            echo ""
            echo "✅ Switched to existing worktree for issue #${ISSUE_NUMBER}"
            echo ""
            echo "🎯 Quick commands:"
            echo "   pnpm dev:local     # Start development server"
            echo "   pnpm forge:migrate:run:local  # Run migrations"
            echo ""
            echo "📱 Your environment:"
            echo "   Web:    http://localhost:$((5173 + ISSUE_NUMBER))"
            echo "   API:    http://localhost:$((8787 + ISSUE_NUMBER))"
            echo "   DB:     localhost:$((5432 + ISSUE_NUMBER))"
            exit 0
            ;;
        *)
            echo "❌ Cancelled"
            exit 1
            ;;
    esac
fi

# Check if branch already exists remotely
if git ls-remote --heads origin "$BRANCH_NAME" | grep -q "$BRANCH_NAME"; then
    echo "⚠️  Branch $BRANCH_NAME already exists on remote"
    echo "   Creating worktree from existing remote branch..."
    git worktree add "$WORKTREE_PATH" "$BRANCH_NAME"
else
    echo "1️⃣ Creating new worktree and branch..."
    git worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME"
fi

# Switch to worktree
cd "$WORKTREE_PATH"

echo ""
echo "1.5️⃣ Copying necessary untracked files..."
# Copy essential untracked files from main repo that aren't in git
MAIN_REPO_ROOT="$(git worktree list | head -1 | awk '{print $1}')"

# List of files to copy if they exist
COPY_FILES=(
  "apps/server/.env"  # Copy base .env with secrets
  # .env.local will be generated with worktree-specific ports
  "apps/web/.env.development"
  "apps/web/.env.development.generated"
  "apps/web/.env.local"
  "apps/web/.env.staging"
  "apps/web/.env.production"
  ".env.local"
  "packages/dataforge/.env"
  "packages/dataforge/.env.local"
  "packages/dataforge/.env.development"
  "packages/dataforge/.env.preview"
  "packages/dataforge/.env.production"
)

for file in "${COPY_FILES[@]}"; do
  if [ -f "${MAIN_REPO_ROOT}/${file}" ]; then
    # Create directory if it doesn't exist
    mkdir -p "$(dirname "${file}")"
    cp "${MAIN_REPO_ROOT}/${file}" "${file}"
    echo "   ✅ Copied ${file}"
  fi
done

echo ""
echo "2️⃣ Installing dependencies..."
echo "   🔄 Running pnpm install..."
# Note: postinstall script will handle Claude sync and Playwright MCP setup
pnpm install

echo ""
echo "2.1️⃣ Ensuring Claude configuration is synced..."
# Explicitly sync Claude config in case postinstall didn't work
# Pass test setup flag if this is a test setup run
TEST_SETUP_FLAG=""
if [ "${RUN_SETUP_TESTS:-false}" = "true" ] || [ "$2" = "--test-setup" ]; then
    TEST_SETUP_FLAG="--test-setup"
fi

if [ -f "${MAIN_REPO_ROOT}/scripts/sync-claude-config.sh" ]; then
    "${MAIN_REPO_ROOT}/scripts/sync-claude-config.sh" "$PWD" "$TEST_SETUP_FLAG"
    echo "   ✅ Claude configuration synced with database info"
else
    echo "   ⚠️ Could not sync Claude config - sync script not found"
fi

echo ""
echo "2.5️⃣ Setting up package name management..."
echo "   📝 Creating package name backup and issue-specific names..."

# Create a backup of original package names for restoration
PACKAGE_BACKUP_FILE=".worktree-package-backup.json"
node -e "
    const fs = require('fs');
    const backup = {};
    
    // Backup original package names
    if (fs.existsSync('package.json')) {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        backup.root = pkg.name;
    }
    if (fs.existsSync('apps/web/package.json')) {
        const pkg = JSON.parse(fs.readFileSync('apps/web/package.json', 'utf8'));
        backup.web = pkg.name;
    }
    if (fs.existsSync('apps/server/package.json')) {
        const pkg = JSON.parse(fs.readFileSync('apps/server/package.json', 'utf8'));
        backup.server = pkg.name;
    }
    
    fs.writeFileSync('${PACKAGE_BACKUP_FILE}', JSON.stringify(backup, null, 2));
    console.log('   ✅ Package names backed up to ${PACKAGE_BACKUP_FILE}');
"

# Update root package.json
if [ -f "package.json" ]; then
    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        pkg.name = 'vibestack-issue-${ISSUE_NUMBER}';
        fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
    "
    echo "   ✅ Root package.json updated"
fi

# Update apps/web/package.json
if [ -f "apps/web/package.json" ]; then
    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('apps/web/package.json', 'utf8'));
        pkg.name = 'vibestack-web-issue-${ISSUE_NUMBER}';
        fs.writeFileSync('apps/web/package.json', JSON.stringify(pkg, null, 2) + '\n');
    "
    echo "   ✅ Web package.json updated"
fi

# Update apps/server/package.json
if [ -f "apps/server/package.json" ]; then
    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('apps/server/package.json', 'utf8'));
        pkg.name = 'server-issue-${ISSUE_NUMBER}';
        fs.writeFileSync('apps/server/package.json', JSON.stringify(pkg, null, 2) + '\n');
    "
    echo "   ✅ Server package.json updated"
fi

echo ""
echo "3️⃣ Setting up PR environment..."
if [ -f "./scripts/setup-pr-env.sh" ]; then
    PR_NUMBER="$ISSUE_NUMBER" ./scripts/setup-pr-env.sh
else
    echo "   ❌ Setup script not found in worktree"
    echo "   This might be because the scripts weren't committed when the worktree was created."
    echo "   Please run the setup manually or merge the latest changes."
    exit 1
fi

echo ""
echo "✅ Issue #${ISSUE_NUMBER} environment ready!"
echo ""
echo "📍 Current location: $(pwd)"
echo ""
echo "4️⃣ Starting development servers..."
echo "   🚀 Running pnpm dev..."
echo ""
echo "📱 Your services will be available at:"
echo "   • Web: http://localhost:$((5173 + ISSUE_NUMBER))"
echo "   • API: http://localhost:$((8787 + ISSUE_NUMBER))"
echo ""

# Option to run setup tests
if [ "${RUN_SETUP_TESTS:-false}" = "true" ] || [ "$2" = "--test-setup" ]; then
    echo "🧪 Setup tests will run after servers start..."
    echo ""
fi

echo "📝 When ready for PR:"
echo "   📦 Package names are automatically managed - no manual cleanup needed!"
echo ""
echo "   Standard git workflow:"
echo "   git add . && git commit -m 'Your changes'"
echo "   git push -u origin $BRANCH_NAME"
echo ""
echo "   🛡️ Alternative (uses git-safe wrapper for extra protection):"
echo "   ./scripts/git-safe.sh add ."
echo "   ./scripts/git-safe.sh commit -m 'Your changes'"
echo "   ./scripts/git-safe.sh push -u origin $BRANCH_NAME"
echo ""
echo "   # Create PR with title: [#${ISSUE_NUMBER}] Your description"
echo "   # Include 'Fixes #${ISSUE_NUMBER}' in PR description"
echo ""
echo "🧹 When done:"
echo "   ./scripts/finish-issue.sh ${ISSUE_NUMBER}"
echo ""

# Start the development servers with timeout for automation testing
# In normal use, users would run 'pnpm dev' manually without timeout
if [ "${AUTOMATION_TEST:-false}" = "true" ]; then
    echo "🧪 Running in automation test mode - will timeout after 30 seconds"
    timeout 30s pnpm dev || true
elif [ "${RUN_SETUP_TESTS:-false}" = "true" ] || [ "$2" = "--test-setup" ]; then
    # Start servers in background and run tests
    echo "🚀 Starting servers in background for setup tests..."
    ./scripts/tmux-bg.sh "vibestack-dev-issue-${ISSUE_NUMBER}" "pnpm dev"
    
    # Wait for servers to be ready
    echo "⏳ Waiting for servers to start..."
    sleep 15
    
    # Run setup tests
    echo ""
    ./scripts/run-worktree-setup-tests.sh
    
    # Update CLAUDE.md with actual auth state after tests complete
    if [ -f "${MAIN_REPO_ROOT}/scripts/sync-claude-config.sh" ]; then
        echo "📝 Updating CLAUDE.md with auth state..."
        "${MAIN_REPO_ROOT}/scripts/sync-claude-config.sh" "$PWD" --update-auth-state "$ISSUE_NUMBER"
    fi
    
    echo ""
    echo "📝 Servers are running in background. To view logs:"
    echo "   ./scripts/bg-logs.sh vibestack-dev-issue-${ISSUE_NUMBER}"
    echo ""
    echo "To stop servers when done:"
    echo "   ./scripts/bg-stop.sh vibestack-dev-issue-${ISSUE_NUMBER}"
else
    # Start servers in background using tmux
    echo "🚀 Starting servers in background..."
    ./scripts/tmux-bg.sh "vibestack-dev-issue-${ISSUE_NUMBER}" "pnpm dev"
    
    echo ""
    echo "📝 Servers are starting in background. To view logs:"
    echo "   ./scripts/bg-logs.sh vibestack-dev-issue-${ISSUE_NUMBER}"
    echo ""
    echo "To stop servers when done:"
    echo "   ./scripts/bg-stop.sh vibestack-dev-issue-${ISSUE_NUMBER}"
fi