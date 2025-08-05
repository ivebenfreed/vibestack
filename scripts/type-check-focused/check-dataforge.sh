#!/bin/bash

# Check type errors in dataforge package only
echo "=== Checking DataForge Type Errors ==="
echo

cd packages/dataforge

# Run type check for dataforge only
echo "Running dataforge type check..."
npx tsc --noEmit 2>&1 | tee ../../type-check-dataforge.log

# Count errors
ERROR_COUNT=$(grep -c "error TS" ../../type-check-dataforge.log 2>/dev/null || echo "0")

echo
echo "DataForge type errors: $ERROR_COUNT"

# Show first 10 errors if any
if [ "$ERROR_COUNT" -gt 0 ]; then
  echo
  echo "First 10 errors:"
  grep -A1 "error TS" ../../type-check-dataforge.log | head -20
fi

cd ../..