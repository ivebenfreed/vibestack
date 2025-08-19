# Dexie Reference Files

This folder contains the original Dexie-based implementation files that were replaced with pure LiveStore equivalents.

**⚠️ These files are REFERENCE ONLY - not used in the active codebase**

## Files Moved Here

### Database Layer
- `dexie-schema.ts` - Original Dexie database schema
- `dexie-init.ts` - Dexie database initialization
- `dexie-provider.tsx` - React provider for Dexie
- `dexie-storage.ts` - Dexie storage utilities
- `dexie-change-tracking.ts` - Manual change tracking for sync

### Sync Services
- `DexieOutgoingChangeService.ts` - Dexie-based outgoing sync
- `DexieIntegrityService.ts` - Dexie-based integrity checking
- `ServiceCoordinator.ts` - Original hybrid service coordinator

### State Machines
- `sync-machine-v3.ts` - Original sync machine with Dexie dependencies

## Pure LiveStore Replacements

These files were replaced with:

### Database Layer
- `apps/web/src/lib/livestore-hooks.ts` - Pure LiveStore React hooks
- `apps/web/src/lib/livestore-event-generator.ts` - Schema-driven mutations
- `apps/web/src/lib/livestore-native-sync.ts` - Native LiveStore sync

### Sync Services
- `apps/web/src/sync/PureLiveStoreSync.ts` - Pure LiveStore sync services
- `apps/web/src/sync/utils/PureLiveStoreServiceCoordinator.ts` - Pure LiveStore coordinator

### State Machines
- `apps/web/src/state-machines/machines/pure-livestore-sync-machine.ts` - Pure LiveStore sync machine

## Migration Completed

✅ **Zero Dexie dependencies** in active codebase  
✅ **All functionality preserved** with LiveStore equivalents  
✅ **Performance improved** with native SQLite operations  
✅ **Architecture simplified** with single data source  

**Date Migrated**: $(date)
**Migration Type**: Complete clean break from Dexie to pure LiveStore