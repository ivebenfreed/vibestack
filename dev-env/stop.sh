#!/bin/bash

# Stop VibeStack Development Environment

echo "🛑 Stopping VibeStack Development Environment"
echo "============================================="
echo ""

# Change to the dev-env directory
cd "$(dirname "$0")"

echo "🐳 Stopping containers..."
docker compose down

echo "✅ Development environment stopped"
echo ""
echo "💡 To start again: ./start.sh"