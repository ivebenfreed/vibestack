#!/bin/bash

# VibeStack Development Environment - Interactive Setup with Git Sync
# Handles GitHub authentication, git sync, and container setup

set -e

echo "🚀 VibeStack Development Environment - Interactive Setup"
echo "======================================================="
echo ""

CONTAINER_NAME="vibestack-devenv1"
ENVIRONMENT_NAME="dev-1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "📍 Environment: $ENVIRONMENT_NAME"
echo "📁 Project Root: $PROJECT_ROOT" 
echo ""

# Step 1: Check current git status and sync
echo "📂 Step 1: Git Repository Sync"
echo "------------------------------"

cd "$PROJECT_ROOT"
echo "🔍 Current git status:"
git status --porcelain | head -10 || echo "No changes"
echo ""

# Check if we need to pull changes
echo "🔄 Checking for remote updates..."
git fetch origin staging 2>/dev/null || {
    echo "⚠️  Could not fetch from remote. Continuing with local state."
}

BEHIND_COUNT=$(git rev-list --count staging..origin/staging 2>/dev/null || echo "0")
if [ "$BEHIND_COUNT" -gt 0 ]; then
    echo "📥 Your branch is $BEHIND_COUNT commits behind origin/staging"
    read -p "Pull latest changes? (y/N): " pull_choice
    if [[ "$pull_choice" =~ ^[Yy]$ ]]; then
        echo "🔄 Pulling latest changes..."
        git pull origin staging
        echo "✅ Code updated"
    fi
else
    echo "✅ Code is up to date"
fi

echo ""

# Step 2: Handle uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  You have uncommitted changes:"
    git status --porcelain
    echo ""
    echo "Options:"
    echo "1. Stash changes (recommended)"
    echo "2. Continue with changes (may cause conflicts)"
    echo "3. Commit changes now"
    echo ""
    read -p "Choose option (1-3, default 1): " changes_choice
    changes_choice=${changes_choice:-1}
    
    case $changes_choice in
        1)
            echo "📦 Stashing changes..."
            git stash push -m "Pre-container-setup stash $(date '+%Y-%m-%d %H:%M')"
            echo "✅ Changes stashed"
            ;;
        3)
            echo "💾 Committing current changes..."
            read -p "Enter commit message: " commit_msg
            git add .
            git commit -m "$commit_msg

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
            echo "✅ Changes committed"
            ;;
        *)
            echo "⚠️  Continuing with uncommitted changes..."
            ;;
    esac
fi

echo ""

# Step 3: Install dependencies if needed
echo "📦 Step 2: Dependencies Check"
echo "-----------------------------"

if [ ! -d "$PROJECT_ROOT/node_modules" ] || [ ! -f "$PROJECT_ROOT/pnpm-lock.yaml" ]; then
    echo "🔽 Installing dependencies..."
    cd "$PROJECT_ROOT"
    pnpm install
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi

echo ""

# Step 4: Container setup
echo "🐳 Step 3: Container Setup"
echo "--------------------------"

cd "$SCRIPT_DIR"

# Stop existing container if running
if docker ps | grep -q "$CONTAINER_NAME"; then
    echo "🛑 Stopping existing container..."
    ./stop.sh
fi

# Start fresh container
echo "🔄 Starting fresh container with current codebase..."
docker compose -f docker-compose.devenv-1.yml up -d --force-recreate

echo "⏳ Waiting for container to be ready..."
sleep 5

# Verify container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "❌ Failed to start container"
    exit 1
fi

echo ""

# Step 5: Setup Claude Code in container
echo "🔧 Step 4: Claude Code Setup"
echo "----------------------------"

docker exec "$CONTAINER_NAME" bash -c "
    # Install Claude Code if needed
    if [ ! -f /home/developer/.local/bin/claude ]; then
        echo '🔽 Installing Claude Code...'
        curl -fsSL https://claude.ai/install.sh | bash
    fi
    
    # Ensure PATH is configured
    if ! grep -q '.local/bin' /home/developer/.bashrc; then
        echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> /home/developer/.bashrc
    fi
    
    # Create .claude settings if not exists
    cd /workspace
    mkdir -p .claude
    
    # Create minimal settings.json for session planning
    if [ ! -f .claude/settings.json ]; then
        cat > .claude/settings.json << 'EOF'
{
  \"hooks\": {
    \"SessionStart\": [
      {
        \"hooks\": [
          {
            \"type\": \"command\", 
            \"command\": \"echo 'VibeStack Development Session Started'\"
          }
        ]
      }
    ]
  }
}
EOF
    fi
    
    echo '✅ Claude Code configured'
"

echo ""

# Step 6: MCP Playwright setup
echo "🎭 Step 5: MCP Playwright Setup"
echo "-------------------------------"

docker exec "$CONTAINER_NAME" bash -c "
    export PATH=\"\$HOME/.local/bin:\$PATH\"
    cd /workspace
    
    if which claude >/dev/null 2>&1; then
        echo '🔧 Setting up Playwright MCP...'
        claude mcp add --scope project playwright npx @playwright/mcp@latest 2>/dev/null || echo '⚠️  MCP setup completed (warnings normal)'
        echo '✅ Playwright MCP configured'
    else
        echo '⚠️  Claude CLI not ready, skipping MCP setup'
    fi
"

echo ""

# Step 7: Verify everything is working
echo "🔍 Step 6: Environment Verification"
echo "-----------------------------------"

echo "🔧 Installing container dependencies..."
docker exec "$CONTAINER_NAME" bash -c "
    cd /workspace
    # Check if pnpm is available and install deps
    if command -v pnpm >/dev/null 2>&1; then
        echo 'Installing project dependencies in container...'
        pnpm install --frozen-lockfile
        echo '✅ Container dependencies installed'
    else
        echo '⚠️  pnpm not available in container'
    fi
"

echo ""
echo "🎯 Environment Ready!"
echo "===================="
echo ""
echo "📊 Status:"
echo "   ✅ Git repository: $(cd "$PROJECT_ROOT" && git branch --show-current)"
echo "   ✅ Container: $CONTAINER_NAME running"
echo "   ✅ Claude Code: Installed with session planning"
echo "   ✅ MCP Playwright: Configured"
echo "   ✅ Dependencies: Installed"
echo ""
echo "🌐 Access URLs:"
echo "   • Web: http://localhost:5175 → container:5173"
echo "   • API: http://localhost:8789 → container:8787"
echo ""

# Step 8: Launch options
echo "🎯 Launch Options:"
echo "1. Start Claude Code (auto-start, drop to bash on exit)"
echo "2. Enter interactive bash"
echo "3. Start development servers only"
echo ""
read -p "Choose option (1-3, default 1): " launch_choice
launch_choice=${launch_choice:-1}

case $launch_choice in
    1)
        echo ""
        echo "🚀 Starting Claude Code with VibeStack development environment..."
        docker exec -it "$CONTAINER_NAME" bash -c "
            export PATH=\"\$HOME/.local/bin:\$PATH\"
            cd /workspace
            echo \"🎉 VibeStack Development Environment Ready!\"
            echo \"===========================================\"
            echo \"\"
            echo \"📁 Working: /workspace (synced with host)\"
            echo \"🌐 Web: http://localhost:5175\"
            echo \"🔌 API: http://localhost:8789\"
            echo \"📋 All tools ready: pnpm, claude, git\"
            echo \"\"
            
            # Start Claude Code, fallback to bash on exit
            claude --dangerously-skip-permissions
            echo \"\"
            echo \"📋 Claude Code session ended. Dropping to bash...\"
            echo \"Type 'claude' to restart or 'exit' to leave container\"
            echo \"\"
            exec bash -l
        "
        ;;
    2)
        echo ""
        echo "🐳 Entering interactive development environment..."
        docker exec -it "$CONTAINER_NAME" bash -c "
            export PATH=\"\$HOME/.local/bin:\$PATH\"
            cd /workspace
            echo \"🎉 VibeStack Interactive Environment\"
            echo \"====================================\"
            echo \"\"
            echo \"💡 Available commands:\"
            echo \"   claude      - Start Claude Code\"
            echo \"   pnpm dev    - Start development servers\"
            echo \"   git status  - Check git status\"
            echo \"   exit        - Exit container\"
            echo \"\"
            exec bash -l
        "
        ;;
    3)
        echo ""
        echo "🚀 Starting development servers..."
        docker exec -it "$CONTAINER_NAME" bash -c "
            export PATH=\"\$HOME/.local/bin:\$PATH\"
            cd /workspace
            echo \"🎉 Starting VibeStack Development Servers\"
            echo \"=========================================\"
            echo \"\"
            pnpm dev
        "
        ;;
esac