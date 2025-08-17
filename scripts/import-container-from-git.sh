#!/bin/bash

# import-container-from-git.sh - Import git-tracked container image 
# This loads the complete development environment from git
# Usage: ./scripts/import-container-from-git.sh

set -euo pipefail

echo "📥 Importing container from git-tracked image..."

# Check if container tar exists
if [ ! -f "data/container-main.tar" ]; then
    echo "❌ No git-tracked container found at data/container-main.tar"
    echo "Run './scripts/export-container-to-git.sh' first to create one"
    exit 1
fi

# Get container tar info
CONTAINER_SIZE=$(du -sh data/container-main.tar | cut -f1)
echo "📊 Container size: $CONTAINER_SIZE"

echo "🏗️  Importing container as vibestack:git-main..."

# Import the container tar as a Docker image
docker import data/container-main.tar vibestack:git-main

echo "✅ Container imported successfully!"
echo ""
echo "🚀 Available commands:"
echo "  # Run complete environment (web + api + db):"
echo "  docker run -d --name vibestack-from-git \\"
echo "    -p 5173:5173 -p 8787:8787 -p 5432:5432 \\"
echo "    vibestack:git-main"
echo ""
echo "  # Run for worktree (with custom ports):"
echo "  ./scripts/worktree-start-from-git.sh <issue-number>"
echo ""
echo "🔍 Container details:"
docker images vibestack:git-main --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"