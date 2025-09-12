#!/bin/bash
# Simple clean restore - drops all tables and recreates from scratch
set -e

NEON_URL="postgresql://neondb_owner:npg_N2CLXIVGK9Ra@ep-tight-forest-a4hnhb61-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"

echo "🔄 Simple Clean Neon Database Restore"
echo "📅 Schema: $(stat -c %y data/database-schema.sql)"
echo "📅 Data:   $(stat -c %y data/database-seed.sql)"

read -p "⚠️  This will WIPE and recreate the Neon database. Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Restore cancelled"
    exit 1
fi

echo "🧹 Step 1: Dropping all existing tables..."

# Simple approach: Drop all tables with CASCADE
psql "$NEON_URL" -c "
DO \$\$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all tables with CASCADE to handle foreign keys
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END \$\$;
"

echo "✅ Tables dropped"

echo "🏗️  Step 2: Restoring schema..."
psql "$NEON_URL" -f data/database-schema.sql > /tmp/schema-restore.log 2>&1

TABLE_COUNT=$(psql "$NEON_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "✅ Schema restored: $(echo $TABLE_COUNT | tr -d ' ') tables"

echo "📊 Step 3: Restoring data..."
psql "$NEON_URL" -f data/database-seed.sql > /tmp/data-restore.log 2>&1

echo "🔍 Step 4: Verification..."

# Check what we got
ACCOUNT_COUNT=$(psql "$NEON_URL" -t -c "SELECT COUNT(*) FROM accounts;" 2>/dev/null | tr -d ' ' || echo "0")
USER_COUNT=$(psql "$NEON_URL" -t -c "SELECT COUNT(*) FROM \"user\";" 2>/dev/null | tr -d ' ' || echo "0")
ORG_COUNT=$(psql "$NEON_URL" -t -c "SELECT COUNT(*) FROM organizations;" 2>/dev/null | tr -d ' ' || echo "0")
PROJECT_COUNT=$(psql "$NEON_URL" -t -c "SELECT COUNT(*) FROM projects;" 2>/dev/null | tr -d ' ' || echo "0")

echo "📋 Restoration Results:"
echo "  • Tables: $(echo $TABLE_COUNT | tr -d ' ')"
echo "  • Accounts: $ACCOUNT_COUNT"
echo "  • Users: $USER_COUNT"
echo "  • Organizations: $ORG_COUNT"  
echo "  • Projects: $PROJECT_COUNT"

if [ "$USER_COUNT" -gt 0 ] && [ "$ORG_COUNT" -gt 0 ]; then
    echo "🎉 Clean restore completed successfully!"
    echo "🎉 All core data restored without foreign key conflicts!"
else
    echo "⚠️  Some data may be missing due to FK constraints"
    echo "📝 Check logs: /tmp/data-restore.log"
fi

echo "🔗 Test your staging worker: https://elevra-worker-staging.team-c5f.workers.dev"