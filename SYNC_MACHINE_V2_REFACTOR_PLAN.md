# Sync Machine V2 Refactoring Plan 
## Autonomous Subsystem Architecture

**Date Created**: January 2025  
**Updated**: June 2025 with direct state machine architecture - Orchestrator V1 deprecated  
**Current Problem**: `sync-machine-v2.ts` is 1,990 lines - massive bloat and coupled to the `app-init-machine`.
**Target**: Self-contained sync subsystem with clean boundaries, invoked by the `app-init-machine`.

---

## 🔍 Architectural Reality Check

### **Current Direct State Machine Architecture (June 2025)**
```
📊 Current Architecture:
├── __root.tsx - Creates and manages actors directly (no orchestrator) ✅
├── auth-machine.ts (287 lines) - Independent auth lifecycle ✅  
├── app-init-machine.ts (411 lines) - Manages startup sequence ✅
│   ├── invokes syncMachineV2 as child actor
│   └── invokes liveChangesMachine as child actor
└── sync-machine-v2.ts (1,990 lines) - BLOATED + init-dependent 🚨
```

### **Key Architectural Change: Direct Actor Management**
We've successfully eliminated the orchestrator pattern entirely. The `__root.tsx` component now creates and manages state machine actors directly using the global window pattern:

- `authMachineActor` on `(window as any).authMachineActor`
- `appInitActor` on `(window as any).appInitActor`

The hooks in `orchestrator-hooks-v2.tsx` access these global actors directly using `useSelector`, providing a clean separation between state machines and UI components.

The `app-init-machine` now manages the complete application initialization sequence and invokes child actors for sync and live changes.

### **Identified Bloat Sources**

#### 1. **sync-machine-v2.ts (1,990 lines)**
- **120+ console.log statements** scattered throughout
- **45+ event types** with complex typing
- **Mixed concerns** - state management + service coordination + logging + error handling

#### 2. **IntegrityService.ts (1,809 lines - still relevant)**
- Although not part of the sync machine itself, its complexity is a related problem that this plan addresses.
- **Single class doing too much** - validation + reset + fingerprinting + server communication.

---

## 🎯 Autonomous Subsystem Strategy

### **Development Approach: Clean Slate Implementation**
The strategy remains the same: create a new, clean `sync-machine-v3.ts` from scratch and have `app-init-machine` use it once it's ready.

### **Target Architecture: Clean Boundaries**
```
📊 New Architecture (Direct Actor Pattern):

🏗️ APP SHELL
├── __root.tsx - Direct actor creation and HMR preservation ✅
├── auth-machine.ts - Independent auth lifecycle ✅
└── app-init-machine.ts - Manages startup sequence ✅
    ├── invokes sync-machine-v3.ts as child actor →
    └── invokes live-changes-machine.ts as child actor →

🔄 SYNC SUBSYSTEM (completely autonomous)
├── sync-machine-v3.ts (500 lines) - NEW clean implementation
│   ├── SyncPersistence (clientId, LSN, baseline management)
│   ├── Service Coordination (WebSocket, Incoming, Outgoing, Integrity)
│   ├── Init Flow (load state → setup services → connect → ready)
│   └── Sends SYNC_LIVE event to parent app-init-machine
├── integrity-machine.ts (300 lines) - NEW child machine for integrity checks
└── services/ & utils/ - Refactored and focused services

🎯 UI HOOKS PATTERN
├── orchestrator-hooks-v2.tsx - Direct actor access with useSelector ✅
├── useAuth() → (window as any).authMachineActor ✅
├── useAppInit() → (window as any).appInitActor ✅
└── useSync() → sync machine child actor from app-init ✅

Total New Sync Implementation: ~2,500 lines
Clean Subsystem Boundaries: 100% ✅
Direct Actor Access Pattern: 100% ✅
```

### **Communication Pattern**
```typescript
// Direct actor coordination:
App-Init-Machine: db ready ✅ → starts sync child actor → waits for SYNC_LIVE event
Sync Machine: runs autonomously, emits SYNC_LIVE when ready for live changes
UI Components: access actors directly via global window references
```

---

## 📋 Step-by-Step Implementation Plan

### **Phase 0: Create Minimal Sync Machine V3 Shell + IntegrityService Split**
**Timeline**: 2-3 days | **Risk**: Low-Medium | **Impact**: Very High - Working foundation + biggest bloat reduction

**Strategy**: Combine minimal shell approach with most impactful refactor - splitting the massive IntegrityService. This gives immediate testability AND tackles the biggest architectural problem.

#### Step 0.1: Create Minimal Sync Machine V3 Shell (Day 1)
**Files**: Create `apps/web/src/state-machines/machines/sync-machine-v3.ts`

- [x] Create sync-machine-v3.ts with minimal shell matching v2's interface
- [x] Use exact same localStorage persistence pattern as v2 ('sync-machine-state' key)  
- [x] Import existing services (WebSocketService, IncomingChangeService, OutgoingChangeService)
- [x] Implement same context loading/saving as v2 (lines 730-741, 1296-1328)
- [x] Send SYNC_LIVE event to parent matching v2's behavior
- [x] Test shell works with simple 1.5 second delay simulation

```typescript
// Minimal shell using v2's exact patterns - REPLACES SyncPersistence class approach
export const syncMachineV3 = setup({
  actions: {
    // Same localStorage pattern as v2 (lines 730-741)
    saveOwnState: ({ context }) => {
      const SYNC_STATE_KEY = 'sync-machine-state';
      try {
        const stateToSave = {
          clientId: context.syncClientId,
          currentLSN: context.currentLSN
        };
        localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(stateToSave));
        console.log('[SyncMachineV3] 💾 Shell saved state:', stateToSave);
      } catch (error) {
        console.warn('[SyncMachineV3] Failed to save state:', error);
      }
    },
    notifyParentLive: sendParent({ type: 'SYNC_LIVE' })
  }
  // ... rest of minimal implementation
});
```

#### Step 0.2: Split IntegrityService by Responsibility (Days 2-3)
**Files**: Split the 1,809-line monolith following the refactor plan

- [x] Create `apps/web/src/sync/integrity/` directory
- [x] Extract `IntegrityValidator.ts` (~400 lines) - pure validation logic
- [x] Extract `IntegrityReset.ts` (~300 lines) - reset operations only  
- [x] Extract `FingerprintGenerator.ts` (~200 lines) - fingerprint utilities
- [x] Rewrite `IntegrityService.ts` as coordinator (~418 lines - 76% reduction!)
- [x] Test integrity operations work with split services
- [x] Verify same interface maintained for existing consumers

```typescript
// New streamlined IntegrityService coordinator (76% reduction achieved)
export class IntegrityService {
  private validator: IntegrityValidator;
  private reset: IntegrityReset;
  private fingerprinter: FingerprintGenerator;
  
  constructor(config: any, dataSource: any) {
    this.validator = new IntegrityValidator(dataSource, config);
    this.reset = new IntegrityReset(dataSource, config);
    this.fingerprinter = new FingerprintGenerator(dataSource);
  }

  // Delegate to appropriate sub-service  
  async validateIntegrity(reason?: string): Promise<IntegrityValidationResult> {
    return this.validator.validateIntegrity(reason);
  }

  async executeReset(reason: string, resetType: ResetType): Promise<IntegrityResetResult> {
    return this.reset.executeReset(reason, resetType);
  }
  
  // Keep same interface - just delegate internally
}
```

#### Step 0.3: Integration and Testing (Day 3)
**Files**: Update app-init-machine.ts and test with existing services

- [x] Update app-init-machine.ts: Change `syncMachine: syncMachineV2` to `syncMachine: syncMachineV3`
- [x] Test V3 shell works with existing WebSocketService  
- [x] Test V3 shell works with existing IncomingChangeService
- [x] Test V3 shell works with existing OutgoingChangeService
- [x] Test split IntegrityService works with V3 shell
- [x] Verify app reaches "ready" state same as V2
- [x] Test state persistence survives browser refresh
- [x] Test easy switching between V2/V3 for comparison

```typescript
// In app-init-machine.ts - updated for current direct actor pattern

export const appInitMachine = setup({
  actors: {
    // ... other actors
    syncMachine: syncMachineV3, // NEW: Use clean implementation
    liveChangesMachine, // Already using this pattern
  },
  
  actions: {
    startSync: sendTo('syncMachine', { type: 'CONNECT' }), // NEW: Send CONNECT instead of INITIALIZE_SYNC
  }
  // ...
}).createMachine({
  // Invoke child machines at root level (current pattern)
  invoke: [
    {
      id: 'syncMachine',
      src: 'syncMachine', // NEW: Use syncMachineV3
      input: ({ context }) => ({
        syncClientId: context.syncClientId,
        currentLSN: context.syncState.currentLSN,
      }),
      onDone: {
        actions: () => console.log('[AppInitMachine] Sync machine completed')
      },
      onError: {
        actions: () => console.log('[AppInitMachine] Sync machine error')
      }
    },
    // ... liveChangesMachine invoke (unchanged)
  ],
  
  states: {
    // ...
    sync: {
      entry: [
        () => console.log('[AppInitMachine] Starting sync machine'),
        'startSync' // Send CONNECT event to child sync machine
      ],
      
      on: {
        SYNC_LIVE: { // Listen for this event from sync machine
          target: 'live_changes',
          actions: [
            'markSyncReady',
            () => console.log('[AppInitMachine] Received SYNC_LIVE from sync machine')
          ]
        },
        // ... other events
      }
    },
    // ...
  }
});
```

**Success Criteria**:
- [x] New `sync-machine-v3.ts` shell works with 1.5s delay simulation
- [x] IntegrityService reduced from 1,809 to 418 lines (76% reduction)
- [x] Original `sync-machine-v2.ts` kept unchanged as reference
- [x] App reaches "ready" state with V3 same as V2
- [x] Same localStorage persistence pattern as V2  
- [x] `useSync()` hook works unchanged (same context shape)
- [x] Clear V3 logs distinguish from V2 for comparison
- [x] Easy switching between V2/V3 via single import change
- [x] Foundation ready for incremental service integration

---

### **Phase 1: Add Real Service Integration to V3 Shell** 
**Timeline**: 2-3 days | **Risk**: Medium | **Impact**: High

**Strategy**: Now that we have a working V3 shell, incrementally add real functionality comparing each piece to V2.

#### Step 1.1: Add WebSocket Connection 
**Files**: Enhance `apps/web/src/state-machines/machines/sync-machine-v3.ts`

- [x] Import and integrate existing WebSocketService (no changes to service itself)
- [x] Add WebSocket connection states to V3 (compare to V2's WS handling)
- [x] Test connection establishment and message handling
- [x] Verify WebSocket callbacks work with V3's event system
- [x] Compare WebSocket logs between V2 and V3

#### Step 1.2: Add Incoming Changes Processing
**Files**: Enhance `apps/web/src/state-machines/machines/sync-machine-v3.ts`

- [x] Integrate existing IncomingChangeService (no changes to service itself)
- [x] Add incoming changes handling states to V3 
- [x] Test message processing and data updates
- [x] Compare incoming change logs between V2 and V3
- [x] Verify change application works correctly

#### Step 1.3: Add Outgoing Changes Processing  
**Files**: Enhance `apps/web/src/state-machines/machines/sync-machine-v3.ts`

- [x] Integrate existing OutgoingChangeService (no changes to service itself)
- [x] Add outgoing changes handling states to V3
- [x] Test change detection and transmission
- [x] Compare outgoing change logs between V2 and V3  
- [x] Verify change queuing and sending works correctly

#### Step 1.4: Enhanced Pre-Live Validation Process
**Files**: Continue enhancing `apps/web/src/state-machines/machines/sync-machine-v3.ts`

**Problem**: Currently V2 sends `SYNC_LIVE` immediately after sync completion without ensuring:
1. Pending outgoing changes are sent first
2. Data integrity is validated before going live

**Solution**: Add pre-live validation state between sync completion and live mode.

- [x] Add `pre_live_validation` state between sync completion and live mode
- [x] Update `INITIAL_SYNC_COMPLETE` transition to target `pre_live_validation` instead of `live_sync`
- [x] Update `CATCHUP_SYNC_COMPLETE` transition to target `pre_live_validation` instead of `live_sync`
- [x] Move `sendParent({ type: 'SYNC_LIVE' })` from sync completion to validation success only
- [x] Implement `performPreLiveValidation` actor with outgoing changes check
- [x] Use `OutgoingChangeService.getPendingChangesCount()` to check for pending changes
- [x] Use `OutgoingChangeService.sendQueuedChanges()` to send pending changes if any exist
- [x] Implement integrity validation using the new split `IntegrityService.validateIntegrity('pre-live-sync-check')` (from Step 0.2)
- [x] Add error handling for validation failures (retry/reset logic based on integrity result)
- [x] Test that `SYNC_LIVE` event is only sent after successful validation
- [x] Verify outgoing changes are sent before integrity validation runs
- [x] Test validation failure scenarios and appropriate error recovery

```typescript
// Enhanced state flow - replaces immediate SYNC_LIVE sending
states: {
  // ... existing states
  
  pre_live_validation: {
    entry: () => console.log('[SyncMachineV3] 🔍 Starting pre-live validation checks'),
    
    invoke: {
      src: 'performPreLiveValidation',
      onDone: {
        target: 'live_sync',
        actions: [
          assign({ syncPhase: 'live' }),
          sendParent({ type: 'SYNC_LIVE' }), // Only send after validation
          () => console.log('[SyncMachineV3] ✅ Pre-live validation passed')
        ]
      },
      onError: {
        target: 'error', 
        actions: 'recordError'
      }
    }
  },
  
  // Updated sync completion transitions:
  INITIAL_SYNC_COMPLETE: {
    target: 'pre_live_validation', // Changed from 'live_sync'
    actions: [
      assign({ syncPhase: 'validating' }),
      'clearInitialSyncQueue',
      // Removed: sendParent({ type: 'SYNC_LIVE' })
      'logState'
    ]
  }
}

// Pre-live validation actor implementation:
actors: {
  performPreLiveValidation: fromPromise(async ({ input }) => {
    const { context } = input;
    const services = getServices(context);
    
    // Step 1: Check and send pending outgoing changes
    const pendingCount = services.outgoingChangeService.getPendingChangesCount();
    if (pendingCount > 0) {
      console.log(`[SyncMachineV3] 📤 Sending ${pendingCount} pending changes`);
      await services.outgoingChangeService.sendQueuedChanges();
    }
    
    // Step 2: Run integrity validation (using new split IntegrityService from Step 0.2)
    const integrityResult = await services.integrityService.validateIntegrity('pre-live-sync-check');
    if (!integrityResult.isValid) {
      throw new Error(`Integrity validation failed: ${integrityResult.recommendedAction}`);
    }
    
    return { success: true };
  })
}
```

**Success Criteria**: 
- [x] V3 establishes WebSocket connections like V2
- [x] V3 processes incoming changes like V2
- [x] V3 sends outgoing changes like V2
- [x] **NEW:** V3 validates pending changes before declaring live sync ready
- [x] **NEW:** V3 runs integrity validation before sending SYNC_LIVE event
- [x] **NEW:** SYNC_LIVE event only sent after successful pre-live validation
- [x] **NEW:** Outgoing changes are sent before integrity validation runs
- [x] All existing services work unchanged with V3
- [x] Logs show clear comparison between V2 and V3 behavior
- [x] Real sync functionality working with enhanced reliability and data consistency

---

### **Phase 2: Extract Logging Infrastructure and Event Types**
**Timeline**: 1-2 days | **Risk**: Low | **Impact**: Medium

**Strategy**: Clean up logging and type organization now that V3 has real functionality.

#### Step 2.1: Create Centralized Logger (Optional Enhancement)
**Files**: Create `apps/web/src/sync/utils/SyncLogger.ts`

- [x] Create SyncLogger class to replace scattered console.log statements
- [x] Add development-aware logging levels (debug, info, warn, error)
- [x] Include state transition and lifecycle logging helpers
- [x] Optionally refactor V3 to use centralized logging (compare to V2's direct console.log)

#### Step 2.2: Extract Event Type Definitions
**Files**: Create `apps/web/src/sync/utils/EventTypes.ts`

- [x] Extract event types from V2's massive union type
- [x] Organize into ConnectionEvents, SyncPhaseEvents, IntegrityEvents, ServiceEvents
- [x] Use clean event types in V3 implementation
- [x] Maintain type safety and IntelliSense support

```typescript
// Extract the massive SyncMachineEvent union type
export type SyncMachineEvent = 
  | ConnectionEvents
  | SyncPhaseEvents  
  | IntegrityEvents
  | ServiceEvents;

export type ConnectionEvents =
  | { type: 'CONNECT'; serverUrl: string; clientId: string; currentLSN: string }
  | { type: 'WS_CONNECTED'; serverLSN: string }
  | { type: 'WS_DISCONNECTED'; reason: string }
  | { type: 'WS_ERROR'; error: Error };

export type SyncPhaseEvents = 
  | { type: 'START_INITIAL_SYNC' }
  | { type: 'START_CATCHUP_SYNC' }
  | { type: 'START_LIVE_SYNC' }
  | { type: 'INITIAL_SYNC_COMPLETE' }
  | { type: 'CATCHUP_SYNC_COMPLETE' };

export type IntegrityEvents =
  | { type: 'INTEGRITY_VALIDATE'; reason?: string }
  | { type: 'INTEGRITY_VALIDATION_COMPLETED'; result: any }
  | { type: 'INTEGRITY_RESET_REQUIRED'; reason: string };

export type ServiceEvents =
  | { type: 'SERVICE_ERROR'; service: string; error: Error }
  | { type: 'INCOMING_CHANGES_PROCESSED'; results: any[] }
  | { type: 'OUTGOING_CHANGES_SENT'; count: number };
```

#### Step 2.2: Use Clean Event Types in New Sync Machine
**Files**: Implement in `apps/web/src/state-machines/machines/sync-machine-v3.ts`

```typescript
// In new sync-machine-v3.ts - clean implementation
import { SyncMachineEvent } from '../../sync/utils/EventTypes';

export const syncMachineV3 = setup({
  types: {
    context: {} as SyncMachineContext,
    events: {} as SyncMachineEvent, // Clean typed events
  },
  // ... rest of new machine implementation
});
```

**Success Criteria**:
- [x] Event types externalized and reusable  
- [x] New sync-machine-v3.ts built with clean type organization
- [x] Original sync-machine-v2.ts unchanged for reference
- [x] Better type organization and maintainability
- [x] Centralized logging system with development-aware levels
- [x] State transition and service logging helpers
- [x] Event categorization for filtering and monitoring

---

### **Phase 3: Streamline Service Management**
**Timeline**: 2-3 days | **Risk**: Medium | **Impact**: High

Since sync machine is now autonomous, we can simplify service management without complex orchestrator coordination.

#### Step 3.1: Create Simple Service Coordinator
**Files**: Create `apps/web/src/sync/utils/ServiceCoordinator.ts`

- [x] Create ServiceCoordinator class for autonomous sync management
- [x] Remove orchestrator dependencies - everything from sync machine context only
- [x] Implement simplified service initialization pattern
- [x] Add streamlined callback setup that relays events to sync machine
- [x] Include service health monitoring and statistics
- [x] Integrate with Phase 2 logging system

#### Step 3.2: Build Service Coordination into New Sync Machine
**Files**: Implement in `apps/web/src/state-machines/machines/sync-machine-v3.ts`

- [x] Replace complex inline service management with ServiceCoordinator
- [x] Update context to use ServiceCoordinator pattern
- [x] Simplify service initialization actor to use ServiceCoordinator
- [x] Update WebSocket connection actor to work with ServiceCoordinator
- [x] Update pre-live validation actor to use ServiceCoordinator
- [x] Replace complex setupServiceCallbacks with simple delegation
- [x] Update message routing to use services from ServiceCoordinator

**Success Criteria**:
- [x] Service coordination built into new sync machine from start
- [x] No orchestrator dependencies in service management  
- [x] Clean service management architecture in sync-machine-v3.ts
- [x] Services initialized with sync machine context only
- [x] Original sync-machine-v2.ts unchanged for reference
- [x] Integrated with Phase 2 logging and event types
- [x] Autonomous operation with clean boundaries
- [x] Service health monitoring and error handling

---

### **Phase 4: Complete New Sync Machine Implementation** 
**Timeline**: 2-3 days | **Risk**: Medium | **Impact**: High

Complete the new clean sync machine implementation, incorporating all the previous optimizations.

#### Step 4.1: Finalize Autonomous Sync Machine
**Files**: Complete `apps/web/src/state-machines/machines/sync-machine-v3.ts`

```typescript
// NEW FILE: Clean implementation without orchestrator coupling
// No sendParent() calls except SYNC_READY
// No complex state synchronization actions  
// No orchestrator context dependencies
// Built from scratch with clean architecture

export const syncMachineV3 = setup({
  // Simplified actors - no orchestrator coordination
  actors: {
    loadPersistedState: fromPromise(/* ... */),
    initializeServices: fromPromise(/* ... */),
    connectWebSocket: fromPromise(/* ... */)
    // Remove complex orchestrator update actors
  },
  
  actions: {
    // Remove all orchestrator synchronization actions:
    // - updateOrchestratorLSN (removed)
    // - sendParent LSN updates (removed)  
    // - complex state mirroring (removed)
    
    // Keep only sync-specific actions:
    persistState: ({ context }) => { /* ... */ },
    updateLSN: assign(/* ... */),
    processIncomingChanges: ({ context, event }) => { /* ... */ }
  }
  
  // Much simpler state machine without orchestrator coupling
});
```

#### Step 4.2: Implement Clean Service Management
**Files**: Continue building `apps/web/src/state-machines/machines/sync-machine-v3.ts`

```typescript
// NEW: Simple context-based service management from start
export const syncMachineV3 = setup({
  types: {
    context: {} as {
      // Sync-owned state only
      clientId: string;
      currentLSN: string;
      phase: 'initial' | 'catchup' | 'live' | null;
      
      // Simple service references (no complex registry)
      services: {
        webSocket: WebSocketService | null;
        incoming: IncomingChangeService | null;
        outgoing: OutgoingChangeService | null;
        integrity: IntegrityService | null;
      } | null;
      
      // Minimal error tracking
      error: string | null;
      reconnectAttempts: number;
    }
  }
  
  // Remove complex global service management patterns
  // Use simple context-based service storage
});
```

#### Step 4.3: Implement Clean State Flow
**Files**: Complete `apps/web/src/state-machines/machines/sync-machine-v3.ts`

```typescript
// NEW: Clean state flow designed for autonomous operation
export const syncMachineV3 = setup({
  // ...
}).createMachine({
  initial: 'idle',
  
  states: {
    idle: {
      on: { INITIALIZE_SYNC: 'initializing' }
    },
    
    initializing: {
      // Simple linear flow
      initial: 'loading_state',
      states: {
        loading_state: { /* ... */ },
        setting_up_services: { /* ... */ },
        ready: { type: 'final' }
      },
      onDone: 'operational'
    },
    
    operational: {
      // Consolidated sync operation states
      initial: 'determining_sync_phase',
      states: {
        determining_sync_phase: { /* ... */ },
        syncing: {
          // Single syncing state handles initial/catchup/live
          // Reduces state complexity significantly
        },
        validating_integrity: { /* ... */ },
        resetting: { /* ... */ }
      }
    }
  }
});
```

**Success Criteria**:
- New sync-machine-v3.ts implements clean architecture (~500 lines)
- Autonomous operation with clean boundaries built from start
- Simplified state management and service coordination
- Maintains all functionality with better architecture
- Original sync-machine-v2.ts unchanged for comparison and rollback

---

### **Phase 5: Refactor IntegrityService** 
**Timeline**: 2-3 days | **Risk**: Medium | **Impact**: High

#### Step 5.1: Split IntegrityService by Responsibility
**Files**: Extract from `apps/web/src/sync/IntegrityService.ts`

```typescript
// apps/web/src/sync/integrity/IntegrityValidator.ts (400 lines)
export class IntegrityValidator {
  async validateIntegrity(params): Promise<IntegrityValidationResult> {
    // Pure validation logic only
  }
  
  async generateFingerprints(): Promise<Record<string, TableFingerprint>> {
    // Move from IntegrityService
  }
}

// apps/web/src/sync/integrity/IntegrityReset.ts (300 lines)  
export class IntegrityReset {
  async executeReset(reason: string, resetType): Promise<IntegrityResetResult> {
    // Pure reset operations only
  }
  
  async clearDomainData(): Promise<void> {
    // Move from IntegrityService
  }
}

// apps/web/src/sync/integrity/FingerprintGenerator.ts (200 lines)
export class FingerprintGenerator {
  async generateTableFingerprint(table: string): Promise<TableFingerprint> {
    // Pure fingerprint utilities only
  }
}
```

#### Step 5.2: Create Simplified IntegrityService
**Files**: Rewrite `apps/web/src/sync/IntegrityService.ts`

```typescript
// New streamlined IntegrityService (400 lines - 78% reduction)
export class IntegrityService {
  private validator: IntegrityValidator;
  private reset: IntegrityReset;
  private fingerprinter: FingerprintGenerator;
  
  constructor(config, dataSource) {
    this.validator = new IntegrityValidator(config, dataSource);
    this.reset = new IntegrityReset(config, dataSource);
    this.fingerprinter = new FingerprintGenerator(dataSource);
  }

  // Delegate to appropriate sub-service
  async validateIntegrity(reason): Promise<IntegrityValidationResult> {
    return this.validator.validateIntegrity(reason);
  }

  async executeReset(reason, resetType): Promise<IntegrityResetResult> {
    return this.reset.executeReset(reason, resetType);
  }
}
```

**Success Criteria**:
- IntegrityService.ts reduces from 1,809 lines to ~400 lines (78% reduction)
- Clear separation of validation, reset, and fingerprint logic
- Each sub-service under 400 lines
- Easier testing and maintenance

---

### **Phase 6: Update Hooks and Integration**
**Timeline**: 1-2 days | **Risk**: Low | **Impact**: Medium

The new V2 architecture provides a clear pattern for this. We will create hooks that access the sync machine actor directly, just as `useAuth` accesses the `authMachine` actor.

#### Step 6.1: Access Sync Machine Actor from App Init
**Files**: Update `apps/web/src/state-machines/orchestrator-hooks-v2.tsx`

```typescript
// In orchestrator-hooks-v2.tsx - following current direct access pattern

export function useSync() {
  // Get sync machine from app init machine's children (current pattern)
  const syncMachine = useMemo(() => {
    const appInitActor = (window as any).appInitActor;
    if (!appInitActor) return null;
    
    const appInitSnapshot = appInitActor.getSnapshot();
    return appInitSnapshot?.children?.syncMachine; // Access child actor
  }, []);

  // Safety check: return default state if sync machine not available
  if (!syncMachine) {
    return { /* return a default/loading state */ };
  }

  // Subscribe to sync machine state changes
  const syncSnapshot = useSelector(syncMachine, (state) => state);
  
  // Return clean UI state from sync machine context
  return {
    phase: syncSnapshot?.context?.phase,
    currentLSN: syncSnapshot?.context?.currentLSN,
    isConnected: syncSnapshot?.matches('operational'),
    // ... and so on
  };
}
```

Note: This follows the exact same pattern already implemented in the current `useSync()` hook.

#### Step 6.2: Verify Current Hook Pattern Works with New Sync Machine
**Files**: Verify `apps/web/src/state-machines/orchestrator-hooks-v2.tsx`

The current `useSync()` hook already implements the correct pattern:

```typescript
// Current implementation (lines 298-382) already follows best practices:
export function useSync() {
  // Get sync machine from app init machine's children
  const syncMachine = useMemo(() => {
    const appInitActor = (window as any).appInitActor;
    if (!appInitActor) return null;
    
    const appInitSnapshot = appInitActor.getSnapshot();
    return appInitSnapshot?.children?.syncMachine;
  }, []);

  // Subscribe to sync machine state changes  
  const syncSnapshot = useSelector(syncMachine, (state) => state);

  // Returns comprehensive sync state for UI components
  return {
    clientId: context.clientId,
    currentLSN: context.currentLSN,
    syncPhase: context.syncPhase,
    isConnected,
    // ... complete sync state
  };
}
```

**Action Required**: Simply update the `syncMachine` actor reference to use `syncMachineV3` instead of `syncMachineV2` when ready.

#### Step 6.3: Update Components to Use Direct Sync Hooks
This step remains the same: find all components using old sync hooks and update them to use the new `useSync` hook.

**Success Criteria**:
- All sync-related UI components get their state directly from the sync machine child actor.
- The `app-init-machine` only needs to coordinate the sync machine lifecycle, not pass detailed state.
- No changes needed to existing hook consumers - the interface remains the same.

---

### **Phase 7: Remove Sync State from App-Init Machine**
**Timeline**: 1 day | **Risk**: Low | **Impact**: Medium

The final cleanup step to achieve full separation.

#### Step 7.1: Finalize App-Init-Machine Integration
**Files**: Update `apps/web/src/state-machines/machines/app-init-machine.ts`

```typescript
// In app-init-machine.ts context - remove detailed sync state
export interface AppInitContext {
  // Database state
  isDatabaseInitialized: boolean;
  databaseError: string | null;
  
  // Connection state
  isOnline: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  
  // Simplified sync coordination (keep only what's needed for startup sequence)
  isSyncReady: boolean;
  syncError: string | null;
  liveChangesStatus: 'idle' | 'connecting' | 'connected' | 'error';
  
  // REMOVE all detailed sync state that's now managed by sync-machine-v3:
  // syncClientId: string; ❌ (move to sync machine)
  // syncState: { ... } ❌ (move to sync machine)  
  // integrityBaseline: { ... } ❌ (move to sync machine)
  
  // Timing
  initStartTime: number;
  lastActivity: number;
}
```

#### Step 7.2: Verify Clean Architecture
**Note**: There is no longer an `orchestrator-v2.ts` to clean up - we've successfully eliminated the orchestrator pattern entirely.

The architecture now has clean boundaries:
- `auth-machine.ts` - Independent auth lifecycle
- `app-init-machine.ts` - Startup sequence coordination only
- `sync-machine-v3.ts` - Autonomous sync subsystem with own state
- `orchestrator-hooks-v2.tsx` - Direct actor access for UI

**Success Criteria**:
- The `app-init-machine`'s context contains only coordination state, not detailed sync state.
- All detailed sync state is owned and managed exclusively by `sync-machine-v3`.
- The architecture achieves full decoupling and autonomous operation.
---

## 🚨 Risk Mitigation & Success Metrics (Unchanged)
The risk mitigation, testing strategy, and success metrics from the original plan are still fully applicable.

---

## 🎯 Summary: From Coupled Bloat to Autonomous Architecture

### **Before: Problematic Coupling**
```
❌ app-init-machine tightly coupled with a monolithic sync-machine-v2
❌ 1,990-line sync machine is hard to test and maintain
❌ Complex orchestrator pattern with unnecessary indirection
```

### **After: Clean Direct Actor Architecture**
```
✅ Direct actor creation and management in __root.tsx with HMR preservation
✅ app-init-machine invokes autonomous sync-machine-v3 as child actor
✅ sync-machine-v3 manages its own state, services, and persistence
✅ UI components access actors directly via global window references
✅ Clean hook pattern with useSelector for precise subscriptions
✅ 500-line focused sync machine (75% reduction)
✅ Clear subsystem boundaries and autonomous operation
```

### **Key Architectural Insight**
We've successfully eliminated the orchestrator pattern entirely. The new direct actor management approach provides cleaner boundaries, better testability, and HMR preservation while maintaining the same UI hook interfaces. By creating an autonomous sync machine with its own persistence layer from scratch, we achieve significant bloat reduction and much cleaner architecture while keeping the original as a safety net.

### **Migration Strategy**
```
🔄 SAFE MIGRATION APPROACH:
1. Keep sync-machine-v2.ts unchanged (reference)
2. Build sync-machine-v3.ts from scratch with clean architecture  
3. Create new supporting files (integrity-machine.ts, utilities)
4. Update app-init-machine.ts to use syncMachineV3 as child actor
5. Test thoroughly with easy rollback to v2
6. Remove v2 only after v3 proven in production

Key Benefits of Current Architecture:
✅ Direct actor access eliminates orchestrator complexity
✅ HMR preservation maintains development experience
✅ Child actor pattern provides clean lifecycle management
✅ Global window references enable simple hook implementation
✅ useSelector provides surgical UI updates
```

---

**Total Estimated Timeline**: 8-12 days  
**Team Members Required**: 1-2 developers  
**Recommended Approach**: Start with Phase 0 (autonomous architecture) as foundation, then incremental cleanup phases 