# LiveStore Event Sync Integration Guide

## Overview

This guide shows how to integrate the new **LiveStore Native Event Sync** with your existing sync infrastructure, replacing complex Dexie-based change tracking with clean native event streaming.

## Integration Steps

### Step 1: Import the Event Sync Service

```typescript
import { 
  LiveStoreEventSyncService, 
  LiveStoreEventSyncIntegration,
  createLiveStoreEventSync 
} from '../lib/livestore-event-sync-service';
```

### Step 2: Replace Dexie Change Tracking

**Before (Dexie-based):**
```typescript
// OLD: Complex bridge approach
import { DexieOutgoingChangeService } from '../sync/DexieOutgoingChangeService';
import { trackOutgoingChange } from '../db/dexie-change-tracking';

// Manual change tracking
await trackOutgoingChange('projects', 'insert', projectData);
```

**After (LiveStore Native):**
```typescript
// NEW: Simple native event streaming
import { createLiveStoreEventSync } from '../lib/livestore-event-sync-service';

// Automatic change tracking via events
const eventSync = await createLiveStoreEventSync({
  orgId: currentOrgId,
  liveStoreInstance: liveStoreClient,
  webSocketSender: existingWebSocketSender,
  clientId: currentClientId
});
```

### Step 3: Update Organization Initialization

**In your organization switching logic:**

```typescript
// apps/web/src/lib/livestore-schema-client.ts

import { LiveStoreEventSyncIntegration } from './livestore-event-sync-service';

export class LiveStoreSchemaClient {
  private eventSyncServices = new Map<string, LiveStoreEventSyncService>();
  
  async initializeLiveStore(orgId: string, clientId: string): Promise<LiveStoreInstance | null> {
    // ... existing LiveStore initialization ...
    
    // NEW: Add event sync after LiveStore is ready
    if (liveStoreInstance) {
      const eventSync = await LiveStoreEventSyncIntegration.initializeForOrg(
        orgId,
        liveStoreInstance,
        this.getWebSocketSender(), // Your existing WebSocket sender
        clientId
      );
      
      this.eventSyncServices.set(orgId, eventSync);
      
      console.log('✅ LiveStore event sync initialized for org:', orgId);
    }
    
    return liveStoreInstance;
  }
  
  async closeLiveStore(orgId: string): Promise<void> {
    // Stop event sync before closing LiveStore
    const eventSync = this.eventSyncServices.get(orgId);
    if (eventSync) {
      eventSync.stopEventSync();
      this.eventSyncServices.delete(orgId);
    }
    
    // ... existing close logic ...
  }
  
  private getWebSocketSender() {
    // Return your existing WebSocket sender
    // This maintains compatibility with current sync infrastructure
    return yourExistingWebSocketSender;
  }
}
```

### Step 4: Update Data Operations

**Before (Manual tracking):**
```typescript
// OLD: Manual change tracking required
async function saveProject(project: Project) {
  // 1. Save to LiveStore
  await liveStoreClient.upsert('projects', project);
  
  // 2. Manual sync tracking
  await trackOutgoingChange('projects', 'upsert', project);
}
```

**After (Automatic tracking):**
```typescript
// NEW: Automatic change tracking via events
async function saveProject(project: Project) {
  // Just save to LiveStore - events handle sync automatically!
  await liveStoreClient.commit(
    events.projectCreated(project)
  );
  // Event sync happens automatically via native event stream
}
```

### Step 5: Handle Event Types

**Configure your LiveStore schema to emit the right events:**

```typescript
// In your LiveStore schema definition
const events = {
  // Entity events that will be auto-synced
  projectCreated: (data: Project) => ({ type: 'ProjectCreated', data }),
  projectUpdated: (data: Project) => ({ type: 'ProjectUpdated', data }),
  projectDeleted: (id: string) => ({ type: 'ProjectDeleted', data: { id } }),
  
  taskCreated: (data: Task) => ({ type: 'TaskCreated', data }),
  taskUpdated: (data: Task) => ({ type: 'TaskUpdated', data }),
  taskDeleted: (id: string) => ({ type: 'TaskDeleted', data: { id } }),
  
  clientCreated: (data: Client) => ({ type: 'ClientCreated', data }),
  clientUpdated: (data: Client) => ({ type: 'ClientUpdated', data }),
  clientDeleted: (id: string) => ({ type: 'ClientDeleted', data: { id } }),
};
```

## Migration Strategy

### Phase 1: Parallel Testing (Recommended)

Run both systems side-by-side to validate:

```typescript
class ParallelSyncTesting {
  async testBothSystems(orgId: string, liveStoreInstance: LiveStoreInstance) {
    // Keep existing Dexie sync running
    const dexieSync = new DexieOutgoingChangeService(/* config */);
    
    // Add new LiveStore event sync
    const eventSync = await createLiveStoreEventSync({
      orgId,
      liveStoreInstance,
      webSocketSender: new ValidationWebSocketSender(), // Logs but doesn't send
      clientId: 'test-client'
    });
    
    // Compare outputs
    this.compareResults(dexieSync, eventSync);
  }
}
```

### Phase 2: Gradual Rollout

Replace per organization:

```typescript
// Feature flag approach
const useLiveStoreEventSync = await getFeatureFlag('livestore-event-sync', orgId);

if (useLiveStoreEventSync) {
  // Use new LiveStore event sync
  const eventSync = await createLiveStoreEventSync(config);
} else {
  // Use existing Dexie sync
  const dexieSync = new DexieOutgoingChangeService(config);
}
```

### Phase 3: Full Migration

Remove Dexie dependencies entirely:

```typescript
// Remove all Dexie sync code
// ❌ import { DexieOutgoingChangeService } from '../sync/DexieOutgoingChangeService';
// ❌ import { trackOutgoingChange } from '../db/dexie-change-tracking';

// Keep only LiveStore event sync
// ✅ import { createLiveStoreEventSync } from '../lib/livestore-event-sync-service';
```

## Configuration Options

### Basic Configuration

```typescript
const eventSync = await createLiveStoreEventSync({
  orgId: '01920000-1000-7000-8000-000000000001',
  liveStoreInstance: liveStoreClient,
  webSocketSender: webSocketSender,
  clientId: 'client-123',
  autoStart: true // Default: true
});
```

### Advanced Configuration

```typescript
// Create without auto-starting (for manual control)
const eventSync = LiveStoreEventSyncIntegration.createEventSync(
  orgId,
  liveStoreInstance,
  webSocketSender, 
  clientId
);

// Start manually when ready
await eventSync.startEventSync();

// Monitor status
const status = eventSync.getStatus();
console.log('Event sync status:', status);

// Stop when done
eventSync.stopEventSync();
```

## Testing

### Unit Tests

```typescript
describe('LiveStoreEventSync', () => {
  test('converts events to table changes', async () => {
    const mockWebSocket = new MockWebSocketSender();
    const eventSync = new LiveStoreEventSyncService(
      mockLiveStore,
      mockWebSocket,
      'test-org',
      'test-client'
    );
    
    // Test event conversion
    const tableChange = eventSync.convertToTableChange({
      type: 'ProjectCreated',
      data: { id: '123', name: 'Test Project' }
    });
    
    expect(tableChange).toEqual({
      table: 'projects',
      operation: 'insert', 
      data: { id: '123', name: 'Test Project', clientId: 'test-client' },
      // ...
    });
  });
});
```

### Integration Tests

```typescript
describe('LiveStore Event Sync Integration', () => {
  test('syncs events end-to-end', async () => {
    // Set up test environment
    const { liveStore, webSocket } = await setupTestEnvironment();
    
    const eventSync = await createLiveStoreEventSync({
      orgId: 'test-org',
      liveStoreInstance: liveStore,
      webSocketSender: webSocket,
      clientId: 'test-client'
    });
    
    // Trigger event
    await liveStore.commit(events.projectCreated({
      id: '123',
      name: 'Test Project'
    }));
    
    // Verify sync
    await waitFor(() => {
      expect(webSocket.sentMessages).toHaveLength(1);
      expect(webSocket.sentMessages[0].table).toBe('projects');
    });
  });
});
```

## Monitoring and Debugging

### Status Monitoring

```typescript
// Check event sync status
const status = eventSync.getStatus();
console.log('Event Sync Status:', {
  running: status.running,
  orgId: status.orgId,
  eventsProcessed: status.eventsProcessed
});
```

### Debug Logging

Enable detailed logging by setting:

```typescript
// In development
localStorage.setItem('debug', 'LiveStoreEventSync*');

// Or via environment
process.env.DEBUG = 'LiveStoreEventSync*';
```

### Performance Monitoring

```typescript
// Track event processing metrics
window.addEventListener('livestore:event:synced', (event) => {
  const { type, latency, success } = event.detail;
  
  // Send to analytics
  analytics.track('LiveStore Event Synced', {
    eventType: type,
    latency,
    success
  });
});
```

## Troubleshooting

### Common Issues

**1. Events not syncing**
```typescript
// Check if event sync is running
const status = eventSync.getStatus();
if (!status.running) {
  await eventSync.startEventSync();
}
```

**2. Unknown event types**
```typescript
// Add custom event type parsing
private parseEventType(eventType: string) {
  // Add your custom patterns here
  if (eventType.startsWith('CUSTOM_')) {
    // Handle custom event types
  }
  
  return super.parseEventType(eventType);
}
```

**3. WebSocket connection issues**
```typescript
// The event sync will continue working
// Your existing WebSocket retry logic handles reconnection
// Events are queued by LiveStore's native mechanisms
```

## Benefits Summary

✅ **Simplified Architecture**: Remove complex sync bridges  
✅ **No Sync Loops**: LiveStore's rebase prevents them automatically  
✅ **Better Performance**: Native event streaming vs polling  
✅ **Type Safety**: Full TypeScript support  
✅ **Backward Compatible**: Same WebSocket interface  
✅ **Future Proof**: Uses LiveStore as designed  

## Next Steps

1. **Implement parallel testing** to validate the approach
2. **Gradual rollout** per organization
3. **Monitor performance** and error rates
4. **Remove Dexie dependencies** after full validation
5. **Optimize event types** based on usage patterns

---

**Ready to integrate!** The LiveStore event sync provides a much cleaner foundation for your multi-tenant sync architecture.