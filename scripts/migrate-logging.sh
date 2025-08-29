#!/bin/bash

# Frontend Logging Migration Script
# Migrates console.log statements to contextual logging system

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WEB_SRC="$PROJECT_ROOT/apps/web/src"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Context mapping based on file paths
declare -A CONTEXT_MAP=(
    ["sync/"]="sync"
    ["state-machines/"]="sync" 
    ["components/custom/vibegrid/"]="ui"
    ["components/tables/"]="ui"
    ["components/"]="ui"
    ["legend-state/"]="state"
    ["stores/"]="state"
    ["db/"]="data"
    ["lib/auth"]="auth"
    ["auth/"]="auth"
    ["routes/"]="routing"
    ["api/"]="data"
    ["hooks/"]="state"
    ["features/"]="ui"
    ["debug/"]="debug"
    ["test"]="testing"
    ["archive/"]="debug"
)

show_help() {
    echo -e "${BLUE}🔄 Frontend Logging Migration Script${NC}"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  analyze     Analyze current logging patterns"
    echo "  migrate     Migrate console.log statements"
    echo "  validate    Check migration results"
    echo "  rollback    Restore from backup"
    echo ""
    echo "Options:"
    echo "  --pattern PATTERN    Only process files matching pattern"
    echo "  --context CONTEXT    Only process files for specific context"
    echo "  --dry-run           Show what would be changed without making changes"
    echo "  --backup-dir DIR    Custom backup directory (default: .migration-backup)"
    echo ""
    echo "Examples:"
    echo "  $0 analyze                              # Analyze all files"
    echo "  $0 migrate --pattern 'sync/*'          # Migrate sync files only"
    echo "  $0 migrate --context ui --dry-run      # Preview UI migration"
    echo "  $0 validate                             # Check migration results"
}

analyze_logging() {
    local pattern="${1:-*}"
    echo -e "${BLUE}📊 Analyzing console.log patterns${NC}"
    
    # Count total occurrences
    local total_logs=$(grep -r "console\.\(log\|debug\|info\|warn\)" "$WEB_SRC" --include="*.ts" --include="*.tsx" | wc -l)
    local total_files=$(grep -rl "console\.\(log\|debug\|info\|warn\)" "$WEB_SRC" --include="*.ts" --include="*.tsx" | wc -l)
    
    echo "Total console.log statements: $total_logs"
    echo "Files containing logs: $total_files"
    echo ""
    
    # Breakdown by directory
    echo -e "${YELLOW}📁 Breakdown by directory:${NC}"
    for context_path in "${!CONTEXT_MAP[@]}"; do
        local context="${CONTEXT_MAP[$context_path]}"
        local count=$(find "$WEB_SRC" -path "*$context_path*" -name "*.ts" -o -name "*.tsx" | \
                     xargs grep -l "console\.\(log\|debug\|info\|warn\)" 2>/dev/null | wc -l)
        if [ "$count" -gt 0 ]; then
            printf "  %-20s %-8s %d files\n" "$context_path" "($context)" "$count"
        fi
    done
    
    # Top 10 files with most logs
    echo ""
    echo -e "${YELLOW}🔥 Top 10 files with most console.log statements:${NC}"
    grep -r "console\.\(log\|debug\|info\|warn\)" "$WEB_SRC" --include="*.ts" --include="*.tsx" -c | \
        sort -t: -k2 -nr | head -10 | while IFS=: read -r file count; do
        local rel_path="${file#$WEB_SRC/}"
        printf "  %-50s %d logs\n" "$rel_path" "$count"
    done
}

detect_context() {
    local file_path="$1"
    local rel_path="${file_path#$WEB_SRC/}"
    
    # Try to match against context patterns
    for context_path in "${!CONTEXT_MAP[@]}"; do
        if [[ "$rel_path" == *"$context_path"* ]]; then
            echo "${CONTEXT_MAP[$context_path]}"
            return
        fi
    done
    
    # Default fallback
    echo "ui"
}

create_backup() {
    local backup_dir="${1:-.migration-backup}"
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local full_backup_dir="$PROJECT_ROOT/$backup_dir/$timestamp"
    
    echo -e "${BLUE}💾 Creating backup in $full_backup_dir${NC}"
    mkdir -p "$full_backup_dir"
    
    # Copy all TypeScript files with console.log
    grep -rl "console\.\(log\|debug\|info\|warn\)" "$WEB_SRC" --include="*.ts" --include="*.tsx" | \
    while read -r file; do
        local rel_path="${file#$WEB_SRC/}"
        local backup_file="$full_backup_dir/$rel_path"
        mkdir -p "$(dirname "$backup_file")"
        cp "$file" "$backup_file"
    done
    
    echo "$full_backup_dir" > "$PROJECT_ROOT/.last-migration-backup"
    echo "✅ Backup created: $full_backup_dir"
}

migrate_file() {
    local file_path="$1"
    local dry_run="$2"
    local context=$(detect_context "$file_path")
    local rel_path="${file_path#$WEB_SRC/}"
    
    # Check if file has console.log statements
    if ! grep -q "console\.\(log\|debug\|info\|warn\)" "$file_path"; then
        return 0
    fi
    
    echo -e "  ${YELLOW}📝 $rel_path${NC} (context: $context)"
    
    if [ "$dry_run" = "true" ]; then
        local log_count=$(grep -c "console\.\(log\|debug\|info\|warn\)" "$file_path")
        echo "    Would migrate $log_count console.log statements"
        return 0
    fi
    
    # Create temporary file for processing
    local temp_file=$(mktemp)
    cp "$file_path" "$temp_file"
    
    # Check if import already exists
    if ! grep -q "from '@/logger'" "$temp_file"; then
        # Find the right place to insert import (after other imports)
        local import_line=$(grep -n "^import" "$temp_file" | tail -1 | cut -d: -f1)
        if [ -n "$import_line" ]; then
            # Insert after last import
            sed -i "${import_line}a\\import { ${context}Log } from '@/logger';\\n\\nconst log = ${context}Log('$rel_path');" "$temp_file"
        else
            # No imports found, add at top
            sed -i "1i\\import { ${context}Log } from '@/logger';\\n\\nconst log = ${context}Log('$rel_path');" "$temp_file"
        fi
    fi
    
    # Replace console.log statements
    sed -i 's/console\.log(/log.info(/g' "$temp_file"
    sed -i 's/console\.debug(/log.debug(/g' "$temp_file"
    sed -i 's/console\.info(/log.info(/g' "$temp_file"
    sed -i 's/console\.warn(/log.warn(/g' "$temp_file"
    
    # Move temp file back
    mv "$temp_file" "$file_path"
    
    local log_count=$(grep -c "log\.\(debug\|info\|warn\|error\)" "$file_path")
    echo "    ✅ Migrated to $log_count contextual log statements"
}

migrate_pattern() {
    local pattern="$1"
    local context_filter="$2"
    local dry_run="$3"
    
    echo -e "${BLUE}🔄 Migrating console.log statements${NC}"
    [ "$dry_run" = "true" ] && echo -e "${YELLOW}(DRY RUN MODE)${NC}"
    
    # Find files matching pattern
    local files=()
    if [ -n "$pattern" ]; then
        while IFS= read -r -d '' file; do
            files+=("$file")
        done < <(find "$WEB_SRC" -path "*$pattern*" \( -name "*.ts" -o -name "*.tsx" \) -print0)
    else
        while IFS= read -r -d '' file; do
            files+=("$file")
        done < <(find "$WEB_SRC" \( -name "*.ts" -o -name "*.tsx" \) -print0)
    fi
    
    # Filter by context if specified
    if [ -n "$context_filter" ]; then
        local filtered_files=()
        for file in "${files[@]}"; do
            local file_context=$(detect_context "$file")
            if [ "$file_context" = "$context_filter" ]; then
                filtered_files+=("$file")
            fi
        done
        files=("${filtered_files[@]}")
    fi
    
    echo "Processing ${#files[@]} files..."
    echo ""
    
    local migrated_count=0
    for file in "${files[@]}"; do
        if migrate_file "$file" "$dry_run"; then
            ((migrated_count++))
        fi
    done
    
    echo ""
    echo -e "${GREEN}✅ Migration complete${NC}"
    echo "Files processed: $migrated_count"
}

validate_migration() {
    echo -e "${BLUE}✅ Validating migration results${NC}"
    
    # Check for remaining console.log statements
    local remaining_logs=$(grep -r "console\.\(log\|debug\|info\|warn\)" "$WEB_SRC" --include="*.ts" --include="*.tsx" | wc -l)
    if [ "$remaining_logs" -gt 0 ]; then
        echo -e "${RED}⚠️  Found $remaining_logs remaining console.log statements:${NC}"
        grep -r "console\.\(log\|debug\|info\|warn\)" "$WEB_SRC" --include="*.ts" --include="*.tsx" -n | head -10
    else
        echo -e "${GREEN}✅ No console.log statements found${NC}"
    fi
    
    # Check for proper imports
    local files_with_logs=$(grep -rl "log\.\(debug\|info\|warn\|error\)" "$WEB_SRC" --include="*.ts" --include="*.tsx" | wc -l)
    local files_with_imports=$(grep -rl "from '@/logger'" "$WEB_SRC" --include="*.ts" --include="*.tsx" | wc -l)
    
    echo "Files with contextual logs: $files_with_logs"
    echo "Files with logger imports: $files_with_imports"
    
    if [ "$files_with_logs" -ne "$files_with_imports" ]; then
        echo -e "${YELLOW}⚠️  Import/usage mismatch detected${NC}"
    fi
    
    # Type check
    echo ""
    echo -e "${BLUE}🔍 Running type check...${NC}"
    if pnpm type-check > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Type check passed${NC}"
    else
        echo -e "${RED}❌ Type check failed${NC}"
        echo "Run 'pnpm type-check' for details"
    fi
}

rollback_migration() {
    local backup_file="$PROJECT_ROOT/.last-migration-backup"
    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}❌ No backup found${NC}"
        exit 1
    fi
    
    local backup_dir=$(cat "$backup_file")
    if [ ! -d "$backup_dir" ]; then
        echo -e "${RED}❌ Backup directory not found: $backup_dir${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}🔄 Rolling back from $backup_dir${NC}"
    
    # Restore files
    find "$backup_dir" -name "*.ts" -o -name "*.tsx" | while read -r backup_file; do
        local rel_path="${backup_file#$backup_dir/}"
        local target_file="$WEB_SRC/$rel_path"
        cp "$backup_file" "$target_file"
        echo "  Restored: $rel_path"
    done
    
    echo -e "${GREEN}✅ Rollback complete${NC}"
}

# Parse arguments
COMMAND=""
PATTERN=""
CONTEXT=""
DRY_RUN="false"
BACKUP_DIR=".migration-backup"

while [[ $# -gt 0 ]]; do
    case $1 in
        analyze|migrate|validate|rollback)
            COMMAND="$1"
            shift
            ;;
        --pattern)
            PATTERN="$2"
            shift 2
            ;;
        --context)
            CONTEXT="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        --backup-dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Execute command
case $COMMAND in
    analyze)
        analyze_logging "$PATTERN"
        ;;
    migrate)
        if [ "$DRY_RUN" = "false" ]; then
            create_backup "$BACKUP_DIR"
        fi
        migrate_pattern "$PATTERN" "$CONTEXT" "$DRY_RUN"
        ;;
    validate)
        validate_migration
        ;;
    rollback)
        rollback_migration
        ;;
    "")
        echo -e "${RED}❌ No command specified${NC}"
        show_help
        exit 1
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $COMMAND${NC}"
        show_help
        exit 1
        ;;
esac