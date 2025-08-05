# Sync System Research - Issue #36

## 🔍 Sync Machine States & Transitions

### State Flow:
```
idle → connecting → (initial_sync | catchup_sync) → pre_live_validation → live_sync
```

### States Detail:
1. **`idle`** - Awaiting connection, change tracking ON
2. **`connecting`** - Service initialization + WebSocket connection
3. **`initial_sync`** - Full sync (change tracking OFF)
4. **`catchup_sync`** - Partial sync (change tracking OFF)  
5. **`pre_live_validation`** - Validation phase (change tracking OFF)
6. **`live_sync`** - Real-time sync (change tracking ON)

### Sync Phases (context.syncPhase):
- `'initial'` - During initial_sync state
- `'catchup'` - During catchup_sync state
- `'validating'` - During pre_live_validation state  
- `'live'` - During live_sync state

## 📡 LSN (Log Sequence Number) Behavior

### When LSN Updates:
- **LSN updates via `LSN_UPDATE` WebSocket events from server**
- **NOT from local operations** - local operations are tracked separately
- LSN represents server's last processed change
- Stored in localStorage as `sync-machine-state`

### What We Observe:
- LSN stays constant during local-only operations
- LSN advances when server processes changes
- Tests should expect LSN stability during local CRUD

## 🔄 Change Tracking System

### How It Works:
1. **Dexie hooks** intercept create/update/delete operations
2. **Changes logged to `localChanges` table** when tracking enabled
3. **Tracking disabled during sync** to prevent loops
4. **Changes sent to server via OutgoingChangeService**

### Control Functions:
- `enableChangeTracking()` - Turn on change detection
- `disableChangeTracking()` - Turn off change detection  
- `isTrackingEnabled` - Current state

### What Gets Tracked:
- All CRUD operations when tracking enabled
- Generates client-side sequence numbers
- Deduplicates identical operations
- Skips sync transactions (marked with SYNC_TRANSACTION symbol)

## 🧪 Testable Scenarios

### ✅ What We Can Test:
1. **Sync state transitions** - Verify state changes in localStorage
2. **Change tracking behavior** - Verify localChanges table updates
3. **LSN persistence** - Verify LSN is saved/restored correctly
4. **LSN progression** - Use `resetLSNManual()` to simulate server LSN updates
5. **Sync phase progression** - Monitor syncPhase changes
6. **Error recovery** - Test WebSocket disconnection/reconnection

### 🛠️ Debug Functions Available:
- `window.debugResetLSN(newLSN, reason)` - Manually set LSN and trigger sync restart
- `window.debugIntegrityStatus()` - Get current sync state and LSN
- `window.debugReset()` - Trigger full sync reset
- `window.debugValidate()` - Trigger sync validation

### ❌ What We Shouldn't Test:
1. **Internal WebSocket messages** - Implementation detail
2. **Service coordination internals** - Too low-level
3. **Real network connectivity** - Use debug functions instead

## 🎯 Test Strategy

### Approach:
1. **Test observable state changes** - Monitor localStorage sync-machine-state
2. **Test change tracking effects** - Verify localChanges table behavior
3. **Use domain services for operations** - Don't bypass change tracking
4. **Use debug functions for controlled scenarios** - Leverage `debugResetLSN` for LSN manipulation
5. **Focus on client-side behavior** - Server integration is separate concern

### Test Categories Implemented:
1. **State Persistence Tests** ✅ - Verify sync state survives page refresh
2. **Change Tracking Tests** ✅ - Verify CRUD operations are tracked correctly
3. **LSN Progression Tests** ✅ - Use debug functions to test LSN updates
4. **Sync Reset Tests** ✅ - Test complete sync reset to LSN 0/0
5. **Catchup Sync Tests** ✅ - Test reconnection with rolled-back LSN
6. **Integrity Status Tests** ✅ - Verify debug status functions work

### Catchup Sync Test Implementation:
The catchup sync test simulates the scenario where a client's LSN falls behind the server:
1. **Rolls back client LSN** to `0/1000000` (older than current)
2. **Triggers sync disconnect/reconnect** via sync machine events
3. **Monitors catchup attempt** - in test environment, no server LSN updates occur
4. **Validates test infrastructure** - confirms debug functions work correctly

**Expected Behavior in Test Environment:**
- LSN rollback succeeds (localStorage updated)
- Reconnection attempt processed (events sent to sync machine)
- No actual catchup occurs (no server to provide newer LSN)
- Test validates the client-side catchup infrastructure is working

## 🚫 Assumptions That Were Wrong:
1. ❌ LSN advances after every local operation
2. ❌ Sync has simple initial → live progression  
3. ❌ We should test WebSocket message internals
4. ❌ forceSyncCatchup should manipulate domain services directly

## ✅ Correct Understanding:
1. ✅ LSN only advances from server WebSocket messages
2. ✅ Sync has validation phase before going live
3. ✅ Change tracking can be enabled/disabled
4. ✅ Tests should focus on observable client behavior
5. ✅ Domain services trigger change tracking automatically