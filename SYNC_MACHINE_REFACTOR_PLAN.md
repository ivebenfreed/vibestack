# Sync Machine & System Refactor Plan

## Current State Analysis

### Existing Sync Machine (`sync-machine.ts`)
- **States**: `idle` → `syncing` → `live` | `error`
- **Context**: Tracks LSN, client ID, sync progress, phase info
- **Events**: Basic sync events (`START_SYNC`, `SYNC_ERROR`, etc.)
- **Actions**: Handles phase changes, progress updates, parent notifications
- **Actors**: Single `runSync` actor that bridges to `SyncManager`

### Integrity Validation/Reset (Already Modularized)
- **integrity-machine.ts**: XState machine for integrity validation/reset, with clear states, context, and async actors.
- **IntegrityManager.ts**: Modular service for validation/reset logic, invoked by the machine.
- **No refactor needed for integrity validation/reset.**

### Current Limitations (Sync/Connection)
1. Too much logic in `SyncManager` and other services
2. Custom event emitters for coordination
3. Limited error handling and recovery states
4. No explicit modeling of connection, sync progress, or error recovery in state machines
5. Connection management mixed with sync logic

## Refactor Goals

1. **Enhanced State Machine(s)**
   - Model all sync and connection phases explicitly
   - Handle all error cases and recovery
   - Track detailed progress in machine context
   - Keep integrity validation/reset as-is

2. **Modular Services**
   - Move coordination from services to state machine(s)
   - Services focus on their core responsibilities
   - Clear interfaces between machine(s) and services

## Detailed Machine Structure (Sync/Connection)

### States
```typescript
type SyncMachineState = {
  states: {
    disconnected: {},
    connecting: {},
    connected: {
      states: {
        idle: {},
        initializing: {
          states: {
            preparing: {},
            loadingTables: {},
            validatingSchema: {}
          }
        },
        syncing: {
          states: {
            initial: {
              states: {
                preparing: {},
                processingTable: {},
                validatingTable: {},
                completingTable: {}
              }
            },
            catchup: {
              states: {
                preparing: {},
                processingBatch: {},
                validatingBatch: {},
                completingPhase: {}
              }
            },
            live: {
              states: {
                active: {},
                paused: {},
                validating: {}
              }
            }
          }
        },
        error: {
          states: {
            retryable: {},
            fatal: {}
          }
        },
        resetting: {
          states: {
            preparing: {},
            clearing: {},
            reinitializing: {}
          }
        }
      }
    }
  }
}
```

### Context
```typescript
interface SyncContext {
  // Connection
  connectionAttempts: number;
  lastConnectTime: number | null;
  
  // Client/Server Info
  clientId: string | null;
  currentLSN: string;
  serverLSN: string | null;
  
  // Sync Progress
  syncPhase: 'initial' | 'catchup' | 'live' | null;
  syncProgress: number;
  lastSyncTime: number | null;
  error: string | null;
  
  // Initial Sync
  initialSync: {
    tables: string[];
    currentTable: string | null;
    tableProgress: number;
    completedTables: number;
    totalTables: number;
  };
  
  // Catchup Sync
  catchupSync: {
    batchSize: number;
    currentBatch: number;
    totalBatches: number;
    batchProgress: number;
    estimatedRemaining: number;
  };
  
  // Live Sync
  liveSync: {
    messagesProcessed: number;
    lastMessageTime: number | null;
    throughputPerSec: number;
    isPaused: boolean;
  };
}
```

### Events
```typescript
type SyncEvent =
  // Connection Events
  | { type: 'CONNECT' }
  | { type: 'DISCONNECT' }
  | { type: 'CONNECTION_ESTABLISHED' }
  | { type: 'CONNECTION_LOST'; reason: string }
  
  // Sync Control Events
  | { type: 'START_SYNC'; clientId: string; lsn: string }
  | { type: 'PAUSE_SYNC' }
  | { type: 'RESUME_SYNC' }
  | { type: 'RESET_SYNC'; reason: string }
  
  // Progress Events
  | { type: 'INITIAL_SYNC_PROGRESS'; table: string; completed: number; total: number }
  | { type: 'CATCHUP_SYNC_PROGRESS'; batch: number; completed: number; total: number }
  | { type: 'LIVE_SYNC_MESSAGE'; count: number; throughput: number }
  
  // Phase Transitions
  | { type: 'PHASE_COMPLETE'; phase: 'initial' | 'catchup' }
  | { type: 'ENTER_LIVE_PHASE' }
  
  // LSN Events
  | { type: 'LSN_UPDATE'; lsn: string }
  | { type: 'LSN_DRIFT_DETECTED'; clientLSN: string; serverLSN: string }
  
  // Error Events
  | { type: 'SYNC_ERROR'; error: string; isRetryable: boolean }
  | { type: 'RETRY' };
```

### Actors
```typescript
const actors = {
  // Connection Management
  connectionManager: fromPromise(async ({ input }) => {
    // Handle WebSocket connection
  }),
  
  // Sync Processing
  initialSync: fromPromise(async ({ input }) => {
    // Handle initial table sync
  }),
  
  catchupSync: fromPromise(async ({ input }) => {
    // Handle catchup sync
  }),
  
  liveSync: fromPromise(async ({ input }) => {
    // Handle live sync
  })
};
```

## Service Refactoring (Sync/Connection Only)

### 1. SyncManager
- Remove event emitter for coordination
- Implement actor interfaces
- Focus on service coordination

### 2. WebSocketConnector
- Remove event emitter for coordination
- Implement connection actor interface
- Focus on WebSocket management

### 3. IncomingChangeProcessor
- Remove event emitter for coordination
- Implement sync actor interfaces
- Focus on change application

### 4. OutgoingChangeProcessor
- Remove event emitter for coordination
- Implement sync actor interfaces
- Focus on change sending

## Implementation Steps

1. **Phase 1: Enhanced State Machine(s)**
   - Implement new state structure for sync/connection
   - Add comprehensive context
   - Define all events
   - Create actor shells

2. **Phase 2: Service Adaptation**
   - Update each service to remove event emitter for coordination
   - Implement actor interfaces
   - Add proper error handling

3. **Phase 3: Connection Management**
   - Separate connection logic
   - Implement connection actor
   - Handle reconnection properly

4. **Phase 4: Sync Processing**
   - Implement sync actors
   - Handle all sync phases
   - Track detailed progress

5. **Phase 5: Testing & Validation**
   - Unit tests for state machine(s)
   - Integration tests for services
   - End-to-end sync testing

## Migration Strategy

1. **Incremental Adoption**
   - Start with one phase (e.g., initial sync)
   - Gradually add more states/events
   - Keep old system as fallback

2. **Parallel Implementation**
   - Build new system alongside old
   - Test thoroughly
   - Switch over when ready

3. **Feature Parity**
   - Ensure all current features work
   - Add new capabilities
   - Improve error handling

## Success Criteria

1. All sync/connection coordination in state machine(s)
2. No custom event emitters for coordination
3. Clear service boundaries
4. Comprehensive error handling
5. Observable sync state
6. Testable components

## Timeline

1. **Week 1**: Enhanced state machine(s)
2. **Week 2**: Service adaptation
3. **Week 3**: Connection management
4. **Week 4**: Sync processing
5. **Week 5**: Testing & validation

## Next Steps

1. Review and approve plan
2. Set up development environment
3. Begin Phase 1 implementation
4. Regular progress reviews
5. Continuous testing
6. Gradual rollout 