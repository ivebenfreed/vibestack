#!/bin/bash

# Simple Logger Import Migration Script
# This script migrates from contextual loggers (uiLog, syncLog, etc.) to the unified simple logger system

set -e

echo "🔧 Simple Logger Import Migration Script"
echo "=================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Stats
UPDATED_FILES=0
FAILED_FILES=0
SKIPPED_FILES=0

# Function to update a single file
update_file() {
    local file_path="$1"
    
    if [[ ! -f "$file_path" ]]; then
        echo -e "${YELLOW}⚠️  SKIP: File not found: $file_path${NC}"
        ((SKIPPED_FILES++))
        return
    fi
    
    echo -e "${BLUE}🔄 Processing: $file_path${NC}"
    
    # Create backup
    cp "$file_path" "$file_path.backup"
    
    # Check if file needs updating
    if ! grep -q "import.*\\(uiLog\\|syncLog\\|dataLog\\|authLog\\|routingLog\\|performanceLog\\|stateLog\\|testingLog\\|debugLog\\)" "$file_path"; then
        echo -e "${YELLOW}⚠️  SKIP: No contextual logger imports found${NC}"
        rm "$file_path.backup"
        ((SKIPPED_FILES++))
        return
    fi
    
    # Apply transformations using sed
    local temp_file="${file_path}.tmp"
    
    # 1. Replace ALL contextual logger imports with unified log import
    # Handle single contextual imports: import { uiLog } from '@/logger';
    sed -E 's/import \{ (uiLog|syncLog|dataLog|authLog|routingLog|performanceLog|stateLog|testingLog|debugLog) \} from '\''@\/logger'\''[;]?/import { log } from '\''@\/logger'\'';/g' "$file_path" > "$temp_file"
    
    # 2. Handle multiple contextual imports: import { uiLog, syncLog, dataLog } from '@/logger';
    # Replace any line with multiple contextual imports with simple log import
    sed -E 's/import \{ [^}]*(uiLog|syncLog|dataLog|authLog|routingLog|performanceLog|stateLog|testingLog|debugLog)[^}]* \} from '\''@\/logger'\''[;]?/import { log } from '\''@\/logger'\'';/g' "$temp_file" > "${temp_file}2"
    mv "${temp_file}2" "$temp_file"
    
    # 3. Replace logger usage patterns
    # Pattern: const log = uiLog('filename'); -> const myLog = log('filename');
    sed -E 's/const log = (uiLog|syncLog|dataLog|authLog|routingLog|performanceLog|stateLog|testingLog|debugLog)\(([^)]+)\);/const myLog = log(\2);/g' "$temp_file" > "${temp_file}2"
    mv "${temp_file}2" "$temp_file"
    
    # 4. Replace other variable names with contextual loggers
    # Pattern: const myLogger = uiLog('filename'); -> const myLogger = log('filename');
    sed -E 's/const ([a-zA-Z_][a-zA-Z0-9_]*) = (uiLog|syncLog|dataLog|authLog|routingLog|performanceLog|stateLog|testingLog|debugLog)\(([^)]+)\);/const \1 = log(\3);/g' "$temp_file" > "${temp_file}2"
    mv "${temp_file}2" "$temp_file"
    
    # 5. Replace log.method() calls with myLog.method() if we changed const log to const myLog
    if grep -q "const myLog = log(" "$temp_file"; then
        # Only replace bare "log." calls, not "myLog." or other prefixed calls
        # Use word boundaries to be more precise
        sed -E 's/([^a-zA-Z_])log\.([a-zA-Z]+)/\1myLog.\2/g' "$temp_file" > "${temp_file}2"
        mv "${temp_file}2" "$temp_file"
    fi
    
    # Move the final result back
    mv "$temp_file" "$file_path"
    
    # Verify the changes look reasonable
    if grep -q "import { log } from '@/logger'" "$file_path" && \
       ! grep -q "uiLog\\|syncLog\\|dataLog\\|authLog\\|routingLog\\|performanceLog\\|stateLog\\|testingLog\\|debugLog" "$file_path"; then
        echo -e "${GREEN}✅ UPDATED: Successfully migrated to simple logger${NC}"
        rm "$file_path.backup"
        ((UPDATED_FILES++))
    else
        echo -e "${RED}❌ FAILED: Migration incomplete, reverting${NC}"
        mv "$file_path.backup" "$file_path"
        ((FAILED_FILES++))
        
        # Show what might be wrong
        echo "   Remaining old imports:"
        grep -n "uiLog\\|syncLog\\|dataLog\\|authLog\\|routingLog\\|performanceLog\\|stateLog\\|testingLog\\|debugLog" "$file_path" | head -3 || true
    fi
}

# Find all TypeScript/JavaScript files with old logger imports
echo -e "${BLUE}🔍 Finding files with contextual logger imports...${NC}"

# Use ripgrep to find files more efficiently
if command -v rg &> /dev/null; then
    FILES=$(rg -l "import.*\\b(uiLog|syncLog|dataLog|authLog|routingLog|performanceLog|stateLog|testingLog|debugLog)\\b.*from.*@/logger" apps/worker/src/ --type ts --type tsx --type js --type jsx 2>/dev/null || true)
else
    # Fallback to grep
    FILES=$(grep -r -l "import.*\\(uiLog\\|syncLog\\|dataLog\\|authLog\\|routingLog\\|performanceLog\\|stateLog\\|testingLog\\|debugLog\\)" apps/worker/src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null || true)
fi

if [[ -z "$FILES" ]]; then
    echo -e "${YELLOW}⚠️  No files found with contextual logger imports${NC}"
    exit 0
fi

echo -e "${BLUE}📁 Found $(echo "$FILES" | wc -l) files to process${NC}"
echo

# Process each file
while IFS= read -r file_path; do
    [[ -n "$file_path" ]] && update_file "$file_path"
done <<< "$FILES"

echo
echo -e "${BLUE}📊 Migration Summary:${NC}"
echo -e "   ${GREEN}✅ Updated: $UPDATED_FILES files${NC}"
echo -e "   ${YELLOW}⚠️  Skipped: $SKIPPED_FILES files${NC}"
echo -e "   ${RED}❌ Failed: $FAILED_FILES files${NC}"

if [[ $FAILED_FILES -gt 0 ]]; then
    echo
    echo -e "${RED}⚠️  Some files failed migration. Please review them manually.${NC}"
    echo -e "Backup files (.backup) have been preserved for failed migrations."
    exit 1
fi

if [[ $UPDATED_FILES -gt 0 ]]; then
    echo
    echo -e "${GREEN}🎉 Migration completed successfully!${NC}"
    echo -e "${BLUE}💡 Next steps:${NC}"
    echo -e "   1. Test the application: ${YELLOW}pnpm dev${NC}"
    echo -e "   2. Check for any TypeScript errors: ${YELLOW}pnpm type-check${NC}"
    echo -e "   3. If everything works, commit the changes"
    echo
    echo -e "${BLUE}📝 Logger usage is now simplified:${NC}"
    echo -e "   ${GREEN}import { log } from '@/logger';${NC}"
    echo -e "   ${GREEN}const myLog = log('MyComponent.tsx');${NC}"
    echo -e "   ${GREEN}myLog.info('Message', data);${NC}"
    echo -e "   ${GREEN}myLog.debug('Debug info', data);${NC}"
    echo -e "   ${GREEN}myLog.error('Error occurred', error);${NC}"
    echo
    echo -e "${BLUE}🎛️  Runtime controls:${NC}"
    echo -e "   ${GREEN}logControl.debug()                    // Enable debug globally${NC}"
    echo -e "   ${GREEN}logControl.setFolderLevel('vibegrid', 'error')  // Quiet VibeGrid${NC}"
    echo -e "   ${GREEN}logControl.focus('MyComponent')       // Focus on one component${NC}"
    echo -e "   ${GREEN}logControl.status()                   // Check current config${NC}"
fi

echo
echo -e "${BLUE}🔧 Simple Logger Migration Complete${NC}"