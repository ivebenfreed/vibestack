#!/bin/bash
# Setup Claude Code in container environment

echo "🔧 Setting up Claude Code in container..."

if ! docker ps | grep -q vibestack-devenv1; then
    echo "❌ Container 'vibestack-devenv1' is not running"
    echo "Start it first with: ./start.sh"
    exit 1
fi

# Ensure Claude Code is properly set up in the container
docker exec vibestack-devenv1 bash -c "
    # Add PATH to bashrc if not already there
    if ! grep -q '/.local/bin' /home/developer/.bashrc; then
        echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> /home/developer/.bashrc
    fi
    
    # Install Claude Code if not present
    if [ ! -f /home/developer/.local/bin/claude ]; then
        echo '🔽 Installing Claude Code...'
        curl -fsSL https://claude.ai/install.sh | bash
    fi
    
    # Test Claude Code
    export PATH=\"\$HOME/.local/bin:\$PATH\"
    if which claude >/dev/null 2>&1; then
        echo '✅ Claude Code is ready!'
        echo '   Version: '\$(claude --version)
        echo '   Location: '\$(which claude)
    else
        echo '❌ Claude Code setup failed'
    fi
"

echo ""
echo "Now you can enter the container with:"
echo "   ./enter.sh"
echo ""
echo "Inside the container, Claude Code will be available with:"
echo "   claude"