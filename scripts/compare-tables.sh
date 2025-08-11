#!/bin/bash

echo "📊 Comparing Local vs Remote Database Tables"
echo "==========================================="
echo

# Get local tables
LOCAL_TABLES=$(psql postgres://postgres:postgres@localhost:5432/vibestack_dev -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;" | tr -d ' ')

# Get remote tables
export PGPASSWORD=npg_N2CLXIVGK9Ra
REMOTE_TABLES=$(psql -h ep-tight-forest-a4hnhb61-pooler.us-east-1.aws.neon.tech -U neondb_owner -d neondb -p 5432 -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;" | tr -d ' ')

echo "📦 Tables only in LOCAL:"
for table in $LOCAL_TABLES; do
  if ! echo "$REMOTE_TABLES" | grep -q "^$table$"; then
    echo "  ✅ $table"
  fi
done
echo

echo "☁️  Tables only in REMOTE:"
for table in $REMOTE_TABLES; do
  if ! echo "$LOCAL_TABLES" | grep -q "^$table$"; then
    echo "  ⚠️  $table"
  fi
done
echo

echo "🔄 Tables in BOTH:"
for table in $LOCAL_TABLES; do
  if echo "$REMOTE_TABLES" | grep -q "^$table$"; then
    echo "  ✓ $table"
  fi
done