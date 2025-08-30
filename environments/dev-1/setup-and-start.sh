#!/bin/bash

# Complete Setup and Start Script for VibeStack Development Environment
# Checks everything needed and starts Claude Code ready to work

set -e

echo "🚀 VibeStack Development Environment Setup & Start"
echo "================================================="
echo ""

CONTAINER_NAME="vibestack-devenv1"
ENVIRONMENT_NAME="dev-1"

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "🐳 Starting container..."
    ./start.sh
    sleep 3
fi

echo "🔍 Checking and fixing setup issues..."

# Fix 1: Ensure proper git directory in container
echo "📂 Setting up git repository in container..."
docker exec "$CONTAINER_NAME" bash -c "
    cd /workspace
    if [ ! -d .git ]; then
        echo '🔧 Initializing git repository...'
        git init
        git remote add origin https://github.com/benfreed/vibestack.git || true
        
        # Create a minimal .gitignore
        cat > .gitignore << 'EOF'
node_modules/
.env
.env.local
*.log
dist/
build/
.next/
sessions/
.claude/autonomous.log
.claude/autonomous-output.log
EOF
    else
        echo '✅ Git repository already initialized'
    fi
"

# Fix 2: Ensure CLAUDE.md exists in workspace root
echo "📄 Setting up CLAUDE.md file..."
docker exec "$CONTAINER_NAME" bash -c "
    cd /workspace
    if [ ! -f CLAUDE.md ]; then
        echo '📝 Creating CLAUDE.md from main project...'
        # Copy from host if it exists
        if [ -f /home/benfreed/dev/vibestack/CLAUDE.md ]; then
            cat > CLAUDE.md << 'EOF'
# CLAUDE.md - VibeStack Development Environment

*This file provides guidance to Claude Code (claude.ai/code) when working with VibeStack in containerized development environments.*

## Environment Configuration

**Containerized Development Environment:**
- Container: $CONTAINER_NAME
- Web application: \`http://localhost:5175\` (→ \`http://localhost:5173\` in container)
- Server API: \`http://localhost:8789\` (→ \`http://localhost:8787\` in container)
- Database: PostgreSQL in container network

## Development Server Management

**Running Development Servers:**
\`\`\`bash
# Start main development servers (web + API)
pnpm dev

# Or start specific services
pnpm dev:web      # Web app only
pnpm dev:server   # API server only
\`\`\`

## Test User Credentials

**Wide Corp Solutions Test Users:**
- **Owner**: ceo@widecorp.com / WideCorp2024!CEO
- **Admin**: cto@widecorp.com / WideCorp2024!CTO  
- **Manager**: pm1@widecorp.com / WideCorp2024!PM1
- **Member**: dev1@widecorp.com / WideCorp2024!DEV1

## Project Stack

- **Frontend**: React + Vite + TypeScript
- **Backend**: Cloudflare Workers + Hono
- **Database**: PostgreSQL + Kysely ORM
- **Auth**: Better Auth
- **Package Manager**: pnpm
- **Type Checking**: \`pnpm type-check\`

## Container Development Notes

- This is an isolated development environment
- Code changes sync with host file system
- Database is containerized and isolated
- All standard VibeStack commands work normally
- Session planning system is active for project tracking

## Quick Commands

\`\`\`bash
pnpm dev          # Start both servers
pnpm type-check   # Check TypeScript
pnpm build        # Build for production
pnpm test         # Run tests (when available)
\`\`\`

---

*Container-specific CLAUDE.md for VibeStack development environment*
EOF
        else
            echo '⚠️  Main CLAUDE.md not found, creating basic version'
            cat > CLAUDE.md << 'EOF'
# CLAUDE.md - VibeStack Development

## Environment: Containerized Development

- Web: http://localhost:5175 → http://localhost:5173 (container)
- API: http://localhost:8789 → http://localhost:8787 (container)
- Stack: React + Cloudflare Workers + PostgreSQL
- Package Manager: pnpm

## Commands
\`\`\`bash
pnpm dev          # Start development servers
pnpm type-check   # TypeScript validation
\`\`\`

## Test User
- Email: ceo@widecorp.com
- Password: WideCorp2024!CEO
EOF
        fi
        echo '✅ CLAUDE.md created'
    else
        echo '✅ CLAUDE.md already exists'
    fi
"

# Fix 3: Ensure Claude Code is installed and session planning is set up
echo "🔧 Setting up enhanced Claude Code..."
if ! docker exec "$CONTAINER_NAME" test -f /home/developer/.local/bin/claude; then
    echo "🔽 Installing Claude Code..."
    docker exec "$CONTAINER_NAME" bash -c "
        curl -fsSL https://claude.ai/install.sh | bash
        echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> /home/developer/.bashrc
    "
fi

# Install session planning if not already done
if ! docker exec "$CONTAINER_NAME" test -f /workspace/.claude/settings.json; then
    echo "📋 Installing session planning system..."
    ../setup-claude-enhanced.sh "$ENVIRONMENT_NAME"
fi

echo ""
echo "✅ All setup complete! Starting Claude Code..."
echo ""
echo "🎯 Environment Ready:"
echo "   • Web: http://localhost:5175"
echo "   • API: http://localhost:8789"
echo "   • Git repository initialized"  
echo "   • CLAUDE.md configured"
echo "   • Session planning active"
echo ""

# Start Claude Code in the container
echo "🚀 Launching Claude Code with --dangerously-skip-permissions..."
docker exec -it "$CONTAINER_NAME" bash -c "
    export PATH=\"\$HOME/.local/bin:\$PATH\"
    cd /workspace
    echo \"🎉 VibeStack Development Environment Ready!\"
    echo \"===========================================\"
    echo \"\"
    echo \"📁 Working directory: /workspace\"
    echo \"🌐 Web: http://localhost:5175 → http://localhost:5173\"
    echo \"🔌 API: http://localhost:8789 → http://localhost:8787\" 
    echo \"📋 Session planning: Active\"
    echo \"📄 Project config: CLAUDE.md\"
    echo \"\"
    exec claude --dangerously-skip-permissions
"