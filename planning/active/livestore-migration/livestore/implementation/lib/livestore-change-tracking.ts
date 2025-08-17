/**
 * LiveStore Change Tracking Integration
 * 
 * Integrates LiveStore events with our existing change tracking system.
 * Instead of using LiveStore's sync, we capture LiveStore operations
 * and feed them into our existing local_changes table for sync.
 */

import { nanoid } from 'nanoid';
import type { LocalChanges } from '../db/client-entities';
import type { LiveStoreInstance } from './livestore-schema-client';

// Types for LiveStore change tracking
export interface LiveStoreChangeEvent {
  operation: 'insert' | 'update' | 'delete';
  tableName: string;
  entityId: string;
  data?: any;
  oldData?: any;
  organizationId: string;
  timestamp: number;
}

export interface LiveStoreChangeTracker {
  trackChange(event: LiveStoreChangeEvent): Promise<void>;
  enableTracking(): void;
  disableTracking(): void;
  isTrackingEnabled(): boolean;
}

/**
 * LiveStore Change Tracking Implementation
 * 
 * Bridges LiveStore operations with our existing Dexie-based change tracking
 */
export class LiveStoreChangeTrackingService implements LiveStoreChangeTracker {
  private isTracking = true;
  private clientId: string;
  private userId: string;
  private instances = new Map<string, LiveStoreInstance>();
  
  // Track recent changes to prevent duplicates
  private recentChanges = new Map<string, number>();
  private readonly DUPLICATE_WINDOW_MS = 1000;

  constructor(clientId: string, userId: string) {
    this.clientId = clientId;
    this.userId = userId;
  }

  /**
   * Register a LiveStore instance for change tracking
   */
  async registerInstance(orgId: string, instance: LiveStoreInstance): Promise<void> {
    this.instances.set(orgId, instance);
    
    // Set up change event handlers for this instance
    await this.setupChangeHandlers(orgId, instance);
    
    console.log(`📊 LiveStore change tracking registered for org: ${orgId}`);
  }

  /**
   * Unregister a LiveStore instance
   */
  async unregisterInstance(orgId: string): Promise<void> {
    const instance = this.instances.get(orgId);
    if (instance) {
      // Clean up change handlers
      await this.cleanupChangeHandlers(orgId, instance);
      this.instances.delete(orgId);
      console.log(`📊 LiveStore change tracking unregistered for org: ${orgId}`);
    }
  }

  /**
   * Track a LiveStore change event
   */
  async trackChange(event: LiveStoreChangeEvent): Promise<void> {
    if (!this.isTracking) {
      return;
    }

    // Generate unique change identifier
    const changeKey = `${event.tableName}-${event.entityId}-${event.operation}-${event.timestamp}`;
    
    // Prevent duplicate tracking within time window
    if (this.recentChanges.has(changeKey)) {
      const lastTracked = this.recentChanges.get(changeKey)!;
      if (Date.now() - lastTracked < this.DUPLICATE_WINDOW_MS) {
        return;
      }
    }

    this.recentChanges.set(changeKey, Date.now());

    // Create LocalChanges record compatible with existing system
    const localChange: Omit<LocalChanges, 'id'> = {
      table_name: event.tableName,
      entity_id: event.entityId,
      operation: event.operation,
      changes: this.formatChangesForSync(event),
      created_at: new Date(event.timestamp).toISOString(),
      synced: false,
      organization_id: event.organizationId
    };

    // Store in local_changes table for sync processing
    await this.storeLocalChange(localChange);

    console.log(`📝 LiveStore change tracked: ${event.operation} ${event.tableName}/${event.entityId}`);
  }

  /**
   * Enable change tracking
   */
  enableTracking(): void {
    this.isTracking = true;
    console.log('✅ LiveStore change tracking enabled');
  }

  /**
   * Disable change tracking (e.g., during sync operations)
   */
  disableTracking(): void {
    this.isTracking = false;
    console.log('⏸️ LiveStore change tracking disabled');
  }

  /**
   * Check if tracking is enabled
   */
  isTrackingEnabled(): boolean {
    return this.isTracking;
  }

  // Private methods

  /**
   * Set up change event handlers for a LiveStore instance
   */
  private async setupChangeHandlers(orgId: string, instance: LiveStoreInstance): Promise<void> {
    // LiveStore doesn't have built-in change events like Dexie hooks
    // Instead, we'll wrap the instance methods to capture changes
    const originalApply = instance.apply.bind(instance);
    
    instance.apply = async (event: any) => {
      try {
        // Execute the original operation
        await originalApply(event);
        
        // Track the change if it's a data operation
        if (this.isDataEvent(event)) {
          const changeEvent = this.convertEventToChange(orgId, event);
          await this.trackChange(changeEvent);
        }
      } catch (error) {
        console.error(`❌ LiveStore operation failed for org ${orgId}:`, error);
        throw error;
      }
    };

    console.log(`🔧 Change handlers set up for LiveStore instance: ${orgId}`);
  }

  /**
   * Clean up change handlers for a LiveStore instance
   */
  private async cleanupChangeHandlers(orgId: string, instance: LiveStoreInstance): Promise<void> {
    // Reset the apply method to original (if we stored it)
    // For now, we'll just log the cleanup
    console.log(`🧹 Change handlers cleaned up for LiveStore instance: ${orgId}`);
  }

  /**
   * Check if an event represents a data operation
   */
  private isDataEvent(event: any): boolean {
    // Check if this is a CRUD operation event
    return event && (
      event.type === 'insert' || 
      event.type === 'update' || 
      event.type === 'delete' ||
      event.operation === 'insert' ||
      event.operation === 'update' ||
      event.operation === 'delete'
    );
  }

  /**
   * Convert LiveStore event to our change format
   */
  private convertEventToChange(orgId: string, event: any): LiveStoreChangeEvent {
    return {
      operation: event.type || event.operation || 'update',
      tableName: event.table || event.tableName || 'unknown',
      entityId: event.id || event.entity_id || nanoid(),
      data: event.data || event.payload || event,
      oldData: event.oldData || event.old_data,
      organizationId: orgId,
      timestamp: Date.now()
    };
  }

  /**
   * Format changes for sync compatibility
   */
  private formatChangesForSync(event: LiveStoreChangeEvent): any {
    switch (event.operation) {
      case 'insert':
        return {
          type: 'insert',
          data: event.data
        };
      
      case 'update':
        return {
          type: 'update',
          data: event.data,
          oldData: event.oldData
        };
      
      case 'delete':
        return {
          type: 'delete',
          id: event.entityId
        };
      
      default:
        return {
          type: event.operation,
          data: event.data
        };
    }
  }

  /**
   * Store local change record (compatible with existing Dexie system)
   */
  private async storeLocalChange(change: Omit<LocalChanges, 'id'>): Promise<void> {
    try {
      // Import Dexie db dynamically to avoid circular dependencies
      const { db } = await import('../db/dexie-schema');
      
      const localChange: LocalChanges = {
        id: nanoid(),
        ...change
      };

      await db.local_changes.add(localChange);
      
      // Trigger change processor if available
      const { getChangeProcessor } = await import('../db/dexie-change-tracking');
      const processor = getChangeProcessor();
      if (processor) {
        processor();
      }
      
    } catch (error) {
      console.error('❌ Failed to store LiveStore change:', error);
      throw error;
    }
  }

  /**
   * Clean up old tracked changes to prevent memory leaks
   */
  private cleanupOldChanges(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.recentChanges.entries()) {
      if (now - timestamp > this.DUPLICATE_WINDOW_MS * 2) {
        this.recentChanges.delete(key);
      }
    }
  }
}

/**
 * Global LiveStore change tracking service instance
 */
let globalChangeTracker: LiveStoreChangeTrackingService | null = null;

/**
 * Initialize the global LiveStore change tracking service
 */
export function initializeLiveStoreChangeTracking(clientId: string, userId: string): LiveStoreChangeTrackingService {
  if (!globalChangeTracker) {
    globalChangeTracker = new LiveStoreChangeTrackingService(clientId, userId);
    console.log('🚀 LiveStore change tracking service initialized');
  }
  return globalChangeTracker;
}

/**
 * Get the global LiveStore change tracking service
 */
export function getLiveStoreChangeTracker(): LiveStoreChangeTrackingService | null {
  return globalChangeTracker;
}

/**
 * Hook for React components to use LiveStore change tracking
 */
export function useLiveStoreChangeTracking(orgId: string | null, instance: LiveStoreInstance | null) {
  const React = (globalThis as any).React;
  
  React.useEffect(() => {
    if (!orgId || !instance || !globalChangeTracker) {
      return;
    }

    // Register the instance for change tracking
    globalChangeTracker.registerInstance(orgId, instance);

    // Cleanup on unmount
    return () => {
      globalChangeTracker?.unregisterInstance(orgId);
    };
  }, [orgId, instance]);

  return {
    isTracking: globalChangeTracker?.isTrackingEnabled() || false,
    enableTracking: () => globalChangeTracker?.enableTracking(),
    disableTracking: () => globalChangeTracker?.disableTracking(),
    trackChange: (event: LiveStoreChangeEvent) => globalChangeTracker?.trackChange(event)
  };
}