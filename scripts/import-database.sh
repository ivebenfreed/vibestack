#!/bin/bash

# import-database.sh - Import database from git-tracked SQL files
# This script imports the schema and seed data into a PostgreSQL database
# Usage: ./scripts/import-database.sh [database-url]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default database URL
DEFAULT_DB_URL="postgres://postgres:postgres@localhost:5432/vibestack_dev"
DATABASE_URL="${1:-${DATABASE_URL:-$DEFAULT_DB_URL}}"

echo "🗄️ Importing database from git-tracked files..."
echo "📍 Database: $DATABASE_URL"

# Check if schema file exists
SCHEMA_FILE="$PROJECT_ROOT/data/database-schema.sql"
SEED_FILE="$PROJECT_ROOT/data/database-seed.sql"

if [ ! -f "$SCHEMA_FILE" ]; then
  echo "❌ Schema file not found: $SCHEMA_FILE"
  echo "💡 Run ./scripts/export-database.sh first to create the schema file"
  exit 1
fi

# Test database connection
echo "🔌 Testing database connection..."
if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
  echo "❌ Cannot connect to database: $DATABASE_URL"
  exit 1
fi

echo "✅ Database connection successful"

# Drop existing schema (optional - be careful!)
read -p "⚠️ Drop existing schema and data? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🗑️ Dropping existing schema..."
  psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
fi

# Import schema
echo "📋 Importing database schema..."
if psql "$DATABASE_URL" -f "$SCHEMA_FILE"; then
  echo "✅ Schema imported successfully"
else
  echo "❌ Failed to import schema"
  exit 1
fi

# Import seed data if it exists
if [ -f "$SEED_FILE" ]; then
  echo "📋 Importing seed data..."
  if psql "$DATABASE_URL" -f "$SEED_FILE"; then
    echo "✅ Seed data imported successfully"
  else
    echo "⚠️ Failed to import seed data (schema imported successfully)"
    exit 1
  fi
else
  echo "ℹ️ No seed data file found, skipping"
fi

echo ""
echo "✅ Database import completed successfully"
echo ""
echo "📊 Database summary:"
psql "$DATABASE_URL" -c "
  SELECT 
    schemaname,
    tablename,
    tableowner
  FROM pg_tables 
  WHERE schemaname = 'public'
  ORDER BY tablename;
"