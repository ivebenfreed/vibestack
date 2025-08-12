#!/bin/bash

# Graceful Data Migration Script
# Migrates data from remote Neon database to local PostgreSQL

set -e

echo "🚀 Starting graceful data migration from remote to local..."
echo ""

# Check if required environment variables exist
if [ ! -f "apps/server/.dev.vars" ]; then
    echo "❌ Error: apps/server/.dev.vars file not found!"
    echo "   Please ensure your environment variables are configured."
    exit 1
fi

# Check if local database is running
if ! pg_isready -h localhost -p 5432 -U postgres >/dev/null 2>&1; then
    echo "❌ Error: Local PostgreSQL database is not running!"
    echo "   Please start your local database server."
    exit 1
fi

# Check if local database exists
if ! psql -h localhost -p 5432 -U postgres -d vibestack_dev -c '\q' >/dev/null 2>&1; then
    echo "❌ Error: Local database 'vibestack_dev' does not exist!"
    echo "   Please run migrations first: cd packages/dataforge && pnpm migration:up"
    exit 1
fi

echo "✅ Prerequisites checked"
echo ""

# Confirm migration
echo "⚠️  This will:"
echo "   - Connect to your remote Neon database (read-only)"
echo "   - Clear and repopulate local tables with remote data"
echo "   - Handle schema mismatches gracefully"
echo "   - Skip non-existent fields and tables"
echo ""
read -p "Do you want to continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Migration cancelled"
    exit 0
fi

echo ""
echo "🔄 Running migration..."

# Run the TypeScript migration script
npx tsx scripts/migrate-remote-data.ts

echo ""
echo "✅ Migration script completed!"
echo ""
echo "📝 Next steps:"
echo "   1. Verify your data: psql -h localhost -p 5432 -U postgres -d vibestack_dev"
echo "   2. Test your application: pnpm dev"
echo "   3. Check auth functionality works with migrated users/sessions"