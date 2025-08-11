#!/bin/bash

# Monitor database for any DELETE operations
# This script will alert us when data is being deleted

set -euo pipefail

# Database connection details
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-vibestack_dev}"
DB_USER="${DB_USER:-postgres}"
DB_PASS="${PGPASSWORD:-postgres}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Database Monitoring System${NC}"
echo "================================================"
echo "Monitoring: $DB_NAME on $DB_HOST:$DB_PORT"
echo "Press Ctrl+C to stop monitoring"
echo ""

# Function to check table counts
check_table_counts() {
    PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
        SELECT 
            'users:' || COUNT(*) || 
            ' accounts:' || (SELECT COUNT(*) FROM accounts) ||
            ' sessions:' || (SELECT COUNT(*) FROM sessions) ||
            ' tasks:' || (SELECT COUNT(*) FROM tasks) ||
            ' projects:' || (SELECT COUNT(*) FROM projects)
        FROM users;
    " | xargs
}

# Function to check for recent deletes
check_recent_deletes() {
    PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
        SELECT COUNT(*) FROM delete_audit_log 
        WHERE deleted_at > NOW() - INTERVAL '1 minute';
    " 2>/dev/null | xargs || echo "0"
}

# Function to show recent delete details
show_delete_details() {
    PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
        SELECT 
            deleted_at,
            table_name,
            deleted_data->>'id' as deleted_id,
            deleted_data->>'email' as email,
            application_name,
            substring(query, 1, 80) as query
        FROM delete_audit_log 
        WHERE deleted_at > NOW() - INTERVAL '5 minutes'
        ORDER BY deleted_at DESC
        LIMIT 5;
    " 2>/dev/null || echo "No audit log available yet"
}

# Initial state
PREV_COUNTS=$(check_table_counts)
echo "Initial counts: $PREV_COUNTS"
echo ""

# Monitor loop
while true; do
    # Get current counts
    CURR_COUNTS=$(check_table_counts)
    
    # Check for changes
    if [ "$CURR_COUNTS" != "$PREV_COUNTS" ]; then
        echo -e "${RED}🚨 DATABASE CHANGE DETECTED at $(date '+%H:%M:%S')${NC}"
        echo -e "  Previous: $PREV_COUNTS"
        echo -e "  Current:  $CURR_COUNTS"
        
        # Check for recent deletes
        DELETE_COUNT=$(check_recent_deletes)
        if [ "$DELETE_COUNT" -gt "0" ]; then
            echo -e "${RED}  ⚠️  Found $DELETE_COUNT DELETE operations in the last minute!${NC}"
            echo ""
            echo "  Recent delete details:"
            show_delete_details
        fi
        
        echo "================================================"
        PREV_COUNTS=$CURR_COUNTS
    fi
    
    # Also check for any active queries
    ACTIVE_DELETES=$(PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
        SELECT COUNT(*) FROM pg_stat_activity 
        WHERE query ILIKE '%DELETE%' 
        AND query NOT ILIKE '%pg_stat%'
        AND state = 'active';
    " 2>/dev/null | xargs || echo "0")
    
    if [ "$ACTIVE_DELETES" -gt "0" ]; then
        echo -e "${YELLOW}⚠️  Active DELETE query detected!${NC}"
        PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
            SELECT pid, application_name, substring(query, 1, 100) 
            FROM pg_stat_activity 
            WHERE query ILIKE '%DELETE%' 
            AND query NOT ILIKE '%pg_stat%'
            AND state = 'active';
        "
    fi
    
    # Sleep for 5 seconds before next check
    sleep 5
done