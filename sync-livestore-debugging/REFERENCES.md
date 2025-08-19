# WebSocket + LiveStore Debug References

## 📁 Existing Debug Files & Tests

### WebSocket Debug Tests (Primary Reference)
- `tests/playwright/websockets/09-websocket-sync-working.spec.js` 
  - **Purpose**: End-to-end WebSocket sync verification
  - **Status**: ✅ Working - verifies 15 Wide Corp records sync successfully
  - **Shows**: Organization tables recognized, no sync errors
  - **Issue**: Reports "LiveStore not available"

- `tests/playwright/websockets/10-debug-schema-sync-init.spec.js`
  - **Purpose**: Schema sync initialization debugging  
  - **Status**: ✅ Working - schema sync handlers initialized
  - **Shows**: Sync machine connecting successfully
  - **Issue**: LiveStore global availability

### Security & Verification
- `WEBSOCKET_SECURITY_FINDINGS.md`
  - **Purpose**: Multi-tenant security verification
  - **Status**: ✅ Complete - perfect organization isolation verified
  - **Critical fix**: Eliminated cross-org data leakage

### Additional WebSocket Tests
- `tests/playwright/websockets/` - Complete WebSocket test suite
- Various numbered debug tests for specific scenarios
- Browser profile-based testing with Wide Corp credentials

## 🗂️ Key Architecture Files

### Server-Side Sync
- `apps/server/src/sync/SyncDO.ts` - **FIXED**: Restored automatic sync trigger
- `apps/server/src/sync/sync-table-registry.ts` - **FIXED**: Organization filtering
- `apps/server/src/sync/websocket/WebSocketManager.ts` - Connection management

### Client-Side Sync  
- `apps/web/src/sync/IncomingChangeService.ts` - **FIXED**: Organization table routing
- `apps/web/src/sync/utils/ServiceCoordinator.ts` - Service initialization
- `apps/web/src/sync/WebSocketService.ts` - WebSocket client

### LiveStore Integration
- `apps/web/src/lib/livestore-client.ts` - **DEBUG TARGET**: Client initialization
- `apps/web/src/lib/livestore-schema-sync.ts` - Dynamic schema management  
- `apps/web/src/sync/IncomingChangeService.ts:950` - **DEBUG TARGET**: `bridgeToLiveStore()`

### Data Models & Types
- `apps/web/src/db/client-entities.ts` - **FIXED**: Organization table patterns
- `packages/sync-types/src/schema-messages.ts` - **NEW**: Shared schema types
- `apps/web/src/types/sync.ts` - Type exports

## 🧪 Test Environment Setup

### Test Organization: Wide Corp Solutions  
- **Org ID**: `01920000-1000-7000-8000-000000000001`
- **Test Tables**: 12 business entities (client, project, timesheet, etc.)
- **Credentials File**: `planning/active/testing-infrastructure/test-org-central/credentials/COMPLETE_ROLE_CREDENTIALS.md`

### Primary Test User
- **Email**: ceo@widecorp.com  
- **Password**: WideCorp2024!CEO
- **Role**: Owner (Alice CEO - full org access)
- **Purpose**: Comprehensive sync testing

### Test Execution
- **Environment**: Persistent browser profiles
- **Ports**: Web=5173, Server=8787, DB=5432 (main/staging mode)
- **Command**: `./scripts/playwright-test.sh tests/playwright/websockets/09-websocket-sync-working.spec.js`

## 🔧 Debug Commands

### Start Development Environment
```bash
./scripts/dev-start.sh  # Start servers in background
./scripts/dev-logs.sh   # Monitor logs
```

### Run Sync Tests
```bash
# Primary test - verifies WebSocket + organization table handling
./scripts/playwright-test.sh tests/playwright/websockets/09-websocket-sync-working.spec.js

# Schema debugging - checks LiveStore initialization
./scripts/playwright-test.sh tests/playwright/websockets/10-debug-schema-sync-init.spec.js

# Run with visible browser for detailed debugging
./scripts/playwright-test.sh tests/playwright/websockets/09-websocket-sync-working.spec.js --headed
```

### Check LiveStore Client
```bash
# In browser console during test
console.log(window.LiveStore);
console.log(getLiveStoreClient());
```

## 📊 Current Status Indicators

### ✅ Working (Verified)
- WebSocket connection establishment
- Organization-specific table recognition  
- Multi-tenant security isolation
- 15 Wide Corp records syncing without errors
- Sync machine state management

### 🔍 Debugging Needed  
- `getLiveStoreClient()` returns null/undefined
- LiveStore initialization in ServiceCoordinator
- Organization schema loading for Wide Corp
- Data storage in LiveStore tables
- LiveStore availability for UI queries

### 🎯 Success Criteria
- LiveStore client available in browser
- Wide Corp data stored in LiveStore tables
- Organization tables queryable from UI components
- End-to-end data flow: WebSocket → IncomingChangeService → LiveStore → UI

---

*Use this reference when debugging LiveStore initialization and data storage issues*