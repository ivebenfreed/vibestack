#!/bin/bash

# Check type errors in server only
echo "=== Checking Server Type Errors ==="
echo

cd apps/server

# Run type check for server only
echo "Running server type check..."
npx tsc --noEmit 2>&1 | tee ../../type-check-server.log

# Count errors
ERROR_COUNT=$(grep -c "error TS" ../../type-check-server.log 2>/dev/null || echo "0")

echo
echo "Server type errors: $ERROR_COUNT"

# Show first 10 errors if any
if [ "$ERROR_COUNT" -gt 0 ]; then
  echo
  echo "First 10 errors:"
  grep -A1 "error TS" ../../type-check-server.log | head -20
fi

cd ../..