#!/bin/bash
# Open Terminal in Development Environment 1 Container

set -e

# Check if container is running
if ! docker ps | grep -q vibestack-devenv1; then
    echo "❌ Container 'vibestack-devenv1' is not running"
    echo ""
    echo "Start it first with:"
    echo "   ./start.sh"
    exit 1
fi

echo "🐳 Opening new terminal in container..."

# Detect terminal emulator and open accordingly
if command -v gnome-terminal >/dev/null 2>&1; then
    # GNOME Terminal
    gnome-terminal --title="VibeStack Dev-1 Container" -- bash -c "
        docker exec -it vibestack-devenv1 bash -c '
            export PATH=\"\$HOME/.local/bin:\$PATH\"
            cd /workspace
            echo \"\"
            echo \"🎉 Welcome to VibeStack Development Environment 1\"
            echo \"=================================================\"
            echo \"\"
            echo \"📁 Working directory: /workspace\"
            echo \"💻 Claude Code: claude\"
            echo \"🚀 Development servers: ./start.sh (if not running)\"
            echo \"🌐 Web: http://localhost:5175 (container: 5173)\"
            echo \"🔌 API: http://localhost:8789 (container: 8787)\"
            echo \"\"
            echo \"Available commands:\"
            echo \"  claude          - Start Claude Code\"
            echo \"  pnpm dev:web    - Start web development server\"
            echo \"  pnpm dev:server - Start API server\"
            echo \"  pnpm dev        - Start both servers\"
            echo \"  exit            - Exit container\"
            echo \"\"
            exec bash
        '
    "
elif command -v konsole >/dev/null 2>&1; then
    # KDE Konsole
    konsole --new-tab --title "VibeStack Dev-1" -e bash -c "
        docker exec -it vibestack-devenv1 bash -c '
            export PATH=\"\$HOME/.local/bin:\$PATH\"
            cd /workspace
            echo \"\"
            echo \"🎉 Welcome to VibeStack Development Environment 1\"
            echo \"=================================================\"
            echo \"\"
            echo \"📁 Working directory: /workspace\"
            echo \"💻 Claude Code: claude\"
            echo \"🚀 Development servers: ./start.sh (if not running)\"
            echo \"🌐 Web: http://localhost:5175 (container: 5173)\"
            echo \"🔌 API: http://localhost:8789 (container: 8787)\"
            echo \"\"
            echo \"Available commands:\"
            echo \"  claude          - Start Claude Code\"
            echo \"  pnpm dev:web    - Start web development server\"
            echo \"  pnpm dev:server - Start API server\"
            echo \"  pnpm dev        - Start both servers\"
            echo \"  exit            - Exit container\"
            echo \"\"
            exec bash
        '
    "
elif command -v xterm >/dev/null 2>&1; then
    # XTerm
    xterm -title "VibeStack Dev-1" -e bash -c "
        docker exec -it vibestack-devenv1 bash -c '
            export PATH=\"\$HOME/.local/bin:\$PATH\"
            cd /workspace
            echo \"\"
            echo \"🎉 Welcome to VibeStack Development Environment 1\"
            echo \"=================================================\"
            echo \"\"
            echo \"📁 Working directory: /workspace\"
            echo \"💻 Claude Code: claude\"
            echo \"🚀 Development servers: ./start.sh (if not running)\"
            echo \"🌐 Web: http://localhost:5175 (container: 5173)\"
            echo \"🔌 API: http://localhost:8789 (container: 8787)\"
            echo \"\"
            echo \"Available commands:\"
            echo \"  claude          - Start Claude Code\"
            echo \"  pnpm dev:web    - Start web development server\"
            echo \"  pnpm dev:server - Start API server\"
            echo \"  pnpm dev        - Start both servers\"
            echo \"  exit            - Exit container\"
            echo \"\"
            exec bash
        '
    " &
else
    echo "⚠️  No supported terminal emulator found"
    echo "Supported terminals: gnome-terminal, konsole, xterm"
    echo ""
    echo "Falling back to current terminal (you can manually run):"
    echo "   docker exec -it vibestack-devenv1 bash -c \"export PATH='\$HOME/.local/bin:\$PATH' && cd /workspace && exec bash\""
    
    # Fallback - just exec in current terminal
    docker exec -it vibestack-devenv1 bash -c '
        export PATH="$HOME/.local/bin:$PATH"
        cd /workspace
        echo ""
        echo "🎉 Welcome to VibeStack Development Environment 1"
        echo "================================================="
        echo ""
        echo "📁 Working directory: /workspace"
        echo "💻 Claude Code: claude"
        echo "🚀 Development servers: available via start.sh"
        echo "🌐 Web: http://localhost:5175 (container: 5173)"
        echo "🔌 API: http://localhost:8789 (container: 8787)"
        echo ""
        exec bash
    '
fi