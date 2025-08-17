/**
 * LiveStore Native Event Sync Service
 * 
 * Leverages LiveStore's native event streaming to sync local events
 * to the existing WebSocket infrastructure without sync loops.
 * 
 * Key Benefits:
 * - Uses LiveStore's built-in rebase to prevent sync loops
 * - Native event streaming for real-time sync
 * - Maintains compatibility with existing sync infrastructure
 */

import type { LiveStoreInstance } from './livestore-schema-client';
import type { TableChange } from '@repo/sync-types';

// LiveStore event type (based on TypeScript definitions)
interface LiveStoreEvent {
  type: string;
  data: any;
  timestamp?: string;
  sequenceNumber?: number;
  clientId?: string;
}

// WebSocket sender interface (matches existing)
interface WebSocketSender {
  send(message: TableChange): Promise<void>;
}

/**
 * LiveStore Native Event Sync Service
 * 
 * Replaces complex Dexie-based sync bridges with clean native event streaming
 */
export class LiveStoreEventSyncService {
  private isRunning = false;
  private abortController?: AbortController;
  private eventCount = 0;
  
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
      console.warn('[LiveStoreEventSync] Already running for org:', this.orgId);
      return;
    }
    
    this.isRunning = true;
    this.abortController = new AbortController();
    this.eventCount = 0;
    
    console.log('[LiveStoreEventSync] 🚀 Starting native event streaming for org:', this.orgId);
    
    try {
      // Use LiveStore's native event stream
      // This automatically handles sync loop prevention via rebase mechanism
      for await (const event of this.liveStoreInstance.store.events()) {
        
        // Check if we should stop
        if (this.abortController.signal.aborted) {
          console.log('[LiveStoreEventSync] Stopping due to abort signal');
          break;
        }
        
        // Process local event (guaranteed to be local due to LiveStore's rebase)
        await this.handleLocalEvent(event);
        this.eventCount++;
      }
    } catch (error) {
      if (!this.abortController.signal.aborted) {
        console.error('[LiveStoreEventSync] ❌ Event stream error:', error);
        throw error;
      }
    } finally {
      this.isRunning = false;
      console.log('[LiveStoreEventSync] 🔌 Event streaming stopped. Processed', this.eventCount, 'events');
    }
  }
  
  /**
   * Handle local LiveStore event
   * 
   * Note: These are guaranteed to be local events due to LiveStore's
   * rebase mechanism that prevents remote events from appearing here
   */
  private async handleLocalEvent(event: LiveStoreEvent): Promise<void> {
    try {
      console.log('[LiveStoreEventSync] 📤 Processing local event:', {
        type: event.type,
        hasData: !!event.data,
        orgId: this.orgId,
        sequenceNumber: event.sequenceNumber
      });
      
      // Convert LiveStore event to existing TableChange format
      const tableChange = this.convertToTableChange(event);
      
      if (!tableChange) {
        console.log('[LiveStoreEventSync] ⏭️ Skipping non-table event:', event.type);
        return;
      }
      
      // Send via existing WebSocket infrastructure (no changes needed!)
      await this.webSocketSender.send(tableChange);
      
      console.log('[LiveStoreEventSync] ✅ Event synced:', {
        type: event.type,
        table: tableChange.table,
        operation: tableChange.operation,
        entityId: tableChange.data?.id
      });
      
    } catch (error) {
      console.error('[LiveStoreEventSync] ❌ Failed to process event:', error);
      // Don't throw - continue processing other events
    }
  }
  
  /**
   * Convert LiveStore event to TableChange format
   * 
   * This maintains compatibility with existing sync infrastructure
   */
  private convertToTableChange(event: LiveStoreEvent): TableChange | null {
    // Extract table and operation from event type
    const { table, operation } = this.parseEventType(event.type);
    
    if (!table || !operation) {
      console.log('[LiveStoreEventSync] Cannot parse event type:', event.type);
      return null;
    }
    
    // Ensure data includes client ID for CRDT functionality
    const dataWithClientId = {
      ...event.data,
      clientId: this.clientId
    };
    
    return {
      table: table,
      operation: operation,
      data: dataWithClientId,
      clientId: this.clientId,
      orgId: this.orgId,
      updatedAt: new Date().toISOString(),
      timestamp: event.timestamp || new Date().toISOString()
    };
  }
  
  /**
   * Parse LiveStore event type to extract table and operation
   * 
   * Expected format: "EntityNameOperation" (e.g., "ProjectCreated", "TaskUpdated")
   */
  private parseEventType(eventType: string): { table?: string; operation?: string } {
    // Handle various event type patterns
    const patterns = [
      // Standard pattern: "ProjectCreated", "TaskUpdated", "ClientDeleted"
      /^(\w+)(Created|Updated|Deleted)$/,
      // Alternative pattern: "project.created", "task.updated"
      /^(\w+)\.(created|updated|deleted)$/i,
      // Another pattern: "CREATE_PROJECT", "UPDATE_TASK"
      /^(CREATE|UPDATE|DELETE)_(\w+)$/i
    ];
    
    for (const pattern of patterns) {
      const match = eventType.match(pattern);
      if (match) {
        let entityName: string;
        let operation: string;
        
        if (pattern.source.includes('CREATE|UPDATE|DELETE')) {
          // Pattern: "CREATE_PROJECT" -> operation="CREATE", entity="PROJECT"
          operation = match[1].toLowerCase();
          entityName = match[2].toLowerCase();
        } else {
          // Pattern: "ProjectCreated" -> entity="Project", operation="Created"
          entityName = match[1].toLowerCase();
          operation = match[2].toLowerCase();
        }
        
        // Map entity names to table names (handle pluralization)
        const tableMap: Record<string, string> = {
          'project': 'projects',
          'task': 'tasks', 
          'client': 'clients',
          'timesheet': 'timesheets',
          'skill': 'skills',
          'user': 'users',
          'comment': 'comments'
        };
        
        // Map operations to standard format
        const operationMap: Record<string, string> = {
          'created': 'insert',
          'create': 'insert',
          'updated': 'update',
          'update': 'update',
          'deleted': 'delete',
          'delete': 'delete'
        };
        
        const table = tableMap[entityName] || entityName;
        const mappedOperation = operationMap[operation] || operation;
        
        return { table, operation: mappedOperation };
      }
    }
    
    console.warn('[LiveStoreEventSync] Unknown event type format:', eventType);
    return {};
  }
  
  /**
   * Stop event streaming gracefully
   */
  stopEventSync(): void {
    console.log('[LiveStoreEventSync] 🛑 Stopping event streaming for org:', this.orgId);
    this.abortController?.abort();
  }
  
  /**
   * Get current sync status
   */
  getStatus(): { 
    running: boolean; 
    orgId: string; 
    clientId: string; 
    eventsProcessed: number;
  } {
    return {
      running: this.isRunning,
      orgId: this.orgId,
      clientId: this.clientId,
      eventsProcessed: this.eventCount
    };
  }
  
  /**
   * Reset event counter (for testing/debugging)
   */
  resetEventCount(): void {
    this.eventCount = 0;
  }
}

/**
 * Integration utilities for LiveStore event sync
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
    
    console.log('[LiveStoreEventSync] 🔧 Initializing event sync for org:', orgId);
    
    const eventSync = new LiveStoreEventSyncService(
      liveStoreInstance,
      webSocketSender, 
      orgId,
      clientId
    );
    
    // Start event streaming in background
    eventSync.startEventSync().catch(error => {
      console.error('[LiveStoreEventSync] ❌ Failed to start event sync:', error);
    });
    
    console.log('[LiveStoreEventSync] ✅ Event sync initialized for org:', orgId);
    return eventSync;
  }
  
  /**
   * Create event sync service without auto-starting
   * (useful for testing or manual control)
   */
  static createEventSync(
    orgId: string,
    liveStoreInstance: LiveStoreInstance, 
    webSocketSender: WebSocketSender,
    clientId: string
  ): LiveStoreEventSyncService {
    
    return new LiveStoreEventSyncService(
      liveStoreInstance,
      webSocketSender,
      orgId, 
      clientId
    );
  }
}

// Export types for external use
export type { LiveStoreEvent, WebSocketSender };

/**
 * Factory function for easy integration
 */
export async function createLiveStoreEventSync(
  config: {
    orgId: string;
    liveStoreInstance: LiveStoreInstance;
    webSocketSender: WebSocketSender;
    clientId: string;
    autoStart?: boolean;
  }
): Promise<LiveStoreEventSyncService> {
  
  const { orgId, liveStoreInstance, webSocketSender, clientId, autoStart = true } = config;
  
  const eventSync = new LiveStoreEventSyncService(
    liveStoreInstance,
    webSocketSender,
    orgId,
    clientId
  );
  
  if (autoStart) {
    await eventSync.startEventSync();
  }
  
  return eventSync;
}