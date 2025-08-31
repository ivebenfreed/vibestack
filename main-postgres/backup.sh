#!/bin/bash

# Backup Main PostgreSQL Database

set -e

cd "$(dirname "$0")"

if ! docker ps | grep -q "vibestack-main-postgres"; then
    echo "❌ Main PostgreSQL is not running"
    echo "Start it first: ./start.sh"
    exit 1
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="backup_main_${TIMESTAMP}.sql"

echo "💾 Creating Main PostgreSQL Backup"
echo "================================="
echo "   Backup file: $BACKUP_FILE"

docker exec vibestack-main-postgres pg_dump -U postgres vibestack_dev > "$BACKUP_FILE"

if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    SIZE=$(ls -lah "$BACKUP_FILE" | awk '{print $5}')
    echo "✅ Backup created successfully: $BACKUP_FILE ($SIZE)"
    echo ""
    echo "💡 To restore from this backup:"
    echo "   cat $BACKUP_FILE | docker exec -i vibestack-main-postgres psql -U postgres -d vibestack_dev"
else
    echo "❌ Backup failed"
    rm -f "$BACKUP_FILE"
    exit 1
fi