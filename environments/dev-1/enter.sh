#!/bin/bash
# Enter Development Environment 1 with Claude Code

set -e

if ! docker ps | grep -q vibestack-devenv1; then
    echo "❌ Container is not running. Start it first with:"
    echo "   ./start.sh"
    exit 1
fi

echo "🐳 Entering Development Environment 1 container..."
echo "💻 Claude Code will be available with 'claude' command"
echo ""

# Enter container as developer user with Claude Code ready
echo "💻 Entering container as 'developer' user..."
echo "🎯 Claude Code is ready to use with 'claude' command"
echo ""

docker exec -it vibestack-devenv1 bash -c "
    # Ensure PATH is set and sourced
    echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> /home/developer/.bashrc
    source /home/developer/.bashrc
    export PATH=\"\$HOME/.local/bin:\$PATH\"
    cd /workspace
    echo \"🎉 Welcome to VibeStack Development Environment 1\"
    echo \"===============================================\"
    echo \"\"
    echo \"📁 Working directory: /workspace\"
    echo \"👤 User: \$(whoami) (UID: \$(id -u))\"
    echo \"💻 Claude Code: claude (path: \$(which claude 2>/dev/null || echo 'not found'))\"
    echo \"🌐 Web: http://localhost:5175 (container: 5173)\"
    echo \"🔌 API: http://localhost:8789 (container: 8787)\"
    echo \"\"
    echo \"🚀 Starting Claude Code with enhanced session planning...\"
    echo \"💡 When you exit Claude Code, you'll drop to bash shell\"
    echo \"\"
    
    # Start Claude Code, and when it exits, drop to bash
    while true; do
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
    done
"