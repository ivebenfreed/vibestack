#!/bin/bash

# Stop VibeStack Dev-1 Environment

echo "🛑 Stopping VibeStack Dev-1 Environment"
echo "======================================="
echo ""

cd "$(dirname "$0")"

echo "🐳 Stopping containers..."
docker compose down

echo "✅ Dev-1 environment stopped"
echo ""
echo "💡 To start again: ./start.sh"
echo "💡 To create dev-2: cp -r . ../dev-2 && cd ../dev-2 && ./start.sh"