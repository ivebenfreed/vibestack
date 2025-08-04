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
  timeout 30s npx tsc --noEmit 2>&1 | tee "${HOME}/vibestack/type-check-${name}.log"
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
for log in ${HOME}/vibestack/type-check-*.log; do
  if [ -f "$log" ]; then
    name=$(basename "$log" | sed 's/type-check-//;s/.log//')
    count=$(grep -c "error TS" "$log" 2>/dev/null || echo "0")
    echo "$name: $count errors"
  fi
done

echo
echo "To see specific errors, check the log files:"
echo "  type-check-server.log"
echo "  type-check-web.log"
echo "  type-check-dataforge.log"