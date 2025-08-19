#!/bin/bash

# export-database.sh - Export database schema and seed data
# This script exports the current database to git-tracked SQL files
# Usage: ./scripts/export-database.sh [database-url]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default database URL
DEFAULT_DB_URL="postgres://postgres:postgres@localhost:5432/vibestack_dev"
DATABASE_URL="${1:-${DATABASE_URL:-$DEFAULT_DB_URL}}"

echo "🗄️ Exporting database to git-tracked files..."
echo "📍 Database: $DATABASE_URL"

# Ensure data directory exists
mkdir -p "$PROJECT_ROOT/data"

# Export schema
echo "📋 Exporting database schema..."
pg_dump --schema-only --no-owner --no-privileges \
  "$DATABASE_URL" \
  > "$PROJECT_ROOT/data/database-schema.sql"

if [ $? -eq 0 ]; then
  echo "✅ Schema exported to data/database-schema.sql"
else
  echo "❌ Failed to export schema"
  exit 1
fi

# Export seed data (excluding sensitive tables)
echo "📋 Exporting seed data..."
pg_dump --data-only --no-owner --no-privileges \
  --exclude-table=sessions \
  --exclude-table=verification_tokens \
  --exclude-table=accounts \
  --exclude-table=authenticators \
  "$DATABASE_URL" \
  > "$PROJECT_ROOT/data/database-seed.sql"

if [ $? -eq 0 ]; then
  echo "✅ Seed data exported to data/database-seed.sql"
else
  echo "❌ Failed to export seed data"
  exit 1
fi

# Show file sizes
echo ""
echo "📊 Export summary:"
echo "   Schema: $(du -h "$PROJECT_ROOT/data/database-schema.sql" | cut -f1)"
echo "   Seed data: $(du -h "$PROJECT_ROOT/data/database-seed.sql" | cut -f1)"

# Check for changes
cd "$PROJECT_ROOT"
if git diff --quiet data/database-schema.sql data/database-seed.sql 2>/dev/null; then
  echo "ℹ️ No changes detected in exported files"
else
  echo "📝 Changes detected in exported files"
  echo ""
  echo "To commit changes:"
  echo "  git add data/database-schema.sql data/database-seed.sql"
  echo "  git commit -m 'feat: update database exports'"
fi

echo ""
echo "✅ Database export completed successfully"