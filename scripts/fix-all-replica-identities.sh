#!/bin/bash

# Script to fix replica identity for all existing DataForge entity tables
# This sets REPLICA IDENTITY FULL on all org_* tables to enable UPDATE operations

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

DATABASE_URL="postgres://postgres:postgres@localhost:5432/vibestack_dev"

echo -e "${YELLOW}=== Fixing Replica Identity for All Entity Tables ===${NC}"
echo ""

# Get all org_* tables that don't have FULL replica identity
echo -e "${BLUE}Checking current replica identity status...${NC}"

TABLES_TO_FIX=$(psql "$DATABASE_URL" -t -c "
SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
    AND n.nspname = 'public'
    AND c.relname LIKE 'org_%'
    AND c.relreplident != 'f'
ORDER BY c.relname;")

if [ -z "$TABLES_TO_FIX" ]; then
    echo -e "${GREEN}✓ All entity tables already have FULL replica identity${NC}"
    exit 0
fi

# Count tables
TABLE_COUNT=$(echo "$TABLES_TO_FIX" | wc -l)
echo -e "${YELLOW}Found $TABLE_COUNT tables needing replica identity fix${NC}"
echo ""

# Fix each table
FIXED_COUNT=0
FAILED_COUNT=0

for TABLE in $TABLES_TO_FIX; do
    if [ -z "$TABLE" ]; then
        continue
    fi
    
    echo -n "Fixing $TABLE... "
    
    if psql "$DATABASE_URL" -c "ALTER TABLE $TABLE REPLICA IDENTITY FULL;" 2>/dev/null; then
        echo -e "${GREEN}✓${NC}"
        ((FIXED_COUNT++))
    else
        echo -e "${RED}✗${NC}"
        ((FAILED_COUNT++))
    fi
done

echo ""
echo -e "${YELLOW}=== Summary ===${NC}"
echo -e "${GREEN}✓ Fixed: $FIXED_COUNT tables${NC}"

if [ $FAILED_COUNT -gt 0 ]; then
    echo -e "${RED}✗ Failed: $FAILED_COUNT tables${NC}"
else
    echo -e "${GREEN}✓ All tables successfully updated!${NC}"
fi

# Verify the changes
echo ""
echo -e "${BLUE}Verifying replica identity status...${NC}"

REMAINING_DEFAULT=$(psql "$DATABASE_URL" -t -c "
SELECT COUNT(*)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
    AND n.nspname = 'public'
    AND c.relname LIKE 'org_%'
    AND c.relreplident != 'f';")

if [ "$REMAINING_DEFAULT" -eq 0 ]; then
    echo -e "${GREEN}✓ Verification complete: All entity tables now have FULL replica identity${NC}"
else
    echo -e "${RED}✗ Warning: $REMAINING_DEFAULT tables still have incorrect replica identity${NC}"
fi

echo ""
echo -e "${GREEN}=== Fix Complete ===${NC}"
echo "All entity tables should now support UPDATE operations without replication errors."