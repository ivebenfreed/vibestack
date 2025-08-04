#!/bin/bash

# Check type errors in web app only
echo "=== Checking Web App Type Errors ==="
echo

cd apps/web

# Run type check for web only
echo "Running web type check..."
npx tsc --noEmit 2>&1 | tee ../../type-check-web.log

# Count errors
ERROR_COUNT=$(grep -c "error TS" ../../type-check-web.log 2>/dev/null || echo "0")

echo
echo "Web app type errors: $ERROR_COUNT"

# Show first 10 errors if any
if [ "$ERROR_COUNT" -gt 0 ]; then
  echo
  echo "First 10 errors:"
  grep -A1 "error TS" ../../type-check-web.log | head -20
fi

cd ../..