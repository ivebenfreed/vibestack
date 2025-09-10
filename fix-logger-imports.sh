#!/bin/bash

# Fix all old logger imports to use the new simplified logger

echo "🔧 Fixing old logger imports..."

# Find all TypeScript files with old logger imports
find apps/worker/src -name "*.ts" -o -name "*.tsx" | while read file; do
    # Check if file has old logger imports
    if grep -q "import.*\(uiLog\|syncLog\|dataLog\|authLog\|stateLog\|routingLog\|performanceLog\|testingLog\|debugLog\)" "$file"; then
        echo "Fixing: $file"
        
        # Replace old imports with new import
        sed -i 's/import { [^}]*\(uiLog\|syncLog\|dataLog\|authLog\|stateLog\|routingLog\|performanceLog\|testingLog\|debugLog\)[^}]* } from.*@\/logger.*;/import { log } from '\''@\/logger'\'';/' "$file"
        
        # Replace old logger calls
        sed -i 's/const log = \(uiLog\|syncLog\|dataLog\|authLog\|stateLog\|routingLog\|performanceLog\|testingLog\|debugLog\)(/const myLog = log(/' "$file"
        
        # Replace log. with myLog.
        sed -i 's/\blog\./myLog./g' "$file"
    fi
done

echo "✅ Logger imports fixed!"