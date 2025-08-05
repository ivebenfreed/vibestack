#!/bin/bash
# Show TypeScript errors by category

PACKAGE=$1

if [ -z "$PACKAGE" ]; then
  echo "Usage: ./scripts/show-type-errors.sh [server|web|dataforge]"
  exit 1
fi

case $PACKAGE in
  server)
    cd apps/server
    ;;
  web)
    cd apps/web
    ;;
  dataforge)
    cd packages/dataforge
    ;;
  *)
    echo "Unknown package: $PACKAGE"
    exit 1
    ;;
esac

echo "=== TypeScript errors in $PACKAGE ==="
echo ""

# Group errors by type
echo "Error summary:"
npx tsc --noEmit --pretty false 2>&1 | grep -E "error TS[0-9]+" | sed 's/.*\(TS[0-9]\+\).*/\1/' | sort | uniq -c | sort -nr

echo ""
echo "First 20 errors:"
npx tsc --noEmit --pretty false 2>&1 | grep -E "error TS" | head -20