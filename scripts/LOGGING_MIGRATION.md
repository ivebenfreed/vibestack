# Frontend Logging Migration - Automation Scripts

Complete automation for migrating 2,547 console.log statements to contextual logging system.

## 🚀 Quick Start

```bash
# 1. Analyze current state
pnpm log:analyze

# 2. Preview migration (no changes)
pnpm log:migrate:dry

# 3. Migrate sync components only (Phase 1)
pnpm log:migrate --pattern 'sync/*' 

# 4. Validate results
pnpm log:validate

# 5. Fix any import issues
pnpm log:fix
```

## 📋 Available Commands

### Analysis & Planning
```bash
pnpm log:analyze                    # Show current logging patterns
./scripts/migrate-logging.sh analyze --pattern 'sync/*'  # Analyze specific area
```

### Migration
```bash
pnpm log:migrate                    # Migrate all files
pnpm log:migrate:dry                # Preview changes (no modifications)
pnpm log:migrate --pattern 'sync/*' # Migrate specific directory
pnpm log:migrate --context ui       # Migrate UI context files only
```

### Validation & Fixes
```bash
pnpm log:validate                   # Check migration results & run type check
pnpm log:fix                        # Fix missing/duplicate imports
pnpm log:rollback                   # Restore from backup
```

## 🎯 Phase-by-Phase Migration

### Phase 1: High-Priority (Sync System)
```bash
# Sync operations & state machines
pnpm log:migrate --pattern 'sync/*'
pnpm log:migrate --pattern 'state-machines/*'
pnpm log:fix && pnpm log:validate
```

### Phase 2: UI Components
```bash
# VibeGrid and tables
pnpm log:migrate --pattern 'components/custom/vibegrid/*'
pnpm log:migrate --pattern 'components/tables/*'
pnpm log:fix && pnpm log:validate
```

### Phase 3: State & Data
```bash
# Legend State and stores
pnpm log:migrate --pattern 'legend-state/*'
pnpm log:migrate --pattern 'stores/*'
pnpm log:migrate --pattern 'db/*'
pnpm log:fix && pnpm log:validate
```

### Phase 4: Everything Else
```bash
# Remaining files
pnpm log:migrate
pnpm log:fix && pnpm log:validate
```

## 🔧 Script Features

### Smart Context Detection
- **sync/** → `syncLog`
- **components/** → `uiLog`  
- **stores/** → `stateLog`
- **db/** → `dataLog`
- **auth/** → `authLog`

### Safety Features
- **Automatic backups** before migration
- **Dry-run mode** to preview changes
- **Type checking** validation
- **Rollback capability** if issues occur

### Migration Process
1. **Detects context** based on file path
2. **Adds logger import**: `import { uiLog } from '@/logger'`
3. **Creates logger instance**: `const log = uiLog('path/to/file.tsx')`
4. **Replaces statements**: `console.log()` → `log.info()`

## 🚨 Safety & Recovery

### Before Migration
```bash
# Always analyze first
pnpm log:analyze

# Use dry-run to preview
pnpm log:migrate:dry --pattern 'sync/*'
```

### After Migration
```bash
# Validate everything works
pnpm log:validate

# Fix any import issues
pnpm log:fix

# Type check
pnpm type-check
```

### If Issues Occur
```bash
# Rollback to backup
pnpm log:rollback

# Or fix specific issues
./scripts/fix-logging-imports.sh
```

## 📊 Expected Results

**Before Migration:**
- 2,547 `console.log` statements
- No context control
- Console pollution in development

**After Migration:**
- 2,547 contextual log statements  
- Context-based filtering (`ui`, `sync`, `data`, etc.)
- Clean console with `pnpm log:quiet`
- Focused debugging with `pnpm log:vibegrid`

## ⚡ Advanced Usage

### Custom Patterns
```bash
# Migrate specific files
./scripts/migrate-logging.sh migrate --pattern 'components/custom/vibegrid/VibeGrid.tsx'

# Multiple patterns
./scripts/migrate-logging.sh migrate --pattern 'sync/*' --context sync
```

### Context Override
```bash
# Force specific context
./scripts/migrate-logging.sh migrate --pattern 'lib/*' --context data
```

### Rollback to Specific Backup
```bash
# Manual rollback (if needed)
ls .migration-backup/
cp -r .migration-backup/20250829_143052/* apps/web/src/
```

## 🎯 Success Criteria

✅ **All console.log statements migrated**  
✅ **Type checking passes**  
✅ **Dev servers start without errors**  
✅ **Contextual logging works**  
✅ **Quiet mode silences non-errors**  
✅ **Focus modes work correctly**  

Happy migrating! 🚀