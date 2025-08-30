#!/bin/bash

# VibeStack Development Environment - Complete Setup and Start
# This script handles everything from scratch: container setup, git, CLAUDE.md, 
# Claude Code installation, session planning, and launches Claude Code

set -e

echo "🚀 VibeStack Development Environment - Complete Setup"
echo "===================================================="
echo ""

CONTAINER_NAME="vibestack-devenv1"
ENVIRONMENT_NAME="dev-1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "📍 Environment: $ENVIRONMENT_NAME"
echo "📁 Location: $SCRIPT_DIR" 
echo ""

# Step 1: Start container if not running
echo "🐳 Step 1: Container Setup"
echo "-------------------------"
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "🔄 Starting containerized environment..."
    "$SCRIPT_DIR/start.sh"
    echo "⏳ Waiting for container to be ready..."
    sleep 5
else
    echo "✅ Container already running"
fi

# Verify container is ready
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "❌ Failed to start container"
    exit 1
fi

echo ""

# Step 2: Fix git repository 
echo "📂 Step 2: Git Repository Setup"
echo "-------------------------------"
docker exec "$CONTAINER_NAME" bash -c "
    cd /workspace
    
    # Remove any broken symlinks
    if [ -L .git ] && [ ! -e .git ]; then
        echo '🔧 Removing broken git symlink...'
        rm .git
    fi
    
    # Initialize git if needed
    if [ ! -d .git ]; then
        echo '🔧 Initializing git repository...'
        git init
        git branch -M main
        git remote add origin https://github.com/benfreed/vibestack.git 2>/dev/null || true
        
        # Create comprehensive .gitignore
        cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnpm-store/

# Environment files  
.env
.env.local
.env.production
.env.staging

# Build outputs
dist/
build/
.next/
.turbo/
.eslintcache

# Logs
*.log
npm-debug.log*

# Testing
test-results/
playwright-report/
.playwright/

# Claude Code sessions (container-specific)
sessions/
.claude/autonomous.log
.claude/autonomous-output.log

# OS generated files
.DS_Store
Thumbs.db
EOF
        echo '✅ Git repository initialized'
    else
        echo '✅ Git repository already exists'
    fi
"

echo ""

# Step 3: Create/verify CLAUDE.md
echo "📄 Step 3: CLAUDE.md Configuration"
echo "----------------------------------"
docker exec "$CONTAINER_NAME" bash -c "
    cd /workspace
    if [ ! -f CLAUDE.md ]; then
        echo '📝 Creating CLAUDE.md with VibeStack configuration...'
        cat > CLAUDE.md << 'EOF'
# CLAUDE.md - VibeStack Development Environment

*This file provides guidance to Claude Code when working with VibeStack in containerized development.*

## Current Configuration

**Containerized Development Environment:**
- **Container**: $CONTAINER_NAME  
- **Web**: http://localhost:5175 → http://localhost:5173 (container)
- **API**: http://localhost:8789 → http://localhost:8787 (container)
- **Database**: PostgreSQL in container network

## Development Commands

\`\`\`bash
# Start development servers
pnpm dev              # Both web and API
pnpm dev:web          # Web app only  
pnpm dev:server       # API server only

# Type checking and building
pnpm type-check       # TypeScript validation
pnpm build            # Production build
\`\`\`

## Test User Credentials

**Wide Corp Solutions (Primary Test Org):**
- **Owner**: ceo@widecorp.com / WideCorp2024!CEO
- **Admin**: cto@widecorp.com / WideCorp2024!CTO
- **Manager**: pm1@widecorp.com / WideCorp2024!PM1
- **Member**: dev1@widecorp.com / WideCorp2024!DEV1

## Project Stack

- **Frontend**: React + Vite + TypeScript + Legend State
- **Backend**: Cloudflare Workers + Hono + Better Auth
- **Database**: PostgreSQL + Kysely ORM + Hyperdrive
- **Package Manager**: pnpm (monorepo with workspaces)
- **Testing**: Playwright MCP for browser automation

## Container Development Notes

- **Isolation**: Complete development environment isolation
- **File Sync**: Code changes sync with host filesystem  
- **Database**: PostgreSQL container with test data
- **Ports**: Standard internal ports (5173, 8787) mapped to host
- **Sessions**: Claude Code session planning active

## Development Workflow

1. Use \`pnpm dev\` to start both web and API servers
2. Access web app at http://localhost:5175
3. API available at http://localhost:8789
4. Login with Wide Corp test credentials
5. Session planning tracks progress automatically

---

*Container-specific CLAUDE.md for VibeStack isolated development*
EOF
        echo '✅ CLAUDE.md created'
    else
        echo '✅ CLAUDE.md already exists'
    fi
"

echo ""

# Step 4: Install Claude Code if needed
echo "🔧 Step 4: Claude Code Installation"  
echo "-----------------------------------"
docker exec "$CONTAINER_NAME" bash -c "
    if [ ! -f /home/developer/.local/bin/claude ]; then
        echo '🔽 Installing Claude Code...'
        curl -fsSL https://claude.ai/install.sh | bash
        
        # Ensure PATH is configured
        if ! grep -q '.local/bin' /home/developer/.bashrc; then
            echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> /home/developer/.bashrc
        fi
        echo '✅ Claude Code installed'
    else
        echo '✅ Claude Code already installed'
    fi
    
    # Verify installation
    export PATH=\"\$HOME/.local/bin:\$PATH\"
    if which claude >/dev/null 2>&1; then
        echo \"📍 Claude Code version: \$(claude --version)\"
    else
        echo '❌ Claude Code installation verification failed'
        exit 1
    fi
"

echo ""

# Step 5: Setup MCP Playwright  
echo "🎭 Step 5: MCP Playwright Setup"
echo "-------------------------------"
docker exec "$CONTAINER_NAME" bash -c "
    cd /workspace
    
    # Check if Claude CLI is available
    export PATH=\"\$HOME/.local/bin:\$PATH\"
    if ! which claude >/dev/null 2>&1; then
        echo '⚠️  Claude CLI not found yet, will be installed in next step'
    else
        echo '🔧 Installing Playwright MCP...'
        # Install playwright MCP (project-local scope)
        claude mcp add --scope project playwright npx @playwright/mcp@latest 2>&1 || echo '⚠️  MCP installation will complete after Claude Code is fully set up'
        echo '✅ Playwright MCP configuration added'
    fi
"

echo ""

# Step 6: Setup session planning system
echo "📋 Step 6: Session Planning System"
echo "----------------------------------"
docker exec "$CONTAINER_NAME" bash -c "
    cd /workspace
    
    # Create .claude directory
    mkdir -p .claude
    
    # Create session-start.sh
    cat > .claude/session-start.sh << 'SCRIPT_EOF'
#!/bin/bash

# Get today's date
DATE=\$(date '+%Y-%m-%d')
DATE_DIR=\"/workspace/sessions/\${DATE}\"

# Create date directory
mkdir -p \"\$DATE_DIR\"

# Session reuse logic (2 hour window)
REUSE_WINDOW=7200
CURRENT_TIME=\$(date +%s)
LAST_SESSION=\$(ls -d \${DATE_DIR}/session-* 2>/dev/null | sort -V | tail -1)

if [ -n \"\$LAST_SESSION\" ]; then
    SESSION_TIME=\$(stat -c %Y \"\$LAST_SESSION\" 2>/dev/null || echo 0)
    if [ \"\$SESSION_TIME\" -gt 0 ]; then
        TIME_DIFF=\$((CURRENT_TIME - SESSION_TIME))
        if [ \$TIME_DIFF -lt \$REUSE_WINDOW ]; then
            echo \"🔄 Reusing session: \$LAST_SESSION\"
            echo \"\$LAST_SESSION\" > \"/workspace/.claude/current-session\"
            exit 0
        fi
    fi
fi

# Create new session
SESSION_NUM=1
if [ -n \"\$LAST_SESSION\" ]; then
    LAST_NUM=\$(basename \"\$LAST_SESSION\" | sed 's/session-//')
    SESSION_NUM=\$((LAST_NUM + 1))
fi

NEW_SESSION_DIR=\"\${DATE_DIR}/session-\${SESSION_NUM}\"
mkdir -p \"\$NEW_SESSION_DIR\"

# Create plan.md with VibeStack template
cat > \"\$NEW_SESSION_DIR/plan.md\" << 'PLAN_EOF'
# Session \${SESSION_NUM} Plan - VibeStack Development

## Environment Info
- **Container**: $CONTAINER_NAME
- **Web**: http://localhost:5175 → http://localhost:5173 
- **API**: http://localhost:8789 → http://localhost:8787
- **Database**: PostgreSQL (containerized)

## Session Goals
- [ ] Define main objective for this session
- [ ] Review current codebase state
- [ ] Plan implementation approach  
- [ ] Execute development tasks

## VibeStack Context
- **Stack**: React + Cloudflare Workers + PostgreSQL
- **Test User**: ceo@widecorp.com / WideCorp2024!CEO
- **Key Commands**: \`pnpm dev\`, \`pnpm type-check\`

## Notes
Update goals as you work. Mark completed items with ✅.

Created: \$(date '+%Y-%m-%d %H:%M')
PLAN_EOF

echo \"📋 Created new session: \$NEW_SESSION_DIR\"
echo \"\$NEW_SESSION_DIR\" > \"/workspace/.claude/current-session\"
SCRIPT_EOF

    # Create planning-context.sh
    cat > .claude/planning-context.sh << 'SCRIPT_EOF'
#!/bin/bash

SESSION_DIR=\"/workspace/sessions/\$(date +%Y-%m-%d)\"
LATEST_SESSION=\$(ls -d \$SESSION_DIR/session-* 2>/dev/null | sort -V | tail -1)

if [ -z \"\$LATEST_SESSION\" ]; then
    echo '{\"shouldBlock\": false}'
    exit 0
fi

PLAN_FILE=\"\$LATEST_SESSION/plan.md\"
SESSION_NAME=\$(basename \"\$LATEST_SESSION\")

# Extract goals
CURRENT_GOALS=\"\"
if [ -f \"\$PLAN_FILE\" ]; then
    CURRENT_GOALS=\$(grep -E \"^- \\[.\\]\" \"\$PLAN_FILE\" 2>/dev/null | head -5)
    COMPLETED_COUNT=\$(grep -c \"✅\\|\\[x\\]\" \"\$PLAN_FILE\" 2>/dev/null || echo 0)
    TOTAL_COUNT=\$(grep -c \"- \\[\" \"\$PLAN_FILE\" 2>/dev/null || echo 0)
else
    CURRENT_GOALS=\"No plan file exists yet\"
    COMPLETED_COUNT=0
    TOTAL_COUNT=0
fi

# Create VibeStack-specific context
CONTEXT=\"📦 **VibeStack Development Context**

**Container**: $CONTAINER_NAME (\$SESSION_NAME - \$COMPLETED_COUNT/\$TOTAL_COUNT goals)
**Environment**: Web(5175→5173), API(8789→8787), PostgreSQL
**Test User**: ceo@widecorp.com / WideCorp2024!CEO

**Current Goals:**
\$CURRENT_GOALS

**VibeStack Commands:**
- \`pnpm dev\` - Start development servers
- \`pnpm type-check\` - TypeScript validation
- Session plan: \$PLAN_FILE

**Planning Notes:**
- Update session goals as you work
- Mark completed goals with ✅  
- Add new goals for discovered tasks\"

cat <<EOF
{
    \"shouldBlock\": false,
    \"additionalContext\": \"\$CONTEXT\"
}
EOF
SCRIPT_EOF

    # Create simple session-summary.sh
    cat > .claude/session-summary.sh << 'SCRIPT_EOF'
#!/bin/bash

SESSION_DIR=\"/workspace/sessions/\$(date +%Y-%m-%d)\"
LATEST_SESSION=\$(ls -d \$SESSION_DIR/session-* 2>/dev/null | sort -V | tail -1)

if [ -n \"\$LATEST_SESSION\" ]; then
    SUMMARY_FILE=\"\$LATEST_SESSION/session-summary.md\"
    SESSION_NAME=\$(basename \"\$LATEST_SESSION\")
    
    cat > \"\$SUMMARY_FILE\" << 'SUMMARY_EOF'
# \$SESSION_NAME Summary - VibeStack Development

**Environment**: $CONTAINER_NAME
**Completed**: \$(date '+%Y-%m-%d %H:%M')

## Session Context
- Container development environment  
- Web: http://localhost:5175, API: http://localhost:8789
- PostgreSQL database with test data

## Notes
Session completed in VibeStack containerized environment.
Review plan.md for detailed goals and progress.

Generated: \$(date '+%Y-%m-%d %H:%M:%S')
SUMMARY_EOF
    
    echo \"📄 Session summary created: \$SUMMARY_FILE\"
fi
SCRIPT_EOF

    # Make scripts executable
    chmod +x .claude/*.sh
    
    # Create settings.json
    cat > .claude/settings.json << 'SETTINGS_EOF'
{
  \"hooks\": {
    \"SessionStart\": [
      {
        \"hooks\": [
          {
            \"type\": \"command\",
            \"command\": \"/workspace/.claude/session-start.sh\"
          }
        ]
      }
    ],
    \"UserPromptSubmit\": [
      {
        \"hooks\": [
          {
            \"type\": \"command\",
            \"command\": \"/workspace/.claude/planning-context.sh\"
          }
        ]
      }
    ],
    \"Stop\": [
      {
        \"hooks\": [
          {
            \"type\": \"command\",
            \"command\": \"/workspace/.claude/session-summary.sh\",
            \"timeout\": 10
          }
        ]
      }
    ]
  }
}
SETTINGS_EOF

    # Initialize sessions directory
    mkdir -p sessions/\$(date '+%Y-%m-%d')
    
    echo '📋 Session planning system installed'
"

echo ""

# Step 7: Final MCP Setup (after Claude Code is installed)
echo "🎭 Step 7: Final MCP Playwright Setup"
echo "-------------------------------------"
docker exec "$CONTAINER_NAME" bash -c "
    cd /workspace
    export PATH=\"\$HOME/.local/bin:\$PATH\"
    
    if which claude >/dev/null 2>&1; then
        echo '🔧 Completing Playwright MCP installation...'
        claude mcp add --scope project playwright npx @playwright/mcp@latest 2>&1 | tee /tmp/mcp_install.log || true
        
        # Check result
        if grep -q 'Added stdio MCP server' /tmp/mcp_install.log 2>/dev/null; then
            echo '✅ Playwright MCP successfully installed'
        elif grep -q 'already exists' /tmp/mcp_install.log 2>/dev/null; then
            echo '✅ Playwright MCP already configured'
        else
            echo '⚠️  MCP installation completed with warnings (normal for first run)'
        fi
        rm -f /tmp/mcp_install.log
    else
        echo '❌ Claude CLI still not available for MCP setup'
    fi
"

echo ""

# Final step: Launch Claude Code
echo "🎯 Step 8: Launch Options"
echo "-------------------------"
echo "✅ All setup completed successfully!"
echo ""
echo "🎯 Choose your launch option:"
echo ""
echo "1. Start Claude Code (auto-start, drop to bash on exit)"
echo "2. Enter interactive bash directly"
echo ""
read -p "Enter choice (1 or 2, default 1): " choice
choice=${choice:-1}

case $choice in
    1)
        echo ""
        echo "🚀 Starting Claude Code with enhanced session planning..."
        echo "💡 When you exit Claude Code, you'll drop to bash shell"
        # Launch Claude Code with fallback to bash
        docker exec -it "$CONTAINER_NAME" bash -c "
            export PATH=\"\$HOME/.local/bin:\$PATH\"
            cd /workspace
            echo \"🎉 VibeStack Development Environment Ready!\"
            echo \"===========================================\"
            echo \"\"
            echo \"📁 Working: /workspace\"
            echo \"🌐 Web: http://localhost:5175 → container:5173\"
            echo \"🔌 API: http://localhost:8789 → container:8787\"
            echo \"📋 Session planning: Active\"
            echo \"📄 Project config: CLAUDE.md\"
            echo \"🎭 Playwright MCP: Configured\"
            echo \"\"
            echo \"🚀 Starting Claude Code...\"
            echo \"\"
            
            # Start Claude Code, and when it exits, drop to bash
            claude --dangerously-skip-permissions
            echo \"\"
            echo \"📋 Claude Code session ended. You're now in bash.\"
            echo \"\"
            echo \"Available commands:\"
            echo \"   claude     - Restart Claude Code\"  
            echo \"   pnpm dev   - Start development servers\"
            echo \"   exit       - Exit container\"
            echo \"\"
            exec bash -l
        "
        ;;
    *)
        echo ""
        echo "🐳 Entering interactive development environment..."
        # Launch interactive bash (default)
        docker exec -it "$CONTAINER_NAME" bash -c "
            export PATH=\"\$HOME/.local/bin:\$PATH\"
            cd /workspace
            echo \"🎉 VibeStack Development Environment Ready!\"
            echo \"===========================================\"
            echo \"\"
            echo \"📁 Working: /workspace\"
            echo \"🌐 Web: http://localhost:5175 → container:5173\"
            echo \"🔌 API: http://localhost:8789 → container:8787\"
            echo \"📋 Session planning: Active when using 'claude'\"
            echo \"📄 Project config: CLAUDE.md\"
            echo \"🎭 Playwright MCP: Configured\"
            echo \"\"
            echo \"💡 Commands:\"
            echo \"   claude      - Start Claude Code\"
            echo \"   pnpm dev    - Start development servers\"
            echo \"   exit        - Exit container\"
            echo \"\"
            exec bash -l
        "
        ;;
esac