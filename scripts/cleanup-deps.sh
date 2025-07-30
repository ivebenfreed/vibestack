#!/bin/bash

# Clean up dependencies across the entire codebase
# This script removes unused deps and moves deps to correct packages

set -e

echo "🧹 Starting dependency cleanup..."
echo ""

# 1. Remove unused dependencies from root
echo "1️⃣ Removing unused dependencies from root package.json..."
pnpm remove @electric-sql/pglite-react @electric-sql/pglite-repl @modelcontextprotocol/server-brave-search @modelcontextprotocol/server-postgres position-observer || true

# 2. Move dependencies from root to appropriate packages
echo ""
echo "2️⃣ Moving dependencies to correct packages..."

# Move dnd-kit to web
echo "   Moving @dnd-kit packages to web..."
cd apps/web
pnpm add @dnd-kit/core@^6.3.1 @dnd-kit/sortable@^10.0.0 @dnd-kit/utilities@^3.2.2
cd ../..
pnpm remove @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities || true

# Move rich-textarea to web
echo "   Moving rich-textarea to web..."
cd apps/web
pnpm add rich-textarea@^0.26.4
cd ../..
pnpm remove rich-textarea || true

# Remove duplicates that are already in correct packages
echo ""
echo "3️⃣ Removing duplicate dependencies from root..."
pnpm remove @electric-sql/pglite hono jotai tailwindcss || true

# 4. Check for unused dependencies in web
echo ""
echo "4️⃣ Checking web package for unused dependencies..."
cd apps/web

# These seem potentially unused based on no imports found
echo "   Potentially unused in web (manual review recommended):"
echo "   - @tanstack/db (not found in imports)"
echo "   - @tanstack/react-db (not found in imports)"
echo "   - handsontable (check if actually used)"
echo "   - konva/react-konva (check if actually used)"
echo "   - react-data-grid (check if actually used)"
echo "   - tw-animate-css (check if actually used)"

cd ../..

# 5. Clean up server dependencies
echo ""
echo "5️⃣ Checking server dependencies..."
cd apps/server
# Server deps look clean, but check for unused
echo "   Server dependencies appear correct"
cd ../..

# 6. Clean up dataforge 
echo ""
echo "6️⃣ Checking dataforge dependencies..."
cd packages/dataforge
# Remove ts-node since we're using tsx now
pnpm remove ts-node || true
cd ../..

# 7. Update lockfile
echo ""
echo "7️⃣ Updating lockfile..."
pnpm install

echo ""
echo "✅ Dependency cleanup complete!"
echo ""
echo "⚠️  Please manually review and test:"
echo "   1. Check if handsontable, konva, react-data-grid are actually used"
echo "   2. Run 'pnpm build' to ensure everything still builds"
echo "   3. Run 'pnpm dev' to test the application"
echo ""
echo "💡 Additional recommendations:"
echo "   - Consider using 'knip' or 'depcheck' for deeper analysis"
echo "   - Review devDependencies for unused tools"
echo "   - Ensure all workspace packages have correct peer dependencies"