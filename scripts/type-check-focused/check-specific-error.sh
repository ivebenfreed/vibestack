#!/bin/bash

# Check for specific error types with grep
ERROR_TYPE=${1:-"TS2749"}

echo "=== Checking for Error Type: $ERROR_TYPE ==="
echo

# First check server
echo "Checking server..."
cd apps/server
npx tsc --noEmit 2>&1 | grep -A2 "error $ERROR_TYPE" | head -20
cd ../..

echo
echo "---"
echo

# Then check web
echo "Checking web..."
cd apps/web
npx tsc --noEmit 2>&1 | grep -A2 "error $ERROR_TYPE" | head -20
cd ../..

echo
echo "---"
echo

# Then check dataforge
echo "Checking dataforge..."
cd packages/dataforge
npx tsc --noEmit 2>&1 | grep -A2 "error $ERROR_TYPE" | head -20
cd ../..

echo
echo "---"
echo "Usage: ./check-specific-error.sh [ERROR_CODE]"
echo "Example: ./check-specific-error.sh TS2339"