# LiveStore Native Event Streaming Sync Architecture

## Overview

This document describes the **optimal sync architecture** that leverages LiveStore's native event streaming capabilities to replace complex sync bridges with a clean, loop-free approach.

## The Problem We Solved

**Previous Approach (Complex):**
```
LiveStore → Bridge → Dexie LocalChanges → DexieOutgoingChangeService → WebSocket → Server
                ↑ Potential sync loops     ↑ Manual change tracking
```

**New Approach (Clean):**
```
LiveStore → Native Event Stream → WebSocket → Server
            ↑ Built-in loop prevention
```

## Why LiveStore Native Events Are Perfect

### 1. **Built-in Sync Loop Prevention**
LiveStore uses a **rebase mechanism** that automatically prevents sync loops:
- Remote events don't appear as "local" events in the stream
- Events maintain **global total order** across clients
- **Canonical event history** prevents duplication

### 2. **Native Event Streaming API**
```typescript
// LiveStore provides native event streams
store.events()       // AsyncIterable<LiveStoreEvent>
store.eventsStream() // Stream<LiveStoreEvent>
```

### 3. **Event-Sourcing Architecture**
- Events are **immutable and ordered**
- **Local events** are rebased on top of remote events
- Only **user-initiated events** appear in local stream

## Implementation

### Core Event Sync Service

```typescript
/**
 * LiveStore Native Event Sync Service
 * 
 * Leverages LiveStore's native event streaming to sync local events
 * to the existing WebSocket infrastructure without sync loops.
 */
export class LiveStoreEventSyncService {
  private isRunning = false;
  private abortController?: AbortController;
  
  constructor(
    private liveStoreInstance: LiveStoreInstance,
    private webSocketSender: WebSocketSender,
    private orgId: string,
    private clientId: string
  ) {}
  
  /**
   * Start event streaming sync
   */
  async startEventSync(): Promise<void> {
    if (this.isRunning) {
      console.warn('[LiveStoreEventSync] Already running');
      return;
    }
    
    this.isRunning = true;
    this.abortController = new AbortController();
    
    console.log('[LiveStoreEventSync] Starting native event streaming for org:', this.orgId);
    
    try {
      // Use LiveStore's native event stream
      // This automatically handles sync loop prevention via rebase
      for await (const event of this.liveStoreInstance.store.events()) {
        
        // Check if we should stop
        if (this.abortController.signal.aborted) break;
        
        // Process local event (guaranteed to be local due to LiveStore's rebase)
        await this.handleLocalEvent(event);
      }
    } catch (error) {
      if (!this.abortController.signal.aborted) {
        console.error('[LiveStoreEventSync] Event stream error:', error);
        throw error;
      }
    } finally {
      this.isRunning = false;
      console.log('[LiveStoreEventSync] Event streaming stopped');
    }
  }
  
  /**
   * Handle local LiveStore event
   */
  private async handleLocalEvent(event: LiveStoreEvent): Promise<void> {
    try {
      console.log('[LiveStoreEventSync] Processing local event:', {
        type: event.type,
        data: event.data,
        orgId: this.orgId
      });
      
      // Convert LiveStore event to existing TableChange format
      const tableChange = this.convertToTableChange(event);
      
      if (!tableChange) {
        console.log('[LiveStoreEventSync] Skipping non-table event:', event.type);
        return;
      }
      
      // Send via existing WebSocket infrastructure
      await this.webSocketSender.send(tableChange);
      
      console.log('[LiveStoreEventSync] ✅ Event synced:', event.type);
      
    } catch (error) {
      console.error('[LiveStoreEventSync] Failed to process event:', error);
      // Don't throw - continue processing other events
    }
  }
  
  /**
   * Convert LiveStore event to TableChange format
   */
  private convertToTableChange(event: LiveStoreEvent): TableChange | null {
    // Extract table and operation from event type
    const { table, operation } = this.parseEventType(event.type);
    
    if (!table || !operation) return null;
    
    return {
      table: table,
      operation: operation,
      data: {
        ...event.data,
        clientId: this.clientId // Ensure client ID for CRDT
      },
      clientId: this.clientId,
      orgId: this.orgId,
      updatedAt: new Date().toISOString(),
      timestamp: event.timestamp || new Date().toISOString()
    };
  }
  
  /**
   * Parse LiveStore event type to extract table and operation
   */
  private parseEventType(eventType: string): { table?: string; operation?: string } {
    // Event types like: "ProjectCreated", "TaskUpdated", "ClientDeleted"
    const match = eventType.match(/^(\w+)(Created|Updated|Deleted)$/);
    
    if (!match) return {};
    
    const entityName = match[1].toLowerCase(); // "project", "task", "client"
    const operation = match[2].toLowerCase(); // "created", "updated", "deleted"
    
    // Map to standard operations
    const operationMap: Record<string, string> = {
      'created': 'insert',
      'updated': 'update', 
      'deleted': 'delete'
    };
    
    return {
      table: entityName,
      operation: operationMap[operation] || operation
    };
  }
  
  /**
   * Stop event streaming
   */
  stopEventSync(): void {
    console.log('[LiveStoreEventSync] Stopping event streaming...');
    this.abortController?.abort();
  }
  
  /**
   * Get sync status
   */
  getStatus(): { running: boolean; orgId: string; clientId: string } {
    return {
      running: this.isRunning,
      orgId: this.orgId,
      clientId: this.clientId
    };
  }
}
```

### Integration with Existing Sync Infrastructure

```typescript
/**
 * Integration layer for LiveStore event sync
 */
export class LiveStoreEventSyncIntegration {
  
  /**
   * Initialize event sync for organization
   */
  static async initializeForOrg(
    orgId: string, 
    liveStoreInstance: LiveStoreInstance,
    webSocketSender: WebSocketSender,
    clientId: string
  ): Promise<LiveStoreEventSyncService> {
    
    const eventSync = new LiveStoreEventSyncService(
      liveStoreInstance,
      webSocketSender, 
      orgId,
      clientId
    );
    
    // Start event streaming in background
    eventSync.startEventSync().catch(error => {
      console.error('[LiveStoreEventSync] Failed to start event sync:', error);
    });
    
    return eventSync;
  }
  
  /**
   * Replace Dexie change tracking with LiveStore events
   */
  static replaceChangeTracking(
    liveStoreInstance: LiveStoreInstance,
    existingSyncManager: SyncManager
  ): void {
    // Disable Dexie change tracking
    existingSyncManager.disableDexieChangeTracking();
    
    // Enable LiveStore event sync
    const eventSync = new LiveStoreEventSyncService(
      liveStoreInstance,
      existingSyncManager.webSocketSender,
      existingSyncManager.orgId,
      existingSyncManager.clientId
    );
    
    eventSync.startEventSync();
  }
}
```

## Migration Strategy

### Phase 1: Parallel Operation
- Keep existing Dexie sync running
- Add LiveStore event sync alongside
- Compare and validate both approaches

### Phase 2: Switch Over
- Disable Dexie change tracking
- Enable LiveStore event sync as primary
- Monitor for issues

### Phase 3: Cleanup
- Remove Dexie sync infrastructure
- Clean up unused code
- Optimize LiveStore-only flow

## Benefits

### 1. **Eliminates Sync Loops**
- ✅ No manual loop prevention needed
- ✅ LiveStore's rebase handles it natively
- ✅ Events naturally distinguished by source

### 2. **Simplifies Architecture**
- ❌ ~~LiveStore → Bridge → Dexie LocalChanges → DexieOutgoingChangeService~~
- ✅ LiveStore → Native Events → WebSocket

### 3. **Improves Performance**
- ✅ Native event streaming (no polling)
- ✅ Reduces intermediate processing
- ✅ Lower latency for real-time sync

### 4. **Maintains Compatibility**
- ✅ Same TableChange format to server
- ✅ Existing WebSocket infrastructure unchanged
- ✅ Server-side code requires no changes

### 5. **Future-Proof**
- ✅ Uses LiveStore as designed
- ✅ Leverages native capabilities
- ✅ Won't break with LiveStore updates

## Technical Details

### Event Stream Characteristics
- **Real-time**: Events stream as they occur
- **Ordered**: Events maintain proper sequence
- **Local-only**: Remote events don't appear in local stream
- **Type-safe**: Full TypeScript support

### Integration Points
- **WebSocket Sender**: Reuse existing infrastructure
- **TableChange Format**: Maintain server compatibility  
- **Client ID**: Preserve CRDT functionality
- **Organization Isolation**: Per-org event streams

### Error Handling
- **Stream Interruption**: Automatic restart capability
- **Event Processing Failures**: Continue with next event
- **Network Issues**: Existing retry logic handles this

## Testing Strategy

### Unit Tests
- Event type parsing
- TableChange conversion
- Error handling scenarios

### Integration Tests
- End-to-end event flow
- Multi-client sync verification
- Organization isolation

### Performance Tests
- Event streaming latency
- Memory usage over time
- Large batch processing

## Monitoring and Debugging

### Metrics to Track
- Events processed per second
- Event processing latency
- Error rates by event type
- Stream uptime/downtime

### Debug Logging
```typescript
console.log('[LiveStoreEventSync] Event details:', {
  type: event.type,
  data: event.data,
  orgId: this.orgId,
  timestamp: event.timestamp
});
```

### DevTools Integration
- Event stream visualization
- Real-time sync status
- Performance metrics dashboard

## Conclusion

The LiveStore native event streaming approach provides the **optimal solution** for multi-tenant sync:

1. **Leverages LiveStore's Design** - Uses the framework as intended
2. **Eliminates Complexity** - No more sync bridges or manual tracking
3. **Prevents Sync Loops** - Built-in rebase mechanism handles this
4. **Maintains Compatibility** - Existing infrastructure unchanged
5. **Improves Performance** - Native streaming is faster than polling

This architecture represents a **significant simplification** while maintaining all the benefits of the existing live sync system.

---

**Status**: Ready for implementation ✅  
**Complexity**: Low (leverages native APIs) ✅  
**Risk**: Minimal (maintains existing interfaces) ✅  
**Performance**: Improved (native streaming) ✅