#!/bin/bash

# Setup Enhanced Claude Code for All VibeStack Development Environments

set -e

echo "🚀 Setting up Enhanced Claude Code for All VibeStack Environments"
echo "=================================================================="
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Find all dev environments
ENVIRONMENTS=$(find "$SCRIPT_DIR" -maxdepth 1 -name "dev-*" -type d | sort)

if [ -z "$ENVIRONMENTS" ]; then
    echo "❌ No development environments found in $SCRIPT_DIR"
    echo "Expected directories like dev-1, dev-2, etc."
    exit 1
fi

echo "📂 Found environments:"
for env_dir in $ENVIRONMENTS; do
    env_name=$(basename "$env_dir")
    echo "   • $env_name"
done
echo ""

# Check which containers are running
echo "🔍 Checking container status..."
running_containers=""
for env_dir in $ENVIRONMENTS; do
    env_name=$(basename "$env_dir")
    container_name="vibestack-devenv$(echo $env_name | grep -o '[0-9]*')"
    
    if docker ps | grep -q "$container_name"; then
        echo "   ✅ $env_name ($container_name) - Running"
        running_containers="$running_containers $env_name"
    else
        echo "   ⏸️  $env_name ($container_name) - Stopped"
    fi
done
echo ""

if [ -z "$running_containers" ]; then
    echo "❌ No containers are running. Start them first with:"
    for env_dir in $ENVIRONMENTS; do
        env_name=$(basename "$env_dir")
        echo "   cd $(basename "$SCRIPT_DIR")/environments/$env_name && ./start.sh"
    done
    echo ""
    echo "Then run this script again."
    exit 1
fi

# Setup enhanced Claude Code for running containers
echo "🛠️ Installing enhanced Claude Code setup..."
setup_count=0
success_count=0

for env_name in $running_containers; do
    echo ""
    echo "📋 Setting up $env_name..."
    
    if "$SCRIPT_DIR/setup-claude-enhanced.sh" "$env_name"; then
        success_count=$((success_count + 1))
        echo "   ✅ $env_name setup completed"
    else
        echo "   ❌ $env_name setup failed"
    fi
    
    setup_count=$((setup_count + 1))
done

echo ""
echo "🎉 Enhanced Claude Code Setup Complete!"
echo "======================================="
echo ""
echo "📊 Results:"
echo "   • Total environments processed: $setup_count"  
echo "   • Successful setups: $success_count"
echo "   • Failed setups: $((setup_count - success_count))"
echo ""

if [ "$success_count" -gt 0 ]; then
    echo "🎯 Usage Instructions:"
    echo ""
    echo "To use any enhanced environment:"
    echo "   1. cd environments/[env-name] && ./enter.sh"
    echo "   2. claude"
    echo ""
    echo "📋 Enhanced Features Available:"
    echo "   • Automatic session planning and tracking"
    echo "   • VibeStack-specific development context"
    echo "   • Container-aware port mappings and configuration"
    echo "   • Session summaries and work logging"
    echo ""
    echo "🔗 Session files will be saved to: /workspace/sessions/"
    echo "⚙️  Settings configured at: /workspace/.claude/settings.json"
fi