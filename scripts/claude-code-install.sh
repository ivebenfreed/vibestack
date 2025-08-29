#!/bin/bash
# Claude Code Installation for Alpine Linux VM

set -e

echo "🤖 Installing Claude Code..."

# Download and install Claude Code
cd /tmp
curl -fsSL https://claude.ai/install.sh | sh

# Verify installation
if command -v claude-code &> /dev/null; then
    echo "✅ Claude Code installed successfully!"
    claude-code --version
else
    echo "❌ Claude Code installation failed"
    exit 1
fi

# Create Claude Code directory structure
mkdir -p ~/.claude
mkdir -p ~/.config/claude-code

# Basic Claude Code configuration
cat > ~/.config/claude-code/config.json << 'EOF'
{
  "editor": "nano",
  "terminal": "tmux",
  "workspace": "/home/developer/workspace"
}
EOF

echo "🎯 Claude Code setup complete!"
echo "Run 'claude-code' to start coding"