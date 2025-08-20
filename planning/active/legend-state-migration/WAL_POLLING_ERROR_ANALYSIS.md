# WAL Polling Error Analysis and Progress Report

## Current Issue Summary

The table change notification system is experiencing "undefined" errors when processing WAL changes and sending notifications to SyncDO clients. The system successfully reaches live_sync state but fails during table change notification delivery.

## Error Context

### Primary Error Pattern
```
Error sending table change notification undefined
```

### System Behavior
1. **WAL Processing**: The system successfully peeks at WAL changes (808 entries found)
2. **Organization Extraction**: Successfully extracts organization IDs from table names
3. **Client Registry**: Successfully retrieves active clients for organizations  
4. **Notification Delivery**: Fails with "undefined" errors during SyncDO communication

### API Timeout Issue
When testing with direct API calls, requests to create projects hang indefinitely:
```bash
curl -X POST http://localhost:8787/api/archetype/orgs/.../data/Project
# Hangs for 40+ seconds with no response
```

## Progress Completed Successfully

### ✅ Phase 1: Sync State Machine Fixes
- **Server-Side Strategy Bypass**: Removed complex sync strategy determination logic
- **Direct Live Sync**: Modified SyncDO to go straight to live sync mode
- **Client Message Handling**: Added proper `srv_live_start` message handling
- **Actor Communication**: Fixed sendParent errors in sync machine
- **Authentication Chain**: Fixed hardcoded user ID issues in app-init machine

### ✅ Phase 2: WAL Polling Simplification  
- **Peek-Only Mode**: Changed from consuming to peeking WAL changes to preserve history
- **Direct Notifications**: Bypassed complex change_history table storage
- **Organization Awareness**: Added proper organization ID extraction from table names
- **Client Registry Integration**: Connected to org-aware client registry for targeted notifications

### ✅ Phase 3: Error Handling Improvements
- **Parameter Validation**: Added comprehensive parameter validation in `sendTableChangeNotification`
- **Detailed Logging**: Enhanced error logging with stack traces and parameter details
- **Table Name Processing**: Improved regex pattern matching for organization table extraction

## Current Implementation Status

### Working Components
1. **Sync State Machine**: Successfully transitions to live_sync state
2. **WAL Polling**: Successfully peeks at changes without consuming
3. **Organization Extraction**: Correctly parses table names to extract org IDs
4. **Client Registry**: Successfully retrieves active clients per organization

### Failing Components  
1. **SyncDO Communication**: Table change notification requests fail with undefined errors
2. **API Response**: Project creation API calls hang indefinitely
3. **Error Propagation**: Root cause of undefined errors is unclear from current logs

## Technical Details

### File Modifications Made

#### `/home/ben-freed/dev/vibestack/apps/server/src/replication/polling.ts`
- Enhanced `processChangesForNotifications` with detailed logging
- Added comprehensive parameter validation in `sendTableChangeNotification`
- Improved error handling with stack traces and response body logging
- Added case-insensitive regex matching for organization table extraction

#### `/home/ben-freed/dev/vibestack/apps/server/src/sync/SyncDO.ts`  
- Bypassed sync strategy determination entirely
- Added direct live sync mode activation
- Added `handleTableChangeNotification` endpoint for WAL notifications

#### `/home/ben-freed/dev/vibestack/apps/web/src/state-machines/machines/pure-livestore-sync-machine.ts`
- Added `srv_live_start` message handling
- Fixed actor communication patterns
- Proper state transition to live_sync

### Current WAL Processing Flow
1. **Polling**: Peek at WAL changes using `pg_logical_slot_peek_changes`
2. **Parsing**: Extract table names and organization IDs from change data
3. **Registry Lookup**: Get active clients for each affected organization
4. **Notification**: Send table change notifications to SyncDO instances
5. **Error**: Undefined errors occur during SyncDO communication

## Next Steps Required

### 1. Root Cause Analysis
- **SyncDO Endpoint**: Verify `handleTableChangeNotification` endpoint exists and is accessible
- **Request Format**: Validate the notification request format matches SyncDO expectations
- **Response Handling**: Investigate why SyncDO responses are causing undefined errors

### 2. API Hang Investigation  
- **Database Connection**: Check if database operations are blocking
- **Authentication**: Verify API authentication is working correctly
- **Transaction State**: Investigate if database transactions are stuck

### 3. Simplified Testing Approach
- **Direct SyncDO Test**: Create minimal test script to call SyncDO notification endpoint directly
- **WAL Simulation**: Create test data to trigger WAL changes without API calls
- **Error Isolation**: Separate WAL processing from API endpoint issues

## System Architecture Context

### Pure LiveStore Migration Status
- ✅ **Client-Side**: Pure LiveStore implementation complete
- ✅ **Sync Machine**: State transitions working correctly  
- ✅ **WebSocket Integration**: Connected to real sync system
- ❌ **Table Notifications**: WAL-based notifications failing with undefined errors
- ❌ **API Stability**: Project creation API calls hanging

### WAL-Based Notification Flow
```
WAL Changes → Polling → Organization Extraction → Client Registry → SyncDO Notification → [FAILING HERE]
```

The system successfully processes through organization extraction and client registry lookup, but fails when attempting to deliver notifications to SyncDO instances.

## Error Impact
- **Sync Functionality**: Core sync works but real-time notifications fail
- **User Experience**: Changes don't propagate immediately to other clients
- **System Reliability**: API endpoints become unresponsive during notification attempts

## Investigation Priority
1. **Immediate**: Fix SyncDO notification endpoint communication
2. **Secondary**: Resolve API endpoint hanging issues  
3. **Future**: Optimize notification delivery performance

## Files for Reference
- WAL Polling: `/apps/server/src/replication/polling.ts`
- SyncDO Handler: `/apps/server/src/sync/SyncDO.ts`
- Client Registry: `/apps/server/src/sync/org-aware-client-registry.ts`
- Sync Machine: `/apps/web/src/state-machines/machines/pure-livestore-sync-machine.ts`