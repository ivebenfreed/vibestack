#!/bin/bash

# Fix logging imports and context detection
# Handles edge cases the main migration script might miss

set -e

WEB_SRC="$(dirname "$(dirname "${BASH_SOURCE[0]}")")/apps/web/src"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

fix_missing_imports() {
    echo -e "${BLUE}🔧 Fixing missing logger imports${NC}"
    
    # Find files with contextual log usage but no import
    grep -rl "log\.\(debug\|info\|warn\|error\)" "$WEB_SRC" --include="*.ts" --include="*.tsx" | \
    while read -r file; do
        if ! grep -q "from '@/logger'" "$file"; then
            local rel_path="${file#$WEB_SRC/}"
            echo "  Missing import: $rel_path"
            
            # Detect context based on usage
            local context="ui"
            if [[ "$rel_path" == *"sync/"* ]] || [[ "$rel_path" == *"state-machines/"* ]]; then
                context="sync"
            elif [[ "$rel_path" == *"stores/"* ]] || [[ "$rel_path" == *"legend-state/"* ]]; then
                context="state"
            elif [[ "$rel_path" == *"db/"* ]] || [[ "$rel_path" == *"api/"* ]]; then
                context="data"
            elif [[ "$rel_path" == *"auth/"* ]]; then
                context="auth"
            fi
            
            # Add import and logger creation
            local temp_file=$(mktemp)
            {
                echo "import { ${context}Log } from '@/logger';"
                echo ""
                echo "const log = ${context}Log('$rel_path');"
                echo ""
                cat "$file"
            } > "$temp_file"
            
            mv "$temp_file" "$file"
            echo "    ✅ Added ${context}Log import"
        fi
    done
}

fix_duplicate_imports() {
    echo -e "${BLUE}🔧 Fixing duplicate logger imports${NC}"
    
    grep -rl "from '@/logger'" "$WEB_SRC" --include="*.ts" --include="*.tsx" | \
    while read -r file; do
        local import_count=$(grep -c "from '@/logger'" "$file")
        if [ "$import_count" -gt 1 ]; then
            local rel_path="${file#$WEB_SRC/}"
            echo "  Duplicate imports: $rel_path ($import_count)"
            
            # Keep only the first import
            local temp_file=$(mktemp)
            awk '!found && /from '\''@\/logger'\''/ {print; found=1; next} !/from '\''@\/logger'\''/ {print}' "$file" > "$temp_file"
            mv "$temp_file" "$file"
            echo "    ✅ Removed duplicates"
        fi
    done
}

fix_logger_initialization() {
    echo -e "${BLUE}🔧 Fixing logger initialization${NC}"
    
    grep -rl "from '@/logger'" "$WEB_SRC" --include="*.ts" --include="*.tsx" | \
    while read -r file; do
        # Check if has import but no const log = 
        if grep -q "from '@/logger'" "$file" && ! grep -q "const log = " "$file"; then
            local rel_path="${file#$WEB_SRC/}"
            echo "  Missing logger init: $rel_path"
            
            # Extract context from import
            local context=$(grep "from '@/logger'" "$file" | sed -n 's/.*{ \([^}]*\)Log }.*/\1/p' | head -1)
            if [ -z "$context" ]; then
                context="ui"
            fi
            
            # Add logger initialization after import
            local temp_file=$(mktemp)
            sed "/from '@\/logger'/a\\nconst log = ${context}Log('$rel_path');" "$file" > "$temp_file"
            mv "$temp_file" "$file"
            echo "    ✅ Added logger initialization"
        fi
    done
}

update_context_types() {
    echo -e "${BLUE}🔧 Updating context types for better accuracy${NC}"
    
    # Map of patterns to better contexts
    declare -A BETTER_CONTEXTS=(
        ["components/custom/vibegrid/"]="ui"
        ["components/tables/"]="ui" 
        ["sync/"]="sync"
        ["state-machines/"]="sync"
        ["stores/"]="state"
        ["legend-state/"]="state"
        ["db/"]="data"
        ["lib/auth"]="auth"
        ["routes/"]="routing"
        ["hooks/"]="state"
        ["debug/"]="debug"
    )
    
    for pattern in "${!BETTER_CONTEXTS[@]}"; do
        local context="${BETTER_CONTEXTS[$pattern]}"
        find "$WEB_SRC" -path "*$pattern*" \( -name "*.ts" -o -name "*.tsx" \) | \
        while read -r file; do
            if grep -q "from '@/logger'" "$file"; then
                local current_import=$(grep "from '@/logger'" "$file" | head -1)
                local current_context=$(echo "$current_import" | sed -n 's/.*{ \([^}]*\)Log }.*/\1/p')
                
                if [ "$current_context" != "$context" ]; then
                    local rel_path="${file#$WEB_SRC/}"
                    echo "  Updating context: $rel_path ($current_context → $context)"
                    
                    # Replace import and initialization
                    sed -i "s/${current_context}Log/${context}Log/g" "$file"
                    echo "    ✅ Updated to ${context}Log"
                fi
            fi
        done
    done
}

check_orphaned_console_logs() {
    echo -e "${BLUE}🔍 Checking for orphaned console.log statements${NC}"
    
    local remaining=$(grep -r "console\.\(log\|debug\|info\|warn\)" "$WEB_SRC" --include="*.ts" --include="*.tsx" | wc -l)
    if [ "$remaining" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Found $remaining remaining console.log statements:${NC}"
        grep -r "console\.\(log\|debug\|info\|warn\)" "$WEB_SRC" --include="*.ts" --include="*.tsx" -n | head -5
        
        # Offer to convert them
        echo ""
        echo "Run migration script to convert these:"
        echo "  ./scripts/migrate-logging.sh migrate --dry-run"
    else
        echo -e "${GREEN}✅ No orphaned console.log statements found${NC}"
    fi
}

# Run all fixes
echo -e "${BLUE}🛠️  Frontend Logging Import Fixer${NC}"
echo ""

fix_missing_imports
echo ""
fix_duplicate_imports  
echo ""
fix_logger_initialization
echo ""
update_context_types
echo ""
check_orphaned_console_logs

echo ""
echo -e "${GREEN}🎉 Import fixing complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Run type check: pnpm type-check"
echo "  2. Test logging: pnpm log:vibegrid && pnpm dev"
echo "  3. Validate: ./scripts/migrate-logging.sh validate"