# Complete Sync Message Flow Analysis

## Overview
This document maps the complete sync flow from the backup file `/home/benfreed/vibestack/apps/server/src/sync/SyncDO.ts.backup` to identify all messages that should be sent to clients at each stage.

## Connection Establishment Flow

### 1. WebSocket Connection Setup
```
Client connects → WebSocket upgrade → hibernation API setup
↓
determineSyncStrategy() → performSync()
```

**Messages Sent:**
- No immediate messages during connection setup
- Connection establishment is silent

## Sync Strategy Determination

### 2. Strategy Selection Logic
```typescript
// In determineSyncStrategy()
await this.ensureReplicationActive();
await this.stateManager.registerClient(clientId);
await this.stateManager.updateClientLSN(clientId, clientLSN);

// Get server LSN and compare with client LSN
const strategy = compareLSN(clientLSN, serverLSN) < 0 ? 
  (clientLSN === '0/0' ? SyncStrategy.INITIAL : SyncStrategy.CATCHUP) : 
  SyncStrategy.LIVE;
```

**Messages Sent:**
- No messages sent during strategy determination
- Strategy determination is internal only

## Initial Sync Flow (SyncStrategy.INITIAL)

### 3. Initial Sync Message Sequence

**State Updates:**
```typescript
await this.stateManager.updateClientSyncState(clientId, 'initial');
```

**Messages Sent:**

#### 3.1. Initial Sync Start
```typescript
const initStartMsg: ServerInitStartMessage = {
  type: 'srv_init_start',
  messageId: `srv_${Date.now()}`,
  timestamp: Date.now(),
  clientId,
  serverLSN: startLSN
};
await messageHandler.send(initStartMsg);
```

#### 3.2. Table Data Chunks (For Each Table)
```typescript
// For each table in SERVER_DOMAIN_TABLE_HIERARCHY order
const initChangesMsg: ServerInitChangesMessage = {
  type: 'srv_init_changes',
  messageId: `srv_${Date.now()}`,
  timestamp: Date.now(),
  clientId,
  changes: changes, // TableChange[]
  sequence: {
    table: tableName,
    chunk: chunkNum,
    total: totalProcessed
  }
};
await messageHandler.send(initChangesMsg);

// Wait for acknowledgment
await messageHandler.waitForMessage(
  'clt_init_received',
  (msg) => msg.table === tableName && msg.chunk === chunkNum,
  300000 // 5 minute timeout
);
```

#### 3.3. Initial Sync Complete
```typescript
const initCompleteMsg: ServerInitCompleteMessage = {
  type: 'srv_init_complete',
  serverLSN: finalLSN,
  messageId: `srv_${Date.now()}`,
  timestamp: Date.now(),
  clientId
};
await messageHandler.send(initCompleteMsg);

// Wait for client acknowledgment
await messageHandler.waitForMessage('clt_init_processed', undefined, 300000);
```

#### 3.4. Post-Initial Sync Logic
```typescript
// Check if catchup sync is needed after initial sync
if (compareLSN(updatedClientLSN, currentServerLSN) < 0) {
  // Transition to catchup sync automatically
  await this.stateManager.updateClientSyncState(clientId, 'catchup');
  await performCatchupSync(...);
} else {
  // Transition directly to live sync
  await this.stateManager.updateClientSyncState(clientId, 'live');
  const liveStartMsg = createLiveSyncConfirmation(clientId, updatedClientLSN);
  await this.send(liveStartMsg);
}
```

## Catchup Sync Flow (SyncStrategy.CATCHUP)

### 4. Catchup Sync Message Sequence

**State Updates:**
```typescript
await this.stateManager.updateClientSyncState(clientId, 'catchup');
```

**Messages Sent:**

#### 4.1. Catchup Changes (Chunked)
```typescript
// For each chunk of changes
const message: ServerChangesMessage = {
  type: 'srv_catchup_changes',
  messageId: `srv_${Date.now()}_${i}`,
  timestamp: Date.now(),
  clientId,
  changes: chunkChanges,
  lastLSN: chunkLastLSN,
  sequence: { chunk: i + 1, total: chunks }
};
await messageHandler.send(message);

// Wait for chunk acknowledgment
await messageHandler.waitForMessage(
  'clt_catchup_received',
  (msg) => msg.chunk === i + 1,
  30000 // 30 second timeout
);
```

#### 4.2. Catchup Completion
```typescript
const syncCompletedMsg: ServerCatchupCompletedMessage = {
  type: 'srv_catchup_completed',
  messageId: `srv_${Date.now()}_completion`,
  timestamp: Date.now(),
  clientId,
  startLSN: clientLSN,
  serverLSN: currentLSN,
  changeCount: totalChangeCount,
  success: true
};
await messageHandler.send(syncCompletedMsg);
```

#### 4.3. Catchup Error Handling
```typescript
// On catchup failure
const failureMsg: ServerCatchupCompletedMessage = {
  type: 'srv_catchup_completed',
  messageId: `srv_${Date.now()}_completion`,
  timestamp: Date.now(),
  clientId,
  startLSN: clientLSN,
  serverLSN: clientLSN, // Same as start on failure
  changeCount: 0,
  success: false,
  error: errorMessage
};
await messageHandler.send(failureMsg);
```

## Live Sync Flow (SyncStrategy.LIVE)

### 5. Live Sync Message Sequence

**State Updates:**
```typescript
await this.stateManager.updateClientSyncState(clientId, 'live');
```

**Messages Sent:**

#### 5.1. Live Sync Confirmation
```typescript
const liveSyncMessage: ServerLiveStartMessage = {
  type: 'srv_live_start',
  messageId: `srv_${Date.now()}_live_start`,
  timestamp: Date.now(),
  clientId,
  startLSN: lsn,
  serverLSN: lsn,
  changeCount: 0,
  success: true
};
await this.send(liveSyncMessage);
```

#### 5.2. Live Changes (Ongoing)
```typescript
// For real-time changes
const liveChangesMessage: ServerChangesMessage = {
  type: 'srv_live_changes',
  messageId: `srv_${Date.now()}_${i}`,
  timestamp: Date.now(),
  clientId,
  changes: chunkChanges,
  lastLSN: chunkLastLSN,
  sequence: { chunk: i + 1, total: chunks }
};
await messageHandler.send(liveChangesMessage);

// Note: Live changes do NOT wait for acknowledgment (fire-and-forget)
```

## Heartbeat Flow

### 6. Heartbeat Message Sequence

**Messages Sent:**

#### 6.1. Heartbeat Response
```typescript
await this.send({
  type: 'srv_heartbeat',
  clientId: heartbeatMessage.clientId || this.clientId,
  messageId: `hb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  timestamp: Date.now()
});
```

#### 6.2. Heartbeat-Triggered State Changes
```typescript
// If client LSN is 0/0 (initial sync needed)
await this.send({
  type: 'srv_state_change',
  clientId,
  messageId: `initial_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  timestamp: Date.now(),
  state: 'initial',
  lsn: serverLSN
});

// If large LSN gap detected (catchup sync needed)
await this.send({
  type: 'srv_state_change',
  clientId,
  messageId: `catchup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  timestamp: Date.now(),
  state: 'catchup',
  lsn: serverLSN
});
```

## Integrity Validation Flow

### 7. Integrity Validation Messages

**Messages Sent:**

#### 7.1. Validation Response (Success)
```typescript
await this.send({
  type: 'srv_integrity_validation_response',
  clientId: validationMessage.clientId || this.clientId,
  messageId: `integrity_response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  timestamp: Date.now(),
  isValid: result.isValid,
  issues: result.issues,
  recommendedAction: result.recommendedAction,
  serverFingerprints: result.serverFingerprints,
  validationTimestamp: result.validationTimestamp
});
```

#### 7.2. Validation Response (Error)
```typescript
await this.send({
  type: 'srv_integrity_validation_response',
  clientId: validationMessage.clientId || this.clientId,
  messageId: `integrity_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  timestamp: Date.now(),
  isValid: false,
  issues: [{
    type: 'data_corruption',
    table: 'unknown',
    severity: 'critical',
    description: `Validation failed: ${errorMessage}`,
    details: {}
  }],
  recommendedAction: 'reset'
});
```

## Stats and Broadcast Messages

### 8. Additional Message Types

#### 8.1. Sync Stats (via WebSocket.send)
```typescript
// Direct WebSocket send (not through message handler)
if (this.webSocket && this.webSocket.readyState === WS_READY_STATE.OPEN) {
  this.webSocket.send(JSON.stringify(statsMessage));
}
```

#### 8.2. Direct Broadcast Changes (via WebSocket.send)
```typescript
// Direct WebSocket send for broadcast changes
const liveChangesMessage = {
  type: 'srv_live_changes',
  messageId: `direct_broadcast_${Date.now()}`,
  timestamp: Date.now(),
  clientId: this.clientId,
  changes: broadcastBody.changes,
  lastLSN: '',
  isConflictResolution: false
};
this.webSocket.send(JSON.stringify(liveChangesMessage));
```

## Message Flow Control & Acknowledgments

### 9. Flow Control Patterns

#### 9.1. Sync Messages Requiring Acknowledgment
- **Initial Sync**: `srv_init_changes` → wait for `clt_init_received`
- **Initial Complete**: `srv_init_complete` → wait for `clt_init_processed`
- **Catchup Chunks**: `srv_catchup_changes` → wait for `clt_catchup_received`

#### 9.2. Fire-and-Forget Messages
- **Live Changes**: `srv_live_changes` (no acknowledgment required)
- **Heartbeat**: `srv_heartbeat` (no acknowledgment required)
- **State Changes**: `srv_state_change` (no acknowledgment required)
- **Integrity Responses**: `srv_integrity_validation_response` (no acknowledgment required)
- **Stats**: Direct WebSocket send (no acknowledgment required)

## Error Handling Messages

### 10. Error Response Patterns

#### 10.1. Sync Failure Messages
```typescript
// Catchup sync failure
{
  type: 'srv_catchup_completed',
  success: false,
  error: errorMessage,
  changeCount: 0
}
```

#### 10.2. WebSocket Unavailability
```typescript
// Throws error instead of sending message
throw new Error('WebSocketUnavailable: No active WebSocket connections for client ' + clientId);
```

## Key Findings for Refactored Modules

### 11. Critical Message Sending Requirements

1. **Initial Sync Must Send:**
   - `srv_init_start` at beginning
   - `srv_init_changes` for each table chunk + wait for `clt_init_received`
   - `srv_init_complete` at end + wait for `clt_init_processed`
   - `srv_live_start` if transitioning directly to live sync

2. **Catchup Sync Must Send:**
   - `srv_catchup_changes` for each chunk + wait for `clt_catchup_received`
   - `srv_catchup_completed` with success/failure status

3. **Live Sync Must Send:**
   - `srv_live_start` for immediate live sync confirmation
   - `srv_live_changes` for ongoing real-time changes (no wait)

4. **Heartbeat Must Send:**
   - `srv_heartbeat` response
   - `srv_state_change` if sync strategy change triggered

5. **Integrity Must Send:**
   - `srv_integrity_validation_response` with validation results

### 12. Missing Message Patterns to Verify

The refactored modules should ensure they maintain:
- All acknowledgment patterns (waitForMessage calls)
- Proper error message sending
- State transition notifications
- Direct WebSocket sends for stats/broadcasts
- Timeout handling for acknowledgments

## Implementation Verification Checklist

- [ ] Initial sync sends srv_init_start
- [ ] Initial sync sends srv_init_changes with proper sequencing  
- [ ] Initial sync waits for clt_init_received acknowledgments
- [ ] Initial sync sends srv_init_complete
- [ ] Initial sync waits for clt_init_processed acknowledgment
- [ ] Catchup sync sends srv_catchup_changes with proper chunking
- [ ] Catchup sync waits for clt_catchup_received acknowledgments
- [ ] Catchup sync sends srv_catchup_completed 
- [ ] Live sync sends srv_live_start confirmation
- [ ] Live sync sends srv_live_changes (no acknowledgment)
- [ ] Heartbeat sends srv_heartbeat response
- [ ] Heartbeat sends srv_state_change when needed
- [ ] Integrity validation sends srv_integrity_validation_response
- [ ] Stats forwarding via direct WebSocket.send
- [ ] Broadcast forwarding via direct WebSocket.send
- [ ] Proper error message sending for failures
- [ ] WebSocketUnavailable error throwing (not sending)