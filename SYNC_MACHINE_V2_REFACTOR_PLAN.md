# Sync Machine V2 Refactoring Plan 
## Autonomous Subsystem Architecture

**Date Created**: January 2025  
**Updated**: January 2025 with architectural clarity  
**Current Problem**: sync-machine-v2.ts is 1,930 lines - massive bloat + incorrect orchestrator coupling  
**Target**: Self-contained sync subsystem with clean orchestrator boundaries

---

## 🔍 Architectural Reality Check

### **Current Problematic State**
```
📊 Current (Incorrect) Architecture:
├── orchestrator.ts (1,200+ lines) - Acting as sync's external storage 🚨
├── sync-machine-v2.ts (1,930 lines) - BLOATED + orchestrator-dependent 🚨
├── WebSocketService.ts (263 lines) - Well-sized ✅
├── IncomingChangeService.ts (489 lines) - Well-sized ✅
├── OutgoingChangeService.ts (808 lines) - Acceptable size ⚠️ 
└── IntegrityService.ts (1,809 lines) - BLOATED service 🚨

❌ Problem: Orchestrator manages sync state (clientId, LSN, baseline)
❌ Problem: Complex sendParent() coordination between machines
❌ Problem: Duplicate state tracking and synchronization
❌ Problem: Sync machine cannot operate independently
```

### **Key Insight: Orchestrator ≠ Sync Orchestrator**
```typescript
// What orchestrator ACTUALLY does:
✅ Session Management (auth, persistent clientId)  
✅ App Lifecycle (database init, system readiness)
✅ UI State Coordination (high-level status for components)

// What orchestrator should NOT do:
❌ Sync State Management (LSN, phase, progress)
❌ Service Lifecycle Management  
❌ Change Processing Coordination
❌ Acting as sync machine's external storage
```

### **Identified Bloat Sources**

#### 1. **sync-machine-v2.ts (1,930 lines)**
- **120+ console.log statements** scattered throughout
- **45+ event types** with complex typing
- **Complex service management** with global registry pattern
- **Massive action arrays** (50+ complex action chains)
- **Mixed concerns** - state management + service coordination + logging + error handling

#### 2. **IntegrityService.ts (1,809 lines)**
- **Single class doing too much** - validation + reset + fingerprinting + server communication
- **Complex baseline management** mixed with core validation
- **Heavy server integration** within service class
- **Extensive logging pollution**

---

## 🎯 Autonomous Subsystem Strategy

### **Development Approach: Clean Slate Implementation**
```
🔄 REFACTORING STRATEGY:
├── Keep sync-machine-v2.ts as reference (unchanged)
├── Create new files from scratch with clean architecture
├── Migrate incrementally once new architecture proven
└── Easy rollback if issues discovered

📂 File Structure:
├── Reference (keep unchanged):
│   └── sync-machine-v2.ts (1,930 lines) - Reference implementation
└── New Implementation:
    ├── sync-machine-v3.ts (500 lines) - Clean autonomous machine
    ├── integrity-machine.ts (300 lines) - Child machine
    └── utils/ - Supporting classes
```

### **Target Architecture: Clean Boundaries**
```
📊 New Architecture (Proper Separation):

🏗️ APP SHELL (orchestrator.ts - 600 lines, 50% reduction)
├── Session Management (user, authToken, clientId generation)
├── App Lifecycle (auth → database → sync coordination) 
└── Simple Event Coordination (INITIALIZE_SYNC → SYNC_READY)

🔄 SYNC SUBSYSTEM (completely autonomous)
├── sync-machine-v3.ts (500 lines) - NEW clean implementation
│   ├── SyncPersistence (clientId, LSN, baseline management)
│   ├── Service Coordination (WebSocket, Incoming, Outgoing, Integrity) 
│   ├── Init Flow (load state → setup services → connect → ready)
│   └── Operational Flow (determine phase → sync → persist)
├── integrity-machine.ts (300 lines) - NEW child machine
├── services/ (Focused cleanup)
│   ├── WebSocketService.ts (263 lines) - Keep as-is ✅
│   ├── IncomingChangeService.ts (489 lines) - Keep as-is ✅
│   ├── OutgoingChangeService.ts (600 lines) - Minor cleanup
│   └── integrity/
│       ├── IntegrityValidator.ts (400 lines) - NEW pure validation
│       ├── IntegrityResetManager.ts (300 lines) - NEW reset operations  
│       └── FingerprintGenerator.ts (200 lines) - NEW utilities
└── utils/
    ├── SyncLogger.ts (100 lines) - NEW centralized logging
    └── SyncPersistence.ts (150 lines) - NEW state management

Total New Implementation: ~2,500 lines
Reference Implementation: 1,930 lines (kept for comparison)
Net Reduction: 50% when reference removed
Clean Subsystem Boundaries: 100% ✅
```

### **Communication Pattern**
```typescript
// Simple init coordination:
Orchestrator: auth ✅ → database ✅ → INITIALIZE_SYNC → wait for SYNC_READY
Sync Machine: autonomous operation with internal persistence

// Runtime operation:  
Orchestrator: read-only status monitoring (optional)
Sync Machine: completely independent operation
```

---

## 📋 Step-by-Step Implementation Plan

### **Phase 0: Establish Autonomous Sync Architecture** 
**Timeline**: 2-3 days | **Risk**: Medium | **Impact**: Very High

This is the foundational change that enables all subsequent improvements.

#### Step 0.1: Create Self-Contained Sync Persistence
**Files**: Create `apps/web/src/sync/utils/SyncPersistence.ts`

```typescript
// Sync machine owns its complete state
export class SyncPersistence {
  private readonly STORAGE_KEY = 'vibestack_sync_state';

  async loadState(): Promise<SyncMachineContext> {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.warn('[SyncPersistence] Failed to parse stored state:', error);
      }
    }
    
    // First run - generate fresh state
    return {
      clientId: crypto.randomUUID(),
      currentLSN: '0/0',
      lastSyncTime: null,
      phase: null,
      integrityBaseline: {
        lastInitialSyncCompletedAt: null,
        recordChangesSinceBaseline: 0,
        lastFullValidationAt: null,
        maxRecordsBeforeReset: 10000
      }
    };
  }

  async saveState(context: Partial<SyncMachineContext>): Promise<void> {
    const current = await this.loadState();
    const updated = { ...current, ...context };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
  }

  async clearState(): Promise<void> {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
```

#### Step 0.2: Create New Clean Sync Machine
**Files**: Create `apps/web/src/state-machines/machines/sync-machine-v3.ts`

```typescript
// NEW FILE: Clean implementation from scratch
import { SyncPersistence } from '../../sync/utils/SyncPersistence';
import { ServiceCoordinator } from '../../sync/utils/ServiceCoordinator';

export const syncMachineV3 = setup({
  actors: {
    loadPersistedState: fromPromise(async (): Promise<SyncMachineContext> => {
      const persistence = new SyncPersistence();
      return persistence.loadState();
    }),
    
    saveState: fromPromise(async ({ input }: { 
      input: Partial<SyncMachineContext> 
    }): Promise<void> => {
      const persistence = new SyncPersistence();
      await persistence.saveState(input);
    }),

    initializeServices: fromPromise(async ({ input }) => {
      // Move existing service initialization here
      // Remove dependence on orchestrator context
      return ServiceCoordinator.initialize(input.context);
    })
  },

  actions: {
    persistState: ({ context }) => {
      // Auto-persist critical state changes
      const persistence = new SyncPersistence();
      persistence.saveState(context);
    },

    notifyOrchestrator: sendParent({ type: 'SYNC_READY' })
  }
}).createMachine({
  id: 'sync',
  initial: 'idle',
  
  states: {
    idle: {
      // Wait for orchestrator to tell us to start
      on: {
        INITIALIZE_SYNC: 'initializing'
      }
    },
    
    initializing: {
      initial: 'loading_state',
      
      states: {
        loading_state: {
          invoke: {
            src: 'loadPersistedState',
            onDone: {
              target: 'setting_up_services',
              actions: assign(({ event }) => event.output)
            },
            onError: {
              target: 'setting_up_services',
              actions: assign({
                clientId: crypto.randomUUID(),
                currentLSN: '0/0'
              })
            }
          }
        },
        
        setting_up_services: {
          invoke: {
            src: 'initializeServices', 
            input: ({ context }) => ({ context }),
            onDone: 'ready'
          }
        },
        
        ready: {
          type: 'final'
        }
      },
      
      onDone: {
        target: 'operational',
        actions: ['notifyOrchestrator']
      }
    },
    
    operational: {
      // Existing sync logic continues here
      // Remove all sendParent() calls except critical coordination
    }
  },
  
  // Auto-persist on state changes
  on: {
    LSN_UPDATE: {
      actions: ['updateLSN', 'persistState']
    }
  }
});
```

#### Step 0.3: Update Orchestrator to Use New Sync Machine
**Files**: Modify `apps/web/src/state-machines/orchestrator.ts`

```typescript
// Remove all sync state management from orchestrator
export interface OrchestratorContext {
  // ONLY app-level concerns
  user: UserInfo | null;
  authToken: string | null;
  authError: string | null;
  sessionExpiry: string | null;
  
  isDatabaseInitialized: boolean;
  databaseError: string | null;
  isOnline: boolean;
  
  // Optional: read-only sync status for UI
  isSyncReady: boolean;
  
  isSystemReady: boolean;
  startupTime: number;
  lastActivity: number;
}

export const orchestrator = setup({
  invoke: [
    {
      id: 'connectionMachine',
      src: 'connectionMachine',
      onSnapshot: {
        actions: assign({
          isOnline: ({ event }) => event.snapshot.value === 'online'
        })
      }
    },
    {
      id: 'syncMachine',
      src: 'syncMachineV3'  // NEW: Use clean implementation
      // No complex onSnapshot - sync is autonomous
    }
  ]
}).createMachine({
  states: {
    initializing: {
      initial: 'auth',
      states: {
        auth: {
          invoke: {
            src: 'checkAuth',
            onDone: [
              {
                target: 'authenticated',
                guard: ({ event }) => event.output.authenticated,
                actions: assign({
                  user: ({ event }) => event.output.user,
                  authToken: ({ event }) => event.output.token
                })
              },
              { target: 'unauthenticated' }
            ]
          }
        },
        authenticated: {
          always: 'database'
        },
        database: {
          invoke: {
            src: 'initializeDatabase',
            onDone: 'sync'
          }
        },
        sync: {
          entry: sendTo('syncMachine', { type: 'INITIALIZE_SYNC' }),
          on: {
            SYNC_READY: {
              target: 'complete',
              actions: assign({ isSyncReady: true })
            }
          }
        },
        complete: {
          type: 'final'
        }
      },
      onDone: 'ready'
    },
    
    ready: {
      // App fully operational - sync runs autonomously
      entry: assign({
        isSystemReady: true,
        lastActivity: () => Date.now()
      })
    }
  }
});
```

**Success Criteria**:
- New sync-machine-v3.ts implements clean autonomous architecture
- Original sync-machine-v2.ts kept as reference (unchanged)
- Orchestrator updated to use new sync machine
- Clean INITIALIZE_SYNC → SYNC_READY handshake
- Easy rollback to v2 if issues discovered

### **Phase 1: Extract Logging Infrastructure** 
**Timeline**: 1-2 days | **Risk**: Low | **Impact**: High

#### Step 1.1: Create Centralized Logger
**Files**: Create `apps/web/src/sync/utils/SyncLogger.ts`

```typescript
// New centralized logging utility
export class SyncLogger {
  private prefix: string;
  private debugMode: boolean;

  constructor(prefix: string, debugMode = false) {
    this.prefix = prefix;
    this.debugMode = debugMode;
  }

  debug(message: string, data?: any) {
    if (this.debugMode) console.log(`${this.prefix} 🔍 ${message}`, data);
  }

  info(message: string, data?: any) {
    console.log(`${this.prefix} ℹ️ ${message}`, data);
  }

  warn(message: string, data?: any) {
    console.warn(`${this.prefix} ⚠️ ${message}`, data);
  }

  error(message: string, error?: any) {
    console.error(`${this.prefix} ❌ ${message}`, error);
  }

  stateTransition(from: string, to: string, trigger: string) {
    console.log(`${this.prefix} 🔄 ${from} → ${to} (${trigger})`);
  }

  lifecycle(event: string, context?: any) {
    console.log(`${this.prefix} 🎯 ${event}`, context);
  }
}

// Factory for sync loggers
export const createSyncLogger = (component: string) => 
  new SyncLogger(`[${component}]`, process.env.NODE_ENV === 'development');
```

#### Step 1.2: Implement Clean Logging in New Sync Machine
**Files**: Use in `apps/web/src/state-machines/machines/sync-machine-v3.ts`

**Goal**: Build new sync machine with clean logging from start (no migration needed)

```typescript
// In new sync-machine-v3.ts - clean implementation from scratch
import { createSyncLogger } from '../../sync/utils/SyncLogger';
const logger = createSyncLogger('SyncMachineV3');

// Replace patterns like:
// OLD: console.log('[SyncMachineV2] 🔧 Initializing services...');
// NEW: logger.info('Initializing services...');

// OLD: console.log(`[SyncMachineV2] 🔄 State transition triggered by: ${event.type}`);
// NEW: logger.stateTransition(currentState, nextState, event.type);
```

**Success Criteria**: 
- New sync-machine-v3.ts built with clean logging from start
- Zero console.log/console.error in new implementation
- All logging goes through SyncLogger
- Reference sync-machine-v2.ts unchanged for comparison

---

### **Phase 2: Extract Event Type Definitions**
**Timeline**: 1 day | **Risk**: Low | **Impact**: Medium

#### Step 2.1: Create Shared Event Types
**Files**: Create `apps/web/src/sync/utils/EventTypes.ts`

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
- Event types externalized and reusable  
- New sync-machine-v3.ts built with clean type organization
- Original sync-machine-v2.ts unchanged for reference
- Better type organization and maintainability

---

### **Phase 3: Streamline Service Management**
**Timeline**: 2-3 days | **Risk**: Medium | **Impact**: High

Since sync machine is now autonomous, we can simplify service management without complex orchestrator coordination.

#### Step 3.1: Create Simple Service Coordinator
**Files**: Create `apps/web/src/sync/utils/ServiceCoordinator.ts`

```typescript
// Simplified service management for autonomous sync
export class ServiceCoordinator {
  private services: {
    webSocket: WebSocketService | null;
    incoming: IncomingChangeService | null;
    outgoing: OutgoingChangeService | null;  
    integrity: IntegrityService | null;
  } = {
    webSocket: null,
    incoming: null,
    outgoing: null,
    integrity: null
  };

  async initialize(context: SyncMachineContext): Promise<Services> {
    // Move service initialization logic here
    // No orchestrator dependencies - everything from context
    const { clientId, currentLSN } = context;
    
    // Initialize services with sync machine context only
    this.services.webSocket = new WebSocketService({
      clientId,
      lsn: currentLSN,
      serverUrl: 'ws://127.0.0.1:8787/ws'
    });
    
    // ... initialize other services
    return this.services;
  }

  setupCallbacks(eventHandler: (event: any) => void): void {
    // Simplified callback setup - just relay events to sync machine
    this.services.webSocket?.setCallbacks({
      onMessage: (msg) => eventHandler({ type: 'WS_MESSAGE', message: msg }),
      onStatusChange: (status) => eventHandler({ type: 'WS_STATUS_CHANGE', status })
    });
    
    // ... setup other service callbacks
  }

  getServices(): Services {
    return this.services;
  }

  destroy(): void {
    Object.values(this.services).forEach(service => service?.destroy?.());
  }
}
```

#### Step 3.2: Build Service Coordination into New Sync Machine
**Files**: Implement in `apps/web/src/state-machines/machines/sync-machine-v3.ts`

```typescript
// In new sync-machine-v3.ts - clean implementation
import { ServiceCoordinator } from '../../sync/utils/ServiceCoordinator';

// Single service coordinator instance
const serviceCoordinator = new ServiceCoordinator();

export const syncMachineV3 = setup({
  actors: {
    initializeServices: fromPromise(async ({ input }) => {
      return serviceCoordinator.initialize(input.context);
    })
  },
  
  actions: {
    setupServiceCallbacks: ({ self }) => {
      serviceCoordinator.setupCallbacks((event) => {
        self.send(event);
      });
    },
    
    cleanupServices: () => {
      serviceCoordinator.destroy();
    }
  }
  
  // Remove complex service management actions
  // Much simpler now that sync is autonomous
});
```

**Success Criteria**:
- Service coordination built into new sync machine from start
- No orchestrator dependencies in service management  
- Clean service management architecture in sync-machine-v3.ts
- Services initialized with sync machine context only
- Original sync-machine-v2.ts unchanged for reference

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

### **Phase 6: Update Orchestrator Hooks and Integration**
**Timeline**: 1-2 days | **Risk**: Low | **Impact**: Medium

Now that sync is autonomous, orchestrator integration becomes much simpler.

#### Step 6.1: Replace Orchestrator Sync Hooks with Direct Sync Machine Hooks
**Files**: Modify `apps/web/src/state-machines/orchestrator-hooks.tsx`

```typescript
// ❌ REMOVE: Old orchestrator-dependent sync hooks
// export function useSync() { ... }           // Remove - replace with direct sync access
// export function useSyncMachine() { ... }    // Remove - replace with direct sync access

// ✅ NEW: Direct sync machine hooks (autonomous)
export function useSyncMachine() {
  // Direct access to autonomous sync machine - no orchestrator coupling
  const syncActor = (window as any).syncActor;
  
  return useSelector(syncActor, (snapshot) => {
    if (!snapshot) return {
      // Default state when sync machine not ready
      clientId: null,
      syncPhase: null, 
      currentLSN: '0/0',
      isConnected: false,
      error: null,
      isInitialSync: false,
      isCatchupSync: false,
      isLiveSync: false,
      isError: false,
      isConnecting: false,
      isIdle: true,
      machineState: 'idle',
      syncPhaseProgress: null,
      isActive: false,
      statusText: 'Idle'
    };
    
    const context = snapshot.context;
    const state = snapshot.value;
    
    return {
      // Core sync state
      clientId: context.clientId,
      syncPhase: context.phase,
      currentLSN: context.currentLSN,
      
      // Connection status
      isConnected: context.services?.webSocket !== null,
      error: context.error,
      
      // State booleans
      isInitialSync: context.phase === 'initial',
      isCatchupSync: context.phase === 'catchup', 
      isLiveSync: context.phase === 'live',
      isError: state === 'error' || !!context.error,
      isConnecting: state === 'connecting' || state.includes?.('connecting'),
      isIdle: state === 'idle',
      
      // Machine state
      machineState: typeof state === 'string' ? state : Object.keys(state)[0],
      
      // Detailed progress (if available)
      syncPhaseProgress: context.phaseProgress,
      
      // Convenience getters
      get isActive() {
        const activeStates = ['connecting', 'operational', 'syncing'];
        const machineState = typeof state === 'string' ? state : Object.keys(state)[0];
        return activeStates.includes(machineState) || context.phase !== null;
      },
      
      get statusText() {
        if (context.error) return 'Error';
        if (state === 'connecting') return 'Connecting...';
        if (context.phase === 'initial') return 'Initial Sync';
        if (context.phase === 'catchup') return 'Catchup Sync';
        if (context.phase === 'live') return 'Live';
        return 'Idle';
      }
    };
  });
}

// ✅ NEW: Simple sync status hook for basic use cases
export function useSync() {
  const syncMachine = useSyncMachine();
  
  return {
    // Simplified sync state for basic components
    isSyncLive: syncMachine.isLiveSync,
    isWaiting: syncMachine.isConnecting,
    isSyncing: syncMachine.isActive,
    isSyncActive: syncMachine.isActive
  };
}
```

#### Step 6.2: Update Components to Use Direct Sync Hooks
**Files**: Update all components using sync-related orchestrator hooks

```bash
# Find all usages of orchestrator-based sync hooks
grep -r "useSyncMachine\|useSync" apps/web/src/ --include="*.tsx" --include="*.ts"

# Update imports in affected files:
# OLD: import { useSyncMachine } from '@/state-machines/orchestrator-hooks';
# NEW: import { useSyncMachine } from '@/state-machines/orchestrator-hooks'; // (now direct)

# Key files to update:
# - apps/web/src/features/sync/hooks/useSyncVisualizationState.ts
# - apps/web/src/features/sync/components/SyncVisualizer.tsx  
# - apps/web/src/components/debug/SyncDebugPanel.tsx
# - apps/web/src/sync/SyncService.ts
# - apps/web/src/sync/SyncManager.ts
```

#### Step 6.3: Expose Sync Machine Globally for Direct Access
**Files**: Modify `apps/web/src/state-machines/orchestrator.ts`

```typescript
// Expose sync machine globally for direct hook access
export const orchestrator = setup({
  invoke: [
    {
      id: 'syncMachine',
      src: 'syncMachineV3',  // Use new clean implementation
      onSnapshot: {
        actions: [
          // Store reference globally for direct hook access
          ({ event }) => {
            (window as any).syncActor = event.snapshot._event.origin;
          },
          // Minimal status tracking in orchestrator (only for system readiness)
          assign({
            isSyncReady: ({ event }) => event.snapshot.context.phase !== null
          })
        ]
      }
    }
  ]
  // ... rest of orchestrator
});
```

#### Step 6.4: Create Direct Sync Machine Provider (Optional)
**Files**: Create `apps/web/src/state-machines/sync-hooks.tsx`

```typescript
// Optional: Direct sync machine provider for better performance
import React, { createContext, useContext, ReactNode } from 'react';
import { useSelector } from '@xstate/react';
import type { ActorRefFrom } from 'xstate';
import type { syncMachineV2 } from './machines/sync-machine-v2';

type SyncActor = ActorRefFrom<typeof syncMachineV2>;

const SyncContext = createContext<SyncActor | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  // Get sync actor from global reference (set by orchestrator)
  const syncActor = (window as any).syncActor as SyncActor;
  
  return (
    <SyncContext.Provider value={syncActor}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncActor(): SyncActor | null {
  return useContext(SyncContext);
}

// High-performance direct sync hooks
export function useSyncMachineOptimized() {
  const actor = useSyncActor();
  
  return useSelector(actor, (snapshot) => {
    // Same implementation as orchestrator-hooks version
    // but with direct actor access (better performance)
  });
}
```

**Success Criteria**:
- All sync-related hooks access sync machine directly (no orchestrator coupling)
- Orchestrator hooks only provide app-level state (auth, database, system readiness)
- No breaking changes to existing UI components (same hook names, same return values)
- Clean separation: Orchestrator = app shell, Sync hooks = sync machine direct access
- Better performance: no orchestrator snapshot overhead for sync state reads

---

### **Phase 7: Remove Orchestrator Sync State**
**Timeline**: 1 day | **Risk**: Low | **Impact**: Medium

Final cleanup - remove all sync state management from orchestrator.

#### Step 7.1: Finalize Orchestrator Integration
**Files**: Update `apps/web/src/state-machines/orchestrator.ts`

```typescript
// Update orchestrator to use new sync machine and remove sync state
export interface OrchestratorContext {
  // App-level state only
  user: UserInfo | null;
  authToken: string | null;
  authError: string | null;
  sessionExpiry: string | null;
  
  isDatabaseInitialized: boolean;
  databaseError: string | null;
  isOnline: boolean;
  
  // Minimal sync coordination
  isSyncReady: boolean;
  
  isSystemReady: boolean;
  startupTime: number;
  lastActivity: number;
  
  // REMOVED: All sync-specific state
  // syncClientId: string; ❌
  // syncState: { ... }; ❌  
  // syncPendingChangesCount: number; ❌
  // syncLastSyncTime: Date | null; ❌
  // integrityBaseline: { ... }; ❌
}
```

#### Step 7.2: Update All Orchestrator Actions
**Files**: Continue modifying orchestrator.ts

```bash
# Remove sync state management actions:
# - updateSyncPendingCount ❌
# - updateSyncLastSyncTime ❌ 
# - resetSyncClientId ❌
# - updateIntegrityBaseline ❌
# - triggerIntegrityValidation ❌

# Keep only:
# - initializeDatabase ✅
# - checkAuth ✅
# - markSystemReady ✅
```

#### Step 7.3: Verify Complete Sync Decoupling
**Files**: Search codebase for orchestrator sync coupling

```bash
# Find any remaining sync state access via orchestrator
grep -r "syncClientId\|syncState\|syncPendingChanges" apps/web/src/

# Find any components still using orchestrator for sync data
grep -r "snapshot\.context\.sync" apps/web/src/

# Ensure all sync hooks are using direct sync machine access
grep -r "useOrchestratorActor.*sync\|orchestrator.*sync" apps/web/src/

# Update any remaining references to use direct sync machine hooks
```

#### Step 7.4: Update Sync-Related Services  
**Files**: Update `SyncService.ts`, `SyncManager.ts`, etc.

```typescript
// apps/web/src/sync/SyncService.ts - Update to use new sync machine
export class SyncService {
  public getSyncStatus(): SyncStatus {
    try {
      // ❌ OLD: Access orchestrator context
      // const snapshot = this.getOrchestratorSnapshot();
      // const syncState = snapshot.context.syncState;
      
      // ✅ NEW: Direct access to new sync machine
      const syncActor = (window as any).syncActor;  // Now points to syncMachineV3
      if (!syncActor) return 'disconnected';
      
      const snapshot = syncActor.getSnapshot();
      const context = snapshot.context;
      const state = snapshot.value;
      
      // Map sync machine state directly to SyncStatus
      if (state === 'idle' && !context.phase) return 'disconnected';
      if (state === 'connecting') return 'connecting';
      if (context.phase === 'initial') return 'initial_sync';
      if (context.phase === 'catchup') return 'catchup';
      if (context.phase === 'live') return 'live';
      if (context.error) return 'error';
      return 'disconnected';
    } catch (error) {
      return 'disconnected';
    }
  }
}
```

**Success Criteria**:
- Orchestrator updated to use new sync machine (syncMachineV3)
- All sync state access goes through new sync machine
- Clean architectural boundaries maintained
- Original sync-machine-v2.ts available for rollback if needed
- No functionality lost
- Easy migration path completed

---

## 🚨 Risk Mitigation Strategies

### **High-Risk Operations**
1. **Phase 0 (Autonomous Architecture)** - Foundation change
   - **Mitigation**: Feature branch, preserve existing functionality during transition
   - **Rollback Plan**: Keep current orchestrator sync state until proven
   - **Testing**: Verify autonomous sync maintains all current functionality

2. **Phase 4 (Machine Optimization)** - Internal state machine changes
   - **Mitigation**: Incremental refactoring, preserve external interfaces
   - **Testing**: All sync scenarios (initial, catchup, live, integrity)

3. **Phase 5 (Integrity Child Machine)** - Complex integrity refactoring  
   - **Mitigation**: Child machine pattern reduces coordination complexity vs. peer machines
   - **Rollback Plan**: Keep current IntegrityService until child machine proven
   - **Testing**: All integrity scenarios (baseline validation, progressive escalation, full reset)
   - **Key Risk**: Progressive escalation logic (resync → baseline → full reset) must work correctly

### **Testing Strategy**
```bash
# Test sync scenarios after each phase
npm run test:sync
npm run test:integrity  
npm run test:orchestrator

# Manual testing checklist:
- [ ] Initial sync from scratch
- [ ] Catchup sync after offline
- [ ] Live sync real-time updates
- [ ] Integrity validation scenarios
- [ ] Reset scenarios
- [ ] Error recovery
```

---

## 📊 Success Metrics

### **Code Quality Metrics**
- **File Size Reduction**: 74% reduction in largest file (1,930 → 500 lines sync + 300 lines integrity)
- **Total Line Reduction**: 50% overall reduction (5,100 → 2,500 lines)  
- **Orchestrator Simplification**: 50% reduction (1,200 → 600 lines)
- **IntegrityService Elimination**: 100% extraction (1,809 → 0 lines, split into focused classes)
- **Logging Cleanup**: Zero console.log statements in state machines
- **Type Organization**: Centralized event type definitions

### **Architecture Metrics**  
- **Autonomous Subsystem**: Sync machine operates completely independently
- **Clean Boundaries**: Clear separation between app shell and sync subsystem
- **Testability**: Sync machine can be tested in complete isolation
- **Maintainability**: No file over 800 lines, focused responsibilities
- **Simplified Communication**: Only 2 coordination events (INITIALIZE_SYNC, SYNC_READY)

### **Performance Metrics**
- **Bundle Size**: Reduced due to better tree-shaking
- **Runtime Performance**: Improved due to focused state machines
- **Memory Usage**: Reduced due to eliminated service duplication

---

## 🎯 Post-Refactor Maintenance

### **New Development Guidelines**
1. **Autonomous Subsystems**: Each subsystem manages its own state and persistence
2. **Clean Boundaries**: Orchestrator = app shell, Sync = data synchronization
3. **Simple Coordination**: Use event-driven init flow (INITIALIZE → READY pattern)
4. **State Ownership**: No shared state between orchestrator and sync machine
5. **Service Management**: Services owned by their respective subsystems
6. **Child Machine Pattern**: Complex subsystem concerns (like integrity) use child machines, not peer machines
7. **Progressive Complexity**: Start with single machine, split into child machines only when needed
8. **Logging**: Use SyncLogger, not console.log
9. **Testing**: Subsystems must be testable in complete isolation, child machines testable independently

### **Monitoring**
- **File Size Monitoring**: Alert if any file exceeds 600 lines
- **Performance Monitoring**: Track sync performance metrics
- **Error Monitoring**: Centralized error tracking through SyncLogger

### **Documentation Updates**
- Update architecture documentation
- Create developer onboarding guide for new sync architecture
- Document troubleshooting procedures for each machine

---

## 🎯 Summary: From Coupled Bloat to Autonomous Architecture

### **Before: Problematic Coupling**
```
❌ Orchestrator acting as sync's external storage
❌ Complex sendParent() coordination between machines  
❌ Duplicate state tracking and synchronization
❌ 1,930-line monolithic sync machine
❌ Sync machine cannot operate independently
```

### **After: Clean Autonomous Architecture**
```
✅ Orchestrator = App shell (auth, database, system coordination)
✅ Sync Machine = Self-contained subsystem with persistence
  ├── Integrity Machine = Child machine for validation/reset lifecycle
  ├── Service Classes = Focused validation, reset, fingerprint utilities
  └── Direct Hooks = useSyncMachine(), useSync() access sync directly
✅ Simple init coordination (INITIALIZE_SYNC → SYNC_READY)
✅ 500-line focused sync machine (74% reduction)
✅ 300-line integrity child machine
✅ Sync subsystem operates completely independently
✅ Clear subsystem boundaries and ownership
```

### **Key Architectural Insight**
The orchestrator was never actually orchestrating sync - it was just providing session management and acting as sync's external storage. By creating a new autonomous sync machine with its own persistence layer from scratch, we achieve significant bloat reduction and much cleaner architecture while keeping the original as a safety net.

### **Migration Strategy**
```
🔄 SAFE MIGRATION APPROACH:
1. Keep sync-machine-v2.ts unchanged (reference)
2. Build sync-machine-v3.ts from scratch with clean architecture  
3. Create new supporting files (integrity-machine.ts, utilities)
4. Update orchestrator to use v3
5. Test thoroughly with easy rollback to v2
6. Remove v2 only after v3 proven in production
```

---

**Total Estimated Timeline**: 8-12 days  
**Team Members Required**: 1-2 developers  
**Recommended Approach**: Start with Phase 0 (autonomous architecture) as foundation, then incremental cleanup phases 