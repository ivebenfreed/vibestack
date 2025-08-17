#!/bin/bash

# export-container-to-git.sh - Export current container state to git-tracked image
# This captures the complete development environment including code, deps, and data
# Usage: ./scripts/export-container-to-git.sh

set -euo pipefail

echo "📦 Exporting complete container state to git..."

# Create data directory if it doesn't exist
mkdir -p data

# Check if postgres container is running
if ! docker ps | grep -q vibestack-postgres; then
    echo "❌ PostgreSQL container (vibestack-postgres) is not running"
    echo "Please start your development environment first:"
    echo "  docker-compose up -d"
    exit 1
fi

echo "🔄 Syncing live PostgreSQL data..."
# First sync the PostgreSQL data to git-tracked location
./scripts/sync-postgres-to-git.sh

echo "📸 Creating complete container snapshot..."

# Export the postgres container filesystem to tar
docker export vibestack-postgres > data/container-main.tar.tmp

# Check if export was successful
if [ ! -f "data/container-main.tar.tmp" ] || [ ! -s "data/container-main.tar.tmp" ]; then
    echo "❌ Container export failed"
    rm -f data/container-main.tar.tmp
    exit 1
fi

# Replace the tracked container atomically
mv data/container-main.tar.tmp data/container-main.tar

# Get container info
CONTAINER_SIZE=$(du -sh data/container-main.tar | cut -f1)
CONTAINER_ID=$(docker ps --filter "name=vibestack-postgres" --format "{{.ID}}")
CONTAINER_IMAGE=$(docker ps --filter "name=vibestack-postgres" --format "{{.Image}}")

echo "✅ Container exported successfully!"
echo "📊 Container size: $CONTAINER_SIZE"
echo "🆔 Container ID: $CONTAINER_ID"
echo "🖼️  Image: $CONTAINER_IMAGE"
echo ""
echo "📁 Exported to: data/container-main.tar"
echo ""
echo "💡 Next steps:"
echo "  git add data/container-main.tar"
echo "  git commit -m 'feat: update container with latest environment state'"
echo ""
echo "🌍 This container can now be used on any machine with:"
echo "  ./scripts/import-container-from-git.sh"