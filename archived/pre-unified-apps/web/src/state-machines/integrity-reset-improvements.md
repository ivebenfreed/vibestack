# Integrity Reset Improvements

## 🎯 **Problem Analysis**

The integrity reset was failing to properly disconnect/reconnect sync in the debug page due to:

### **Multiple Sync Systems Conflict**
- **Legacy SyncManager**: Used by debug page controls
- **SyncMachineV2**: Used by orchestrator (new architecture)  
- **SyncContext**: Used by UI components
- All three systems could interfere with each other during reset

### **Race Conditions**
- Service disconnection too fast (100ms wait)
- Auto-reconnect triggering during reset
- State machine transitions before services fully cleaned up

### **Insufficient Coordination**
- No coordination between legacy and new sync systems
- Auto-reconnect not disabled during reset
- Debug page could re-enable connections mid-reset

---

## 🔧 **Solutions Implemented**

### **1. Comprehensive Service Disconnection**

Enhanced `IntegrityService.disconnectAllServices()`:

```typescript
// Step 1: Disable auto-reconnect on ALL systems
await this.disableAllAutoReconnect();

// Step 2: Disconnect new SyncMachineV2 (orchestrator)
const services = getGlobalServices();
if (services?.webSocketService) {
  await services.webSocketService.disconnect();
  await this.waitForServiceDisconnection(services.webSocketService, 'SyncMachineV2');
}

// Step 3: Disconnect legacy SyncManager (debug page)
await this.disconnectLegacySyncManager();

// Step 4: Notify orchestrator of clean disconnection
await this.notifyOrchestratorOfDisconnection();

// Step 5: Wait for all systems to stabilize (500ms)
await new Promise(resolve => setTimeout(resolve, 500));
```

### **2. Auto-Reconnect Control**

Added proper auto-reconnect management:

- **Disable** auto-reconnect before reset on all systems
- **Track** disabled state in sync machine context
- **Re-enable** after successful reset completion
- **Prevent** premature reconnection attempts

### **3. Enhanced Timing & Coordination**

Improved timing throughout the process:

- **5 seconds max** disconnect wait (up from 2 seconds)
- **500ms final** stabilization wait (up from 100ms)  
- **Proper event** sequencing between systems
- **Status logging** every 1 second during long waits

### **4. State Machine Improvements**

Enhanced SyncMachineV2 with:

```typescript
// New context field
autoReconnectDisabled: boolean

// New guard for reconnection attempts
canAutoReconnect: ({ context }) => 
  !context.autoReconnectDisabled && context.reconnectAttempts < 5

// Global event handlers
DISABLE_AUTO_RECONNECT_FOR_RESET: { actions: ['disableAutoReconnect'] }
ENABLE_AUTO_RECONNECT_AFTER_RESET: { actions: ['enableAutoReconnect'] }
INTEGRITY_RESET_DISCONNECTION_COMPLETE: { actions: ['logDisconnectionComplete'] }
```

---

## 🔍 **How It Works Now**

### **Reset Sequence**

1. **🚫 Disable Auto-Reconnect**
   - Legacy SyncManager: `setAutoConnect(false)`
   - Orchestrator: `DISABLE_AUTO_RECONNECT_FOR_RESET` event
   - SyncMachineV2: `autoReconnectDisabled = true`

2. **🔌 Comprehensive Disconnection**
   - Disconnect SyncMachineV2 WebSocketService (5s max wait)
   - Disconnect legacy SyncManager (3s max wait)
   - Notify orchestrator of completion
   - Wait 500ms for all systems to stabilize

3. **🗑️ Database Reset**
   - Reset LSN to '0/0'
   - Clear all domain tables
   - Verify tables are empty
   - Pause/resume live changes manager

4. **✅ Re-enable & Reconnect**
   - Re-enable auto-reconnect on all systems
   - SyncMachineV2 transitions to 'connecting' state
   - Legacy SyncManager can reconnect via debug page
   - Fresh sync begins with LSN '0/0'

### **Debug Page Experience**

- **Disconnect**: Works immediately, respects reset state
- **Connect**: Re-enabled after reset completion
- **Status**: Shows correct state throughout process
- **No Conflicts**: Legacy and new systems coordinate properly

### **🆕 Two Reset Approaches Available**

**State Machine Reset** (`debugResetProper`) - **RECOMMENDED**:
- ✅ **CORRECT FLOW**: `live_sync` → `resetting_integrity` → `initializing` → `connecting` → `initial_sync` → `live_sync`
- ✅ Clean disconnection before database operations
- ✅ Full initial sync to rebuild empty database
- ✅ Coordinated reconnection after reset
- ✅ Debug page shows accurate connection status

**Direct Reset** (`debugResetDirect`) - **LEGACY**:
- ⚠️ Bypasses sync machine entirely 
- ⚠️ Database cleared but connection stays active
- ⚠️ Debug page may show incorrect "connected" status
- ⚠️ Requires manual reconnection

---

## 🔧 **CRITICAL BUG FIXES**

### **1. Wrong State Transition After Reset (SYNC MACHINE)**

**Previous Behavior (BROKEN)**:
```
resetting_integrity → connecting → live_sync
```
- ❌ Skipped initial sync entirely
- ❌ Database was empty but machine thought it was live
- ❌ LSN immediately jumped from `0/0` to current server LSN
- ❌ No data rebuild occurred

**Fixed Behavior (CORRECT)**:
```
resetting_integrity → initializing → connecting → initial_sync → live_sync  
```
- ✅ Full service re-initialization 
- ✅ Proper initial sync to rebuild database
- ✅ LSN progression: `0/0` → progressive updates → final server LSN
- ✅ Complete data reconstruction

### **2. Missing LSN Communication (SYNC MACHINE → ORCHESTRATOR)**

**Previous Behavior (BROKEN)**:
```typescript
// Sync machine reset its own LSN but didn't tell orchestrator
assign({ currentLSN: '0/0', ... })
sendParent({ type: 'INTEGRITY_RESET_COMPLETED' })
// Orchestrator still had old LSN in context!
```
- ❌ Sync machine reset its own LSN to `0/0`
- ❌ But orchestrator context still had old LSN (`0/1B1E4690`)
- ❌ Orchestrator restarted sync with old LSN from its context
- ❌ No database rebuild occurred

**Fixed Behavior (CORRECT)**:
```typescript
// Sync machine tells orchestrator to update LSN
assign({ currentLSN: '0/0', ... })
sendParent({ type: 'LSN_UPDATE', lsn: '0/0' })        // ✅ NEW!
sendParent({ type: 'INTEGRITY_RESET_COMPLETED' })
```
- ✅ Sync machine resets its own LSN to `0/0`
- ✅ Sync machine sends `LSN_UPDATE` to orchestrator
- ✅ Orchestrator updates its LSN context to `0/0`
- ✅ Orchestrator restarts sync with fresh `0/0` LSN
- ✅ Complete database rebuild occurs

### **Why This Matters**

After integrity reset:
1. **Database is empty** - all tables cleared except system tables
2. **LSN is `0/0`** - client needs full sync from beginning  
3. **Must rebuild everything** - users, projects, tasks, comments
4. **Initial sync required** - can't jump to live sync with empty DB

---

## 🎯 **Benefits**

### **Reliability**
- ✅ **No race conditions** between sync systems
- ✅ **Clean disconnection** before database reset
- ✅ **Proper timing** prevents stale connections
- ✅ **Coordinated reconnection** after reset

### **Debug Experience**
- ✅ **Debug page works** throughout reset process
- ✅ **Clear status** feedback during operations
- ✅ **Manual controls** respect reset state
- ✅ **Automatic recovery** after completion

### **Maintainability**
- ✅ **Single source of truth** for auto-reconnect state
- ✅ **Event-driven** coordination between systems
- ✅ **Comprehensive logging** for troubleshooting
- ✅ **Clean separation** of concerns

---

## 📝 **Usage**

### **For Debug Page**
The debug page will now:
- Show correct connection status during reset
- Disable connection controls during reset
- Re-enable controls after reset completion
- Work with both legacy and new sync systems

### **For Integrity Validation**
Integrity resets will now:
- Cleanly disconnect all sync systems
- Wait for proper disconnection before DB operations
- Re-enable connections after successful reset
- Handle both manual and server-initiated resets

### **For Development**
Enhanced logging provides:
- Clear visibility into disconnect/reconnect timing
- Status updates during long operations
- Error tracking across all sync systems
- Performance metrics for optimization

---

## ⚠️ **Migration Notes**

### **Backward Compatibility**
- Legacy SyncManager continues to work
- Existing debug page controls unchanged
- New coordination layer is transparent

### **Testing Considerations**
- Test both legacy and new sync systems
- Verify debug page during integrity resets
- Check timing under slow network conditions
- Validate auto-reconnect behavior

### **Performance Impact**
- Slightly longer disconnect time (more thorough)
- Better reliability vs. speed tradeoff
- Enhanced logging may increase console output
- No impact on normal sync operations 