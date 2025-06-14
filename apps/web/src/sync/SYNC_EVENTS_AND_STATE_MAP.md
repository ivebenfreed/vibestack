# Sync Events and State Management Map

This document provides a comprehensive mapping of all sync events and state management patterns in the current system to ensure nothing is missed during the architecture refactor.

## 📊 Overview

The current system has **multiple overlapping event systems**:
- **SyncEventEmitter** (internal sync events)
- **XState machines** (state management with sendParent/sendTo)
- **Window CustomEvents** (cross-component communication)
- **Network events** (WebSocket, online/offline)
- **Storage events** (persistence triggers)

## 🔥 Event Categories

### 1. WebSocket & Connection Events

#### **WebSocketConnector**
```typescript
// Emitted Events
'heartbeat:timeout' -> { missedCount: number, lastPongReceived: number }
'heartbeat:connection_lost' -> { missedCount: number, lastPongReceived: number }
'heartbeat:response' -> { responseTime: number, wasRecovery: boolean }
'heartbeat:lsn_drift_detected' -> { clientLSN: string, serverLSN: string }
'heartbeat:error' -> void
'connection:lost' -> { reason: string }
'connection:status' -> boolean (true/false)
'connection:connecting' -> void
'websocket:open' -> Event
'websocket:close' -> Event
'websocket:error' -> Event
'websocket:message' -> string
'websocket:maxReconnectAttempts' -> void
'network:offline' -> void

// Listened Events
'websocket:message' -> (handleHeartbeatMessage)

// Window Events
window.addEventListener('online')
window.addEventListener('offline')
document.addEventListener('visibilitychange')
```

#### **ConnectionMachine (XState)**
```typescript
// Window Events
window.addEventListener('online')
window.addEventListener('offline')

// Internal Events
GO_ONLINE, GO_OFFLINE, CONNECTION_RETRY, CONNECTION_SUCCESS, CONNECTION_FAILED
```

### 2. Sync State & Progress Events

#### **SyncManager** 
```typescript
// Emitted Events
'sync:statusChanged' -> SyncStatus
'stateChange' -> SyncStatus
'pendingChangesUpdate' -> number
'sync:connection_degraded' -> { reason: string, missedHeartbeats: number }
'sync:connection_lost' -> { reason: string, missedHeartbeats: number }
'sync:connection_recovered' -> void
'sync:lsn_drift_detected' -> { clientLSN: string, serverLSN: string }
'sync:error' -> { type: string, message: string, error?: any }
'sync:initialized' -> { clientId: string, lsn: string }
'sync:stateReset' -> { clientId: string, lsn: string }

// Listened Events
'websocket:status' -> (status: 'connected' | 'disconnected' | 'connecting' | 'error')
'outgoing:pendingCountChanged' -> (count: number)
'sync:error' -> (errorData)
'syncStatePersister:stateUpdated' -> (newState)
'heartbeat:timeout' -> (data)
'heartbeat:connection_lost' -> (data)
'heartbeat:response' -> (data)
'heartbeat:lsn_drift_detected' -> (data)
'heartbeat:error' -> void
'sync:reconnect_requested' -> ({ reason: string, newLSN: string })
'sync:statusChanged' -> (status: string)

// XState Notifications
SYNC_STATUS_CHANGED -> orchestratorActor
LSN_UPDATE -> orchestratorActor
LSN_DRIFT_DETECTED -> orchestratorActor
CONNECTION_RECOVERED -> orchestratorActor
```

#### **SyncMachine (XState)**
```typescript
// Events Handled
START_SYNC, SYNC_CONNECTED, INITIAL_SYNC_COMPLETE, CATCHUP_COMPLETE
SYNC_TO_LIVE, SYNC_PROGRESS, SYNC_FAILED, SYNC_RESET
LSN_UPDATE, SYNC_ERROR, INTEGRITY_RESET_START
SYNC_PHASE_CHANGED, INITIAL_SYNC_PROGRESS, CATCHUP_SYNC_PROGRESS

// Events Sent to Parent
sendParent(event) -> Forwards events to orchestrator
SYNC_LIVE -> Notifies orchestrator of live mode

// State Changes
idle -> connecting -> syncing -> live -> error/resetting
```

### 3. Message Processing Events

#### **SyncMessageHandler**
```typescript
// Emitted Events
'heartbeat:server_response' -> ServerMessage
'server_message:srv_changes_received' -> ServerMessage
'server_message:srv_changes_applied' -> ServerMessage
'server_message:srv_error' -> ServerMessage
'stateChange' -> SyncState
'sync:statusChanged' -> SyncState
'lsnUpdate' -> string
'sync:message' -> SyncEventData
'process_all_outgoing_changes' -> { reason: string }
'sync_stats' -> ServerMessage
'server_message:srv_integrity_validation_response' -> ServerMessage

// Listened Events
'websocket:message' -> (handleRawMessage)
```

#### **IncomingChangeProcessor**
```typescript
// Emitted Events
'incoming_changes_processed' -> { changesCount: number, reason?: string }
'optimistic_update_discarded' -> { changeId: string, reason: string }
'optimistic_updates_cleared' -> { count: number }
'initial_sync_mode_ended' -> { timestamp: number }
```

#### **OutgoingChangeProcessor**
```typescript
// Emitted Events
'local_change_tracked' -> { changeId: string, table: string, operation: string, entityId: string }
'pending_outgoing_changes_count_updated' -> number
'outgoing_changes_payload_sent' -> { changesCount: number, payload: any }
'outgoing_change_failed_on_server' -> { id: string, error: any }
'outgoing_changes_processed_locally' -> { changeIds: string[], reason: string }
'all_unprocessed_outgoing_changes_cleared' -> void

// Listened Events
'websocket:status' -> (status)
'process_all_outgoing_changes' -> void
'server_message:srv_changes_received' -> (message)
'server_message:srv_changes_applied' -> (message)
'server_message:srv_error' -> (message)
```

### 4. Integrity & Validation Events

#### **IntegrityManager**
```typescript
// Emitted Events
'integrity:validation_error' -> { reason: string, error: any }
'integrity:reset_completed' -> { reason: string, duration: number }
'integrity:reset_error' -> { reason: string, error: any }
'integrity:server_reset_completed' -> { reason: string }
'integrity:validation_response' -> ValidationResponse

// Listened Events
'server_message:srv_integrity_reset' -> (handleServerResetCommand)
'server_message:srv_integrity_validation_response' -> (handleValidationResponse)
'integrity:validation_response' -> (handleResponse) [temporary listeners]

// Window Events
window.dispatchEvent(CustomEvent) -> For UI notifications
```

#### **IntegrityMachine (XState)**
```typescript
// Events Handled
VALIDATE, VALIDATION_SUCCESS, VALIDATION_ERROR
RESET_START, RESET_PROGRESS, RESET_ERROR
LSN_DRIFT_DETECTED, TIME_GAP_DETECTED, UPDATE_LSN, UPDATE_SYNC_TIME

// Events Sent to Parent
sendParent('INTEGRITY_RESET_COMPLETED')
sendParent('INTEGRITY_VALIDATION_SUCCESS')
```

### 5. LSN Management Events

#### **LSNManager**
```typescript
// Emitted Events
'lsn:updated' -> { oldLSN: string, newLSN: string, source: string }
```

### 6. Live Changes Events

#### **LiveChangesMachine (XState)**
```typescript
// Events Handled
START, STOP, PAUSE, RESUME, PROCESSING_COMPLETE, ERROR

// Events Sent to Parent
sendParent('LIVE_CHANGES_ACTIVE')
sendParent('LIVE_CHANGES_INACTIVE')
sendParent('LIVE_CHANGES_ERROR')
```

### 7. Window CustomEvents (Cross-Component Communication)

#### **Orchestrator**
```typescript
// Dispatched Events
'auth:state-changed' -> { detail: { authenticated: boolean, user?: UserInfo } }
'app:ready' -> void
'database:check' -> void

// Listened Events
'database:ready' -> (event: CustomEvent)
'database:error' -> (event: CustomEvent)
```

#### **Auth System**
```typescript
// Dispatched Events
'auth:signin' -> void
'auth:signout' -> void
'auth:state-changed' -> { detail: { authenticated: boolean, user?: UserInfo } }
```

#### **SyncContext**
```typescript
// Dispatched Events
'sync:start' -> { detail: { syncId: string } }
'sync:error' -> { detail: { error: any } }
'sync:live' -> { detail: { status: string } }

// Listened Events
'sync:start' -> (handleSyncStart)
```

#### **Projects Context**
```typescript
// Dispatched Events
'project-created' -> { detail: { project: Project } }
'project-updated' -> { detail: { project: Project } }
'project-deleted' -> { detail: { projectId: string } }
```

#### **App State Actions**
```typescript
// Dispatched Events
'app:enable-live-changes' -> void
'app:disable-live-changes' -> void
'app:ready' -> void
'app:not-ready' -> void
'app:initial-sync-start' -> void
'app:initial-sync-complete' -> void
'app:catchup-sync-start' -> void
'app:catchup-sync-complete' -> void
'app:live-sync-ready' -> void
```

### 8. Storage & Persistence Events

#### **SyncStatePersister**
```typescript
// Emitted Events (commented out in current code)
// 'syncStatePersister:stateReset' -> ISyncStateData
```

#### **Orchestrator State Persistence**
```typescript
// Storage Operations
localStorage.setItem('orchestrator-state') -> Snapshot
localStorage.getItem('orchestrator-state') -> Snapshot | null
localStorage.removeItem('orchestrator-state') -> void
```

## 🔄 State Management Patterns

### 1. XState Context Updates

#### **Orchestrator Context**
```typescript
interface OrchestratorContext {
  // Auth state
  user: UserInfo | null
  authToken: string | null
  authError: string | null
  
  // System state
  isDatabaseInitialized: boolean
  databaseError: string | null
  isOnline: boolean
  
  // Sync state
  isSyncLive: boolean
  liveChangesActive: boolean
  syncClientId: string
  syncPendingChangesCount: number
  syncLastSyncTime: Date | null
  
  // Detailed sync state (from sync machine)
  syncState: {
    phase: 'initial' | 'catchup' | 'live' | null
    progress: number
    currentLSN: string
    error: string | null
    machineState: string
    phaseProgress: {
      initial: { completed: number; total: number; currentTable: string | null }
      catchup: { completed: number; total: number; currentBatch: number }
      live: { messagesProcessed: number; throughputPerSec: number }
    }
  }
  
  // System coordination
  isSystemReady: boolean
  startupTime: number
  lastActivity: number
}
```

#### **SyncMachine Context**
```typescript
interface SyncMachineContext {
  clientId: string | null
  currentLSN: string
  syncProgress: number
  syncPhase: 'initial' | 'catchup' | 'live'
  error: string | null
  syncPhaseProgress: {
    initial: { completed: number; total: number; tables: string[]; currentTable: string | null }
    catchup: { completed: number; total: number; batches: number; currentBatch: number }
    live: { messagesProcessed: number; lastActivity: number; throughputPerSec: number }
  }
}
```

### 2. Event-Driven State Updates

#### **Assign Actions (XState)**
```typescript
// Orchestrator
storeAuthSuccess, storeAuthError, clearAuth
updateSyncPendingCount, updateSyncLastSyncTime, resetSyncClientId

// SyncMachine  
setSyncPhase, resetSyncState, updateInitialSyncProgress
updateCatchupSyncProgress, updateLiveSyncActivity, updateLSN

// IntegrityMachine
startValidation, completeValidation, setValidationError
startReset, updateResetProgress, completeReset, setResetError

// LiveChangesMachine
initialize, markActive, markInactive, pause, resume
recordChange, updateThroughput, storeError, reset
```

### 3. State Synchronization Patterns

#### **Machine Communication**
```typescript
// Parent -> Child (sendTo)
sendTo('syncMachine', { type: 'START_SYNC' })
sendTo('liveChangesMachine', { type: 'START' })
sendTo('integrityMachine', { type: 'VALIDATE' })

// Child -> Parent (sendParent)
sendParent({ type: 'SYNC_LIVE' })
sendParent({ type: 'LIVE_CHANGES_ACTIVE' })
sendParent({ type: 'INTEGRITY_RESET_COMPLETED' })
```

#### **Context Snapshots**
```typescript
// Orchestrator syncs child machine context via onSnapshot
onSnapshot: {
  actions: assign({
    syncState: ({ event }) => {
      const context = event.snapshot.context
      return {
        phase: context.syncPhase,
        progress: context.syncProgress,
        currentLSN: context.currentLSN,
        // ... more fields
      }
    }
  })
}
```

## 🚨 Current Problems Identified

### 1. **Multiple Sources of Truth**
- LSN tracked in: LSNManager, SyncMachine context, Orchestrator context, IndexedDBSyncStore
- Sync state in: SyncManager, SyncMachine, Orchestrator context
- Pending changes count in: OutgoingChangeProcessor, Orchestrator context

### 2. **Circular Event Dependencies**
- SyncManager -> XState -> SyncMachine -> SyncManager
- Events bouncing between systems causing potential loops

### 3. **Event System Fragmentation**
- SyncEventEmitter for internal sync events
- XState events for machine communication  
- Window CustomEvents for UI coordination
- Direct method calls for some coordination

### 4. **State Synchronization Complexity**
- Manual context syncing via onSnapshot
- Event forwarding between systems
- Timing dependencies during initialization

### 5. **Testing & Debugging Challenges**
- Events scattered across multiple systems
- State hunting required across multiple contexts
- Complex setup for comprehensive testing

## 🎯 Refactor Target State

The comprehensive mapping reveals that our refactor plan correctly identifies the key issues. The target architecture should:

1. **Single Source of Truth**: All sync state in orchestrator context
2. **Unidirectional Data Flow**: Pure services report to orchestrator via events
3. **Simplified Event System**: XState events only, eliminate SyncEventEmitter
4. **Clean Service Interfaces**: Pure functions with no state management
5. **Centralized Coordination**: Orchestrator manages all sync coordination

This mapping ensures we capture all current functionality during the migration to the cleaner architecture. 