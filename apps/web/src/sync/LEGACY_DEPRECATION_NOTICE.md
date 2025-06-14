# 🚨 LEGACY SYNC FILES DEPRECATION NOTICE

## Overview
These files are **DEPRECATED** and will be removed in a future release. They have been replaced by the new pure services architecture with XState coordination.

## Migration Status: ✅ COMPLETE

**Date**: Current
**New Architecture**: sync-machine-v2.ts + Pure Services
**Status**: Production Ready

## Deprecated Files

### 🔄 **Core Sync Management**
- ❌ `SyncManager.ts` → ✅ `sync-machine-v2.ts` + Pure Services
- ❌ `SyncEventEmitter.ts` → ✅ Callback-based events
- ❌ `IndexedDBSyncStore.ts` → ✅ Orchestrator context

### 🌐 **WebSocket Management**  
- ❌ `WebSocketConnector.ts` → ✅ `WebSocketService.ts`

### 📨 **Message Processing**
- ❌ `SyncMessageHandler.ts` → ✅ `IncomingChangeService.ts` + `OutgoingChangeService.ts`
- ❌ `IncomingChangeProcessor.ts` → ✅ `IncomingChangeService.ts`
- ❌ `OutgoingChangeProcessor.ts` → ✅ `OutgoingChangeService.ts`

### ⚡ **State Machines**
- ❌ `sync-machine.ts` → ✅ `sync-machine-v2.ts`

## What Changed

### ❌ **Old Architecture Problems**
```
- Circular dependencies (SyncManager ←→ XState)  
- 88+ events across multiple systems
- Multiple sources of truth for LSN/state
- Complex event timing dependencies
- Difficult testing and debugging
```

### ✅ **New Architecture Benefits**  
```
- Zero circular dependencies
- 28 events/callbacks (68% reduction)
- Single source of truth (Orchestrator)
- Pure services with callback events
- Easy testing and debugging
```

## Migration Guide

### For UI Components
```typescript
// OLD: Access via SyncManager
const syncManager = SyncManager.getInstance();
const status = syncManager.getStatus();
const lsn = syncManager.getLSN();

// NEW: Access via Orchestrator Context
const orchestrator = useOrchestrator();
const status = orchestrator.syncState.phase;
const lsn = orchestrator.syncState.currentLSN;
```

### For Event Listening
```typescript
// OLD: Global event emitter
syncManager.on('sync:statusChanged', handler);
syncManager.on('lsn:updated', handler);

// NEW: XState context changes
// Events flow automatically through orchestrator context
// UI components reactively update via context subscriptions
```

### For Testing
```typescript
// OLD: Complex setup
const mockSyncManager = new SyncManager();
// ... setup 7 processors
// ... mock SyncEventEmitter
// ... handle circular dependencies

// NEW: Simple service testing
const webSocketService = new WebSocketService(config);
const incomingService = new IncomingChangeService(config, dataSource);
// Pure functions, easy mocking, no dependencies
```

## DO NOT USE These Files

The following files should **NOT** be imported in new code:

```typescript
// ❌ DO NOT USE
import { SyncManager } from './SyncManager';
import { SyncEventEmitter } from './SyncEventEmitter';  
import { WebSocketConnector } from './WebSocketConnector';
import { IncomingChangeProcessor } from './IncomingChangeProcessor';
import { OutgoingChangeProcessor } from './OutgoingChangeProcessor';
import { SyncMessageHandler } from './SyncMessageHandler';
import { IndexedDBSyncStore } from './IndexedDBSyncStore';

// ✅ USE INSTEAD
import { WebSocketService } from './WebSocketService';
import { IncomingChangeService } from './IncomingChangeService';
import { OutgoingChangeService } from './OutgoingChangeService';
import { LSNService } from './LSNService';
// Access state via Orchestrator context
```

## Removal Timeline

- **Phase 1-3**: ✅ Complete - New architecture implemented
- **Phase 4**: 🔄 Current - Legacy file cleanup and deprecation
- **Phase 5**: 🗑️ Future - Remove deprecated files (after full verification)

## Support

If you encounter issues with the new architecture, please:

1. Check this migration guide
2. Review `SYNC_FLOW_COMPARISON.md` for detailed flow analysis  
3. Test with pure services for isolated functionality
4. Use orchestrator context for state access

The new architecture provides **all functionality** of the legacy system with **significant improvements** in maintainability, testability, and performance. 