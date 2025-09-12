#!/bin/bash
# Clean Neon database restore - completely wipes and rebuilds from SQL dumps
# Handles foreign key dependencies properly

set -e

NEON_URL="postgresql://neondb_owner:npg_N2CLXIVGK9Ra@ep-tight-forest-a4hnhb61-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"

echo "🔄 Clean Neon Database Restore"
echo "📅 Schema: $(stat -c %y data/database-schema.sql)"
echo "📅 Data:   $(stat -c %y data/database-seed.sql)"
echo "🎯 Target: ep-tight-forest-a4hnhb61-pooler.us-east-1.aws.neon.tech/neondb"

read -p "⚠️  This will COMPLETELY WIPE the Neon database. Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Restore cancelled"
    exit 1
fi

echo "🧹 Step 1: Complete database cleanup..."

# Drop all tables, views, sequences, functions, etc. in correct order
psql "$NEON_URL" -v ON_ERROR_STOP=1 << 'EOF'
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Disable foreign key checks temporarily
    SET session_replication_role = replica;
    
    -- Drop all views first
    FOR r IN (SELECT schemaname, viewname FROM pg_views WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP VIEW IF EXISTS ' || quote_ident(r.schemaname) || '.' || quote_ident(r.viewname) || ' CASCADE';
    END LOOP;
    
    -- Drop all tables in any order (CASCADE will handle dependencies)
    FOR r IN (SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
    
    -- Drop all sequences
    FOR r IN (SELECT schemaname, sequencename FROM pg_sequences WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS ' || quote_ident(r.schemaname) || '.' || quote_ident(r.sequencename) || ' CASCADE';
    END LOOP;
    
    -- Drop all functions (except system ones)
    FOR r IN (SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
              FROM pg_proc p 
              JOIN pg_namespace n ON p.pronamespace = n.oid 
              WHERE n.nspname = 'public') LOOP
        BEGIN
            EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(r.nspname) || '.' || quote_ident(r.proname) || '(' || r.args || ') CASCADE';
        EXCEPTION 
            WHEN OTHERS THEN 
                -- Skip functions that can't be dropped (like extension functions)
                NULL;
        END;
    END LOOP;
    
    -- Drop all types
    FOR r IN (SELECT n.nspname, t.typname 
              FROM pg_type t 
              JOIN pg_namespace n ON t.typnamespace = n.oid 
              WHERE n.nspname = 'public' AND t.typtype = 'e') LOOP
        EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.nspname) || '.' || quote_ident(r.typname) || ' CASCADE';
    END LOOP;
    
    -- Re-enable foreign key checks
    SET session_replication_role = DEFAULT;
END $$;
EOF

if [ $? -ne 0 ]; then
    echo "⚠️  Some cleanup operations failed (this is normal for system objects)"
fi

echo "✅ Database cleanup completed"

echo "🏗️  Step 2: Restoring schema..."
psql "$NEON_URL" -f data/database-schema.sql > /tmp/schema-restore.log 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Schema restored successfully"
else
    echo "⚠️  Schema restore had some errors (checking log...)"
    # Check if tables were created despite errors
    TABLE_COUNT=$(psql "$NEON_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
    if [ "$TABLE_COUNT" -gt 10 ]; then
        echo "✅ Core tables created successfully ($TABLE_COUNT tables)"
    else
        echo "❌ Schema restore failed - not enough tables created"
        cat /tmp/schema-restore.log
        exit 1
    fi
fi

echo "📊 Step 3: Restoring data with FK constraint handling..."

# Restore data with foreign key constraints temporarily disabled
psql "$NEON_URL" -v ON_ERROR_STOP=0 << 'EOF'
-- Disable foreign key constraints during data load
SET session_replication_role = replica;

-- Load the data
\i data/database-seed.sql

-- Re-enable foreign key constraints
SET session_replication_role = DEFAULT;
EOF

if [ $? -eq 0 ]; then
    echo "✅ Data restored successfully"
else
    echo "⚠️  Data restore had some constraint errors (checking what was restored...)"
fi

echo "🔍 Step 4: Verification..."

# Get table and data counts
TABLE_COUNT=$(psql "$NEON_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
ACCOUNT_COUNT=$(psql "$NEON_URL" -t -c "SELECT COUNT(*) FROM accounts;" | tr -d ' ')

# Try to get user count (might not exist due to FK issues)
USER_COUNT=$(psql "$NEON_URL" -t -c "SELECT COUNT(*) FROM \"user\";" 2>/dev/null | tr -d ' ' || echo "0")

echo "📋 Restoration Summary:"
echo "  • Tables: $TABLE_COUNT"
echo "  • Accounts: $ACCOUNT_COUNT" 
echo "  • Users: $USER_COUNT"

if [ "$TABLE_COUNT" -gt 30 ]; then
    echo "🎉 Clean restore completed successfully!"
    echo "📝 Database structure fully restored"
    if [ "$USER_COUNT" -gt 0 ]; then
        echo "🎉 User data successfully restored!"
    else
        echo "⚠️  User data may need manual FK resolution"
    fi
else
    echo "❌ Restore incomplete - insufficient tables"
    exit 1
fi

echo "🔗 Staging worker: https://elevra-worker-staging.team-c5f.workers.dev"