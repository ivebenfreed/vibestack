#!/bin/bash
# Restore Neon database from latest SQL dumps
# Uses the latest schema and seed data exports

set -e

# Neon connection details (from existing scripts)
NEON_URL="postgresql://neondb_owner:npg_N2CLXIVGK9Ra@ep-tight-forest-a4hnhb61-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"

echo "🔄 Restoring Neon database from latest SQL dumps..."
echo "📅 Schema: $(stat -c %y data/database-schema.sql)"
echo "📅 Data:   $(stat -c %y data/database-seed.sql)"
echo "🎯 Target: ep-tight-forest-a4hnhb61-pooler.us-east-1.aws.neon.tech/neondb"

read -p "⚠️  This will REPLACE all data in Neon. Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Restore cancelled"
    exit 1
fi

echo "🗑️  Clearing all existing data..."

# Clear existing data (drop all tables)
echo "🧹 Clearing existing tables..."
psql "$NEON_URL" -c "
DO \$\$
DECLARE
    r RECORD;
BEGIN
    -- Drop all tables in dependency order
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename) LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
    
    -- Drop all sequences
    FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS ' || quote_ident(r.sequence_name) || ' CASCADE';
    END LOOP;
    
    -- Drop all functions
    FOR r IN (SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'FUNCTION') LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(r.routine_name) || ' CASCADE';
    END LOOP;
END
\$\$;
"

echo "🏗️  Restoring schema..."
psql "$NEON_URL" -f data/database-schema.sql

echo "📊 Restoring data..."
psql "$NEON_URL" -f data/database-seed.sql

echo "✅ Database restore completed successfully!"
echo "🔍 Verifying restore..."

# Quick verification
TABLES=$(psql "$NEON_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
ROWS=$(psql "$NEON_URL" -t -c "SELECT COUNT(*) FROM user;")

echo "📋 Tables restored: $(echo $TABLES | tr -d ' ')"
echo "👤 User records: $(echo $ROWS | tr -d ' ')"

echo "🎉 Neon database restore complete!"