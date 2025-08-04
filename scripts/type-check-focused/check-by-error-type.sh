#!/bin/bash

# Categorize type errors across the monorepo
echo "=== Categorizing Type Errors by Type ==="
echo

# Run type check and capture output
echo "Running full type check to categorize errors..."
pnpm type-check 2>&1 | tee type-check-categorized.log

# Count total errors
TOTAL_ERRORS=$(grep -c "error TS" type-check-categorized.log 2>/dev/null || echo "0")
echo
echo "Total type errors: $TOTAL_ERRORS"
echo

# Categorize errors
echo "=== Error Categories ==="
echo

# TS2749: refers to a value, but is being used as a type
TS2749_COUNT=$(grep -c "error TS2749" type-check-categorized.log 2>/dev/null || echo "0")
echo "TS2749 (value used as type): $TS2749_COUNT"
if [ "$TS2749_COUNT" -gt 0 ]; then
  echo "  First 3 instances:"
  grep -A1 "error TS2749" type-check-categorized.log | head -6 | sed 's/^/    /'
fi
echo

# TS2304: Cannot find name
TS2304_COUNT=$(grep -c "error TS2304" type-check-categorized.log 2>/dev/null || echo "0")
echo "TS2304 (cannot find name): $TS2304_COUNT"
if [ "$TS2304_COUNT" -gt 0 ]; then
  echo "  First 3 instances:"
  grep -A1 "error TS2304" type-check-categorized.log | head -6 | sed 's/^/    /'
fi
echo

# TS2339: Property does not exist
TS2339_COUNT=$(grep -c "error TS2339" type-check-categorized.log 2>/dev/null || echo "0")
echo "TS2339 (property does not exist): $TS2339_COUNT"
if [ "$TS2339_COUNT" -gt 0 ]; then
  echo "  First 3 instances:"
  grep -A1 "error TS2339" type-check-categorized.log | head -6 | sed 's/^/    /'
fi
echo

# TS2532: Object is possibly undefined
TS2532_COUNT=$(grep -c "error TS2532" type-check-categorized.log 2>/dev/null || echo "0")
echo "TS2532 (possibly undefined): $TS2532_COUNT"
if [ "$TS2532_COUNT" -gt 0 ]; then
  echo "  First 3 instances:"
  grep -A1 "error TS2532" type-check-categorized.log | head -6 | sed 's/^/    /'
fi
echo

# TS2345: Argument type mismatch
TS2345_COUNT=$(grep -c "error TS2345" type-check-categorized.log 2>/dev/null || echo "0")
echo "TS2345 (argument type mismatch): $TS2345_COUNT"
if [ "$TS2345_COUNT" -gt 0 ]; then
  echo "  First 3 instances:"
  grep -A1 "error TS2345" type-check-categorized.log | head -6 | sed 's/^/    /'
fi
echo

# Other errors
OTHER_COUNT=$((TOTAL_ERRORS - TS2749_COUNT - TS2304_COUNT - TS2339_COUNT - TS2532_COUNT - TS2345_COUNT))
echo "Other errors: $OTHER_COUNT"
if [ "$OTHER_COUNT" -gt 0 ]; then
  echo "  Sample of other error types:"
  grep "error TS" type-check-categorized.log | grep -v "TS2749\|TS2304\|TS2339\|TS2532\|TS2345" | head -3 | sed 's/^/    /'
fi