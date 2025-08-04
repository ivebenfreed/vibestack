#!/bin/bash

# Script to check type errors by category
# Useful for tracking progress

echo "=== Type Error Analysis ==="
echo

# Function to count errors
count_errors() {
  local pattern="$1"
  local description="$2"
  local count=$(pnpm type-check 2>&1 | grep -c "$pattern" || true)
  printf "%-50s: %d errors\n" "$description" "$count"
}

# Check different error categories
echo "Error counts by type:"
count_errors "TS2749.*refers to a value" "Entity import (value vs type)"
count_errors "TS1361.*cannot be used as a value" "Type-only import used as value"
count_errors "TS2339.*Property.*does not exist" "Missing property"
count_errors "TS2532.*Object is possibly 'undefined'" "Possible undefined"
count_errors "TS2345.*not assignable" "Type assignment errors"
count_errors "TS7006.*implicitly has an 'any' type" "Implicit any"
count_errors "TS2769.*No overload matches" "Overload errors"
count_errors "Comment.*type.*conflicts" "Comment type conflicts"
count_errors "RelationshipConfig" "RelationshipConfig issues"

echo
echo "Errors by location:"
count_errors "apps/server/src/domains" "Domain files"
count_errors "apps/server/src/api" "API files"
count_errors "apps/server/src/sync" "Sync files"
count_errors "apps/server/src/replication" "Replication files"
count_errors "packages/dataforge/src/generated" "Generated files"
count_errors "packages/dataforge/src/scripts" "Script files"
count_errors "apps/web/src" "Web app files"

echo
echo "Total errors:"
pnpm type-check 2>&1 | grep -c "error TS" || echo "0"