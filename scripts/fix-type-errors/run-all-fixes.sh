#!/bin/bash

# Master script to run all type error fixes in order
# Run this to apply all fixes systematically

echo "========================================="
echo "Type Error Fix Master Script"
echo "========================================="
echo

# Make all scripts executable
chmod +x scripts/fix-type-errors/*.sh

# Track which scripts succeed
declare -a results

# Run each script and track results
scripts=(
  "01-fix-entity-imports.sh"
  "02-fix-comment-conflicts.sh"
  "03-fix-relationship-config.sh"
  "04-fix-null-checks.sh"
  "05-fix-dataforge-generated.sh"
  "06-fix-dataforge-scripts.sh"
)

for script in "${scripts[@]}"; do
  echo
  echo "Running: $script"
  echo "-----------------------------------------"
  
  if ./scripts/fix-type-errors/"$script"; then
    results+=("✓ $script - SUCCESS")
  else
    results+=("✗ $script - FAILED")
  fi
  
  echo
done

echo "========================================="
echo "Summary of Results:"
echo "========================================="
for result in "${results[@]}"; do
  echo "$result"
done

echo
echo "Next steps:"
echo "1. Run 'pnpm type-check' to see remaining errors"
echo "2. Some dataforge files may need regeneration:"
echo "   cd packages/dataforge && pnpm generate"
echo "3. Check web app errors separately if needed"