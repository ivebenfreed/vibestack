#!/bin/bash
# Quick type check script that checks individual packages

echo "=== Quick Type Check ==="

# Check server only
echo "Checking server..."
cd apps/server && npx tsc --noEmit --pretty false 2>&1 | grep -E "error TS" | wc -l | xargs echo "Server errors:"

# Check web only  
echo "Checking web..."
cd ../web && npx tsc --noEmit --pretty false 2>&1 | grep -E "error TS" | wc -l | xargs echo "Web errors:"

# Check dataforge only
echo "Checking dataforge..."
cd ../../packages/dataforge && npx tsc --noEmit --pretty false 2>&1 | grep -E "error TS" | wc -l | xargs echo "Dataforge errors:"

echo "=== Done ==="