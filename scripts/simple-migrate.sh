#!/bin/bash

# Simple logging migration script
set -e

echo "🔄 Starting simple console.log migration..."

# Function to determine context based on file path
get_context() {
    local file="$1"
    if [[ $file =~ src/components/ ]] || [[ $file =~ src/features/ ]] || [[ $file =~ src/routes/ ]]; then
        echo "uiLog"
    elif [[ $file =~ src/sync/ ]] || [[ $file =~ src/state-machines/ ]]; then
        echo "syncLog" 
    elif [[ $file =~ src/legend-state/ ]] || [[ $file =~ src/stores/ ]] || [[ $file =~ src/hooks/ ]]; then
        echo "stateLog"
    elif [[ $file =~ src/lib/auth ]] || [[ $file =~ src/auth/ ]]; then
        echo "authLog"
    elif [[ $file =~ src/api/ ]] || [[ $file =~ src/db/ ]]; then
        echo "dataLog"
    elif [[ $file =~ src/debug/ ]] || [[ $file =~ src/test ]] || [[ $file =~ src/archive/ ]]; then
        echo "debugLog"
    else
        echo "uiLog"  # default
    fi
}

# Process files with console statements
find apps/web/src -name "*.ts" -o -name "*.tsx" | while read file; do
    if grep -q "console\." "$file"; then
        # Skip if already has logger import
        if grep -q "Log.*from.*@/logger" "$file"; then
            continue
        fi
        
        echo "Processing: $file"
        
        # Get context for this file
        context=$(get_context "$file")
        
        # Create backup
        cp "$file" "$file.backup"
        
        # Get relative path for logger name
        relative_path=${file#apps/web/src/}
        
        # Add import at top after existing imports
        if ! grep -q "import.*@/logger" "$file"; then
            # Find the last import line
            last_import_line=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1)
            if [ -n "$last_import_line" ]; then
                # Add logger import after last import
                sed -i "${last_import_line}a\\import { $context } from '@/logger';\nconst log = $context('$relative_path');" "$file"
            else
                # No imports found, add at top
                sed -i '1i\import { '"$context"' } from '\''@/logger'\'';\nconst log = '"$context"'('\'''"$relative_path"'\'');' "$file"
            fi
        fi
        
        # Replace console statements
        sed -i 's/console\.log(/log.info(/g' "$file"
        sed -i 's/console\.error(/log.error(/g' "$file"  
        sed -i 's/console\.warn(/log.warn(/g' "$file"
        sed -i 's/console\.debug(/log.debug(/g' "$file"
        sed -i 's/console\.trace(/log.debug(/g' "$file"
        sed -i 's/console\.info(/log.info(/g' "$file"
        
        # Verify the changes work
        if ! node -c "$file" 2>/dev/null; then
            echo "❌ Syntax error in $file, restoring backup"
            mv "$file.backup" "$file"
        else
            echo "✅ Successfully migrated $file"
            rm "$file.backup"
        fi
    fi
done

echo "🎉 Migration complete!"