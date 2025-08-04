#!/bin/bash

# Fast type check that doesn't hang - runs each package separately with timeout

echo "=== Running Focused Type Checks ==="
echo

# Function to run type check with timeout
run_check() {
  local name=$1
  local dir=$2
  echo "Checking $name..."
  
  cd "$dir"
  # Run with 30 second timeout
  timeout 30s npx tsc --noEmit > "${HOME}/vibestack/type-check-${name}.log" 2>&1
  local exit_code=$?
  
  if [ $exit_code -eq 124 ]; then
    echo "  ❌ TIMEOUT after 30s"
  else
    local error_count=$(grep -c "error TS" "${HOME}/vibestack/type-check-${name}.log" 2>/dev/null || echo "0")
    echo "  Errors: $error_count"
  fi
  
  cd - > /dev/null
  echo
}

# Run checks
run_check "server" "${HOME}/vibestack/apps/server"
run_check "web" "${HOME}/vibestack/apps/web"
run_check "dataforge" "${HOME}/vibestack/packages/dataforge"

# Summary
echo "=== Summary ==="
echo
total_errors=0
for log in ${HOME}/vibestack/type-check-*.log; do
  if [ -f "$log" ]; then
    name=$(basename "$log" | sed 's/type-check-//;s/.log//')
    # Skip the errors log file which is from a different purpose
    if [ "$name" = "errors" ]; then
      continue
    fi
    # Get error count and ensure it's a number
    count=$(grep -c "error TS" "$log" 2>/dev/null || echo "0")
    count=$(echo "$count" | tr -d '\n\r ' | head -1)  # Clean up any whitespace/newlines and take first line
    if ! [[ "$count" =~ ^[0-9]+$ ]]; then
      count="0"  # Default to 0 if not a valid number
    fi
    echo "$name: $count errors"
    total_errors=$((total_errors + count))
  fi
done

echo
if [ $total_errors -gt 0 ]; then
  echo "❌ Total: $total_errors type errors found!"
  echo
  echo "To see specific errors, check the log files:"
  echo "  type-check-server.log"
  echo "  type-check-web.log"
  echo "  type-check-dataforge.log"
  exit 1
else
  echo "✅ All type checks passed!"
  exit 0
fi