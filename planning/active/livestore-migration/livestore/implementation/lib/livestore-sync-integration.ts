/**
 * LiveStore Sync Integration
 * Bridges LiveStore real-time capabilities with the existing Dexie sync system
 */

import { db } from '../db/dexie-init';
import { getLiveStoreClient } from './livestore-client';
import type { AccessControlClient } from '@vibestack/livestore/client/AccessControlClient';

// Sync event types that LiveStore should handle
export interface LiveStoreSyncEvent {
  type: 'entity_changed' | 'permission_updated' | 'organization_changed' | 'sync_status_changed';
  entityType?: string;
  entityId?: string;
  organizationId?: string;
  userId?: string;
  data?: any;
  timestamp: Date;
}

// LiveStore sync manager
class LiveStoreSyncManager {
  private client: AccessControlClient | null = null;
  private eventListeners: Map<string, Set<(event: LiveStoreSyncEvent) => void>> = new Map();
  private isActive = false;

  /**
   * Initialize sync integration
   */
  async initialize(): Promise<void> {
    if (this.isActive) return;

    this.client = getLiveStoreClient();
    if (!this.client) {
      console.warn('LiveStore client not available for sync integration');
      return;
    }

    this.setupDexieChangeListeners();
    this.setupLiveStoreEventHandlers();
    this.isActive = true;

    console.log('✅ LiveStore sync integration initialized');
  }

  /**
   * Set up Dexie change listeners to propagate to LiveStore
   */
  private setupDexieChangeListeners(): void {
    // Listen for Dexie table changes and propagate to LiveStore
    const tables = ['projects', 'tasks', 'comments', 'users'];
    
    tables.forEach(tableName => {
      try {
        // Hook into Dexie table changes
        const table = (db as any)[tableName.slice(0, -1)]; // Remove 's' for table name
        if (!table) {
          console.warn(`Table ${tableName} not found in Dexie schema`);
          return;
        }

        // Listen for changes
        table.hook('creating', (primKey: any, obj: any, trans: any) => {
          this.handleDexieChange('creating', tableName, primKey, obj);
        });

        table.hook('updating', (modifications: any, primKey: any, obj: any, trans: any) => {
          this.handleDexieChange('updating', tableName, primKey, obj, modifications);
        });

        table.hook('deleting', (primKey: any, obj: any, trans: any) => {
          this.handleDexieChange('deleting', tableName, primKey, obj);
        });

      } catch (error) {
        console.error(`Failed to set up change listener for ${tableName}:`, error);
      }
    });
  }

  /**
   * Handle Dexie table changes
   */
  private async handleDexieChange(
    operation: 'creating' | 'updating' | 'deleting',
    tableName: string,
    primKey: any,
    obj: any,
    modifications?: any
  ): Promise<void> {
    try {
      // Check if this change should be propagated via LiveStore
      const shouldPropagate = await this.shouldPropagateChange(tableName, obj);
      if (!shouldPropagate) return;

      // Create sync event
      const syncEvent: LiveStoreSyncEvent = {
        type: 'entity_changed',
        entityType: this.mapTableToEntityType(tableName),
        entityId: primKey?.toString(),
        organizationId: obj?.organizationId || 'default-org',
        userId: obj?.userId || obj?.createdBy || 'system',
        data: {
          operation,
          entity: obj,
          modifications,
          tableName
        },
        timestamp: new Date()
      };

      // Emit the event
      this.emitSyncEvent(syncEvent);

      console.log(`📡 Propagated ${operation} for ${tableName}:${primKey} via LiveStore`);

    } catch (error) {
      console.error(`Error handling Dexie change for ${tableName}:`, error);
    }
  }

  /**
   * Set up LiveStore event handlers
   */
  private setupLiveStoreEventHandlers(): void {
    if (!this.client) return;

    // Listen for permission changes from LiveStore
    this.client.addEventListener('permission_change', (event) => {
      this.handleLiveStorePermissionChange(event);
    });

    // Listen for context updates from LiveStore
    this.client.addEventListener('context_update', (event) => {
      this.handleLiveStoreContextUpdate(event);
    });

    // Listen for real-time entity updates from LiveStore
    window.addEventListener('livestore:entity:updated', (event: CustomEvent) => {
      this.handleLiveStoreEntityUpdate(event.detail);
    });
  }

  /**
   * Handle permission changes from LiveStore
   */
  private async handleLiveStorePermissionChange(event: any): Promise<void> {
    console.log('🔐 LiveStore permission change:', event);

    // Create sync event for permission update
    const syncEvent: LiveStoreSyncEvent = {
      type: 'permission_updated',
      userId: event.payload?.userId,
      organizationId: event.payload?.organizationId,
      data: {
        changes: event.payload?.changes,
        reason: event.payload?.reason
      },
      timestamp: new Date()
    };

    this.emitSyncEvent(syncEvent);

    // Refresh any cached permission-dependent data
    await this.refreshPermissionDependentData();
  }

  /**
   * Handle context updates from LiveStore
   */
  private async handleLiveStoreContextUpdate(event: any): Promise<void> {
    console.log('📝 LiveStore context update:', event);

    // Create sync event for context update
    const syncEvent: LiveStoreSyncEvent = {
      type: 'organization_changed',
      organizationId: event.payload?.organizationId,
      data: event.payload,
      timestamp: new Date()
    };

    this.emitSyncEvent(syncEvent);
  }

  /**
   * Handle real-time entity updates from LiveStore
   */
  private async handleLiveStoreEntityUpdate(data: any): Promise<void> {
    try {
      const { entityType, entityId, operation, entityData } = data;

      // Apply the update to local Dexie database
      await this.applyEntityUpdateToDexie(entityType, entityId, operation, entityData);

      // Create sync event
      const syncEvent: LiveStoreSyncEvent = {
        type: 'entity_changed',
        entityType,
        entityId,
        organizationId: entityData?.organizationId,
        data: {
          operation,
          entity: entityData,
          source: 'livestore'
        },
        timestamp: new Date()
      };

      this.emitSyncEvent(syncEvent);

    } catch (error) {
      console.error('Error handling LiveStore entity update:', error);
    }
  }

  /**
   * Apply entity update to local Dexie database
   */
  private async applyEntityUpdateToDexie(
    entityType: string,
    entityId: string,
    operation: string,
    entityData: any
  ): Promise<void> {
    const tableName = this.mapEntityTypeToTable(entityType);
    const table = (db as any)[tableName];
    
    if (!table) {
      console.warn(`Table ${tableName} not found for entity type ${entityType}`);
      return;
    }

    try {
      switch (operation) {
        case 'create':
          await table.add(entityData);
          break;
        case 'update':
          await table.update(entityId, entityData);
          break;
        case 'delete':
          await table.delete(entityId);
          break;
        default:
          console.warn(`Unknown operation: ${operation}`);
      }

      console.log(`✅ Applied ${operation} for ${entityType}:${entityId} to Dexie`);

    } catch (error) {
      console.error(`Failed to apply ${operation} for ${entityType}:${entityId}:`, error);
    }
  }

  /**
   * Check if a change should be propagated via LiveStore
   */
  private async shouldPropagateChange(tableName: string, obj: any): Promise<boolean> {
    // Don't propagate local-only changes
    if (obj?.localOnly) return false;
    
    // Don't propagate system changes
    if (obj?.source === 'system') return false;

    // Check if user has permission to propagate this change
    if (this.client) {
      const entityType = this.mapTableToEntityType(tableName);
      const hasPermission = await this.client.hasPermission(entityType, 'write');
      return hasPermission.granted;
    }

    return true;
  }

  /**
   * Refresh permission-dependent data
   */
  private async refreshPermissionDependentData(): Promise<void> {
    // Clear cached queries that depend on permissions
    // This would trigger re-evaluation of permission-filtered data
    
    // Emit event for components to refresh
    window.dispatchEvent(new CustomEvent('permissions:refreshed'));
  }

  /**
   * Map table names to entity types
   */
  private mapTableToEntityType(tableName: string): string {
    const mapping: Record<string, string> = {
      'projects': 'project',
      'tasks': 'task',
      'comments': 'comment',
      'users': 'user',
      'project_tag_sets': 'project_tag_set',
      'task_tags': 'task_tag'
    };
    return mapping[tableName] || tableName;
  }

  /**
   * Map entity types to table names
   */
  private mapEntityTypeToTable(entityType: string): string {
    const mapping: Record<string, string> = {
      'project': 'project',
      'task': 'task',
      'comment': 'comments',
      'user': 'user',
      'project_tag_set': 'project_tag_sets',
      'task_tag': 'task_tags'
    };
    return mapping[entityType] || entityType;
  }

  /**
   * Subscribe to sync events
   */
  subscribe(eventType: string, callback: (event: LiveStoreSyncEvent) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    
    this.eventListeners.get(eventType)!.add(callback);
    
    return () => {
      this.eventListeners.get(eventType)?.delete(callback);
    };
  }

  /**
   * Emit sync event to subscribers
   */
  private emitSyncEvent(event: LiveStoreSyncEvent): void {
    const listeners = this.eventListeners.get(event.type) || new Set();
    const allListeners = this.eventListeners.get('*') || new Set();
    
    [...listeners, ...allListeners].forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in sync event callback:', error);
      }
    });

    // Also emit as window event for global listening
    window.dispatchEvent(new CustomEvent('livestore:sync:event', {
      detail: event
    }));
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      isActive: this.isActive,
      hasClient: !!this.client,
      lastActivity: new Date()
    };
  }

  /**
   * Shutdown sync integration
   */
  shutdown(): void {
    this.isActive = false;
    this.client = null;
    this.eventListeners.clear();
    console.log('🔌 LiveStore sync integration shutdown');
  }
}

// Global sync manager instance
const liveStoreSyncManager = new LiveStoreSyncManager();

/**
 * Initialize LiveStore sync integration
 */
export async function initializeLiveStoreSync(): Promise<void> {
  await liveStoreSyncManager.initialize();
}

/**
 * Subscribe to LiveStore sync events
 */
export function subscribeLiveStoreSync(
  eventType: string, 
  callback: (event: LiveStoreSyncEvent) => void
): () => void {
  return liveStoreSyncManager.subscribe(eventType, callback);
}

/**
 * Get LiveStore sync status
 */
export function getLiveStoreSyncStatus() {
  return liveStoreSyncManager.getSyncStatus();
}

/**
 * Shutdown LiveStore sync
 */
export function shutdownLiveStoreSync(): void {
  liveStoreSyncManager.shutdown();
}

/**
 * React hook for LiveStore sync events
 */
export function useLiveStoreSync() {
  const [syncStatus, setSyncStatus] = React.useState(liveStoreSyncManager.getSyncStatus());
  const [lastEvent, setLastEvent] = React.useState<LiveStoreSyncEvent | null>(null);

  React.useEffect(() => {
    // Subscribe to all sync events
    const unsubscribe = subscribeLiveStoreSync('*', (event) => {
      setLastEvent(event);
    });

    // Update sync status periodically
    const statusInterval = setInterval(() => {
      setSyncStatus(liveStoreSyncManager.getSyncStatus());
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(statusInterval);
    };
  }, []);

  return {
    syncStatus,
    lastEvent,
    subscribe: subscribeLiveStoreSync
  };
}

// Auto-initialize when LiveStore client becomes ready
if (typeof window !== 'undefined') {
  window.addEventListener('livestore:ready', () => {
    console.log('🔄 LiveStore ready, initializing sync integration...');
    initializeLiveStoreSync().catch(error => {
      console.error('Failed to initialize LiveStore sync:', error);
    });
  });

  window.addEventListener('livestore:disconnected', () => {
    console.log('🔌 LiveStore disconnected, shutting down sync integration...');
    shutdownLiveStoreSync();
  });
}

export default liveStoreSyncManager;
export type { LiveStoreSyncEvent };