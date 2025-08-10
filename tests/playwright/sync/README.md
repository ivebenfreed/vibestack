# Sync Tests with XState Monitoring

This directory contains comprehensive sync tests that use XState inspection to verify the synchronization system's behavior.

## Test Files

### 1. `01-initial-sync-xstate.spec.js` ✅ PASSING
Tests initial synchronization when a fresh client connects for the first time.

**What it tests:**
- Client with no sync state performs initial sync
- Receives all data from server
- Transitions through correct states
- Populates local database
- Updates LSN to current server state

**Key validations:**
- Initial sync messages received (START_INITIAL_SYNC, INITIAL_SYNC_COMPLETE)
- Incoming changes processed (7 batches)
- Database populated with data (100 tasks, 47 users, 35 projects, 26 comments)
- LSN updated to current server state
- Reaches live_sync state

### 2. `02-catchup-sync-xstate.spec.js` ✅ PASSING
Tests catchup synchronization when a client has an older LSN.

**What it tests:**
- Client with older LSN triggers catchup
- Receives changes since last sync
- Updates to current server state
- LSN properly updated after catchup

**Key validations:**
- Catchup messages received (CATCHUP_SYNC_COMPLETE)
- Incoming changes processed
- LSN updated from old value (0/100000) to current (0/25D6D40)
- Reaches live_sync state after catchup

**Fixed Issue:**
- Previously hanging due to LSN field mismatch (server sent `endLSN`, client expected `serverLSN`)
- Fixed in MessageProcessor to handle both field names

### 3. `03-live-sync-xstate.spec.js` ✅ PASSING
Tests real-time synchronization between multiple clients.

**What it tests:**
- Multiple tabs/clients stay in sync
- Changes in one tab propagate to others
- WebSocket communication works
- Change tracking and sending works

**Key validations:**
- Both tabs reach live_sync state
- DEXIE_CHANGES_SENT events triggered
- WS_MESSAGE events show communication
- INCOMING_CHANGES_PROCESSED in receiving tab

## XState Monitoring Features

All tests use the XState Test Inspector (`window.xstateTestInspector`) which provides:

### Available Methods
- `getSummary()` - Overview of all state machines
- `getTransitions(machineId)` - Get state transitions
- `getEvents(machineId)` - Get events sent to machine
- `getCurrentState(machineId)` - Get current state
- `waitForState(machineId, state, timeout)` - Wait for specific state
- `waitForEvent(machineId, event, timeout)` - Wait for specific event
- `addMarker(marker, data?)` - Add test markers
- `clear()` - Clear all inspection data

### Key Events to Monitor

#### Sync State Changes
- `CONNECT` - WebSocket connection initiated
- `DISCONNECT` - WebSocket disconnection
- `START_INITIAL_SYNC` - Initial sync begins
- `INITIAL_SYNC_COMPLETE` - Initial sync finished
- `CATCHUP_SYNC_COMPLETE` - Catchup sync finished

#### Data Flow Events
- `INCOMING_CHANGES` - Changes received from server
- `INCOMING_CHANGES_PROCESSED` - Changes applied to database
- `DEXIE_CHANGES_SENT` - Local changes sent to server
- `WS_MESSAGE` - WebSocket message received
- `LSN_UPDATE` - LSN updated

#### Error Events
- `ERROR` - Sync error occurred
- `RETRY` - Retry attempt

### State Machine States

The sync machine (`sync-machine-v3`) has these states:
- `idle` - Not connected
- `connecting` - Establishing connection
- `determining_sync_phase` - Server determining sync type
- `initial_sync` - Performing initial sync
- `catchup_sync` - Catching up to server state
- `pre_live_validation` - Validating before live sync
- `live_sync` - Real-time sync active
- `error` - Error state

## Running Tests

### Individual Tests
```bash
# Run initial sync test
npx playwright test tests/playwright/sync/01-initial-sync-xstate.spec.js

# Run live sync test
npx playwright test tests/playwright/sync/03-live-sync-xstate.spec.js

# Run catchup sync test (currently hanging)
npx playwright test tests/playwright/sync/02-catchup-sync-xstate.spec.js
```

### All Sync Tests
```bash
npx playwright test tests/playwright/sync/*-xstate.spec.js
```

### With Browser Visible
```bash
npx playwright test tests/playwright/sync/03-live-sync-xstate.spec.js --headed
```

## Test Helpers

The tests use helpers from `../helpers/sync-test-setup.js`:
- `clearAllSyncState(page)` - Clear sync state for fresh start
- `setupCatchupSync(page, lsn)` - Set up for catchup sync test
- `setupLiveSync(page)` - Set up for live sync test

## Debugging Tips

1. **Check XState Inspector in Console:**
   ```javascript
   window.xstateTestInspector.getSummary()
   ```

2. **Monitor State Changes:**
   ```javascript
   window.xstateTestInspector.getTransitions('sync-machine-v3')
   ```

3. **View Recent Events:**
   ```javascript
   window.xstateTestInspector.getEvents('sync-machine-v3').slice(-10)
   ```

4. **Check Current State:**
   ```javascript
   window.xstateTestInspector.getCurrentState('sync-machine-v3')
   ```

## Recent Fixes

1. **Catchup sync hanging issue RESOLVED** - Fixed LSN field mismatch between server and client
   - Server was sending `endLSN` in `srv_catchup_completed` message
   - Client was expecting `serverLSN`
   - MessageProcessor now handles both field names

## Known Limitations

1. **LocalChanges not directly accessible** - Dexie LocalChanges table access limited in tests
2. **No ACK events visible** - Server acknowledgments not captured in XState events (they happen at WebSocket level)

## Future Improvements

1. Add test for conflict resolution during live sync
2. Add test for offline/online transitions
3. Add test for large data sync (performance testing)
4. Add test for sync error recovery and retry logic
5. Add test for multiple clients syncing simultaneously
6. Add more granular event tracking in sync machine
7. Create test for sync state persistence across browser restarts
8. Add test for partial sync failures and recovery