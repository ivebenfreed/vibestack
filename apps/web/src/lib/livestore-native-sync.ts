/**
 * LiveStore Native Sync Integration - Phase 2 Implementation
 * 
 * Uses LiveStore's native event system and materializers to integrate with existing sync services.
 * Replaces complex change tracking bridges with clean LiveStore event handling.
 */

import { liveStoreEventGenerator, type LiveStoreMutations } from './livestore-event-generator';
import type { OrgEntitySchema } from './schema-client';

// Import existing sync services interfaces
import type { TableChange } from '@repo/sync-types';

export interface LiveStoreNativeSyncConfig {
  organizationId: string;
  clientId: string;
  userId: string;
  store: any; // LiveStore instance
  orgSchema: OrgEntitySchema;
  outgoingChangeService: any; // OutgoingChangeService instance
  incomingChangeService: any; // IncomingChangeService instance
}

export interface LiveStoreSubscription {
  unsubscribe: () => void;
  entityName: string;
  tableName: string;
}

/**
 * Native LiveStore Sync Integration
 * Uses LiveStore's native capabilities instead of manual bridges
 */
export class LiveStoreNativeSync {
  private config: LiveStoreNativeSyncConfig;
  private mutations: LiveStoreMutations | null = null;
  private subscriptions: LiveStoreSubscription[] = [];
  private isInitialized = false;
  private isSyncMode = false; // Prevents sync loops

  constructor(config: LiveStoreNativeSyncConfig) {
    this.config = config;
    console.log(`🔄 Initializing native LiveStore sync for org: ${config.organizationId}`);
  }

  /**
   * Initialize the native sync integration
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log(`✅ Native sync already initialized for org: ${this.config.organizationId}`);
      return;
    }

    try {
      console.log(`🔧 Setting up native sync for org: ${this.config.organizationId}`);

      // Generate mutations from schema
      this.mutations = await liveStoreEventGenerator.createMutations(
        this.config.organizationId,
        this.config.store,
        this.config.orgSchema
      );

      // Setup LiveStore native event listeners (replaces manual change tracking)
      await this.setupNativeEventListeners();

      // Setup incoming change handlers (from existing sync services)
      this.setupIncomingChangeHandlers();

      this.isInitialized = true;
      console.log(`✅ Native LiveStore sync initialized for org: ${this.config.organizationId}`);

      // Dispatch ready event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('livestore:sync:ready', {
          detail: { organizationId: this.config.organizationId }
        }));
      }

    } catch (error) {
      console.error(`❌ Failed to initialize native sync for org ${this.config.organizationId}:`, error);
      throw error;
    }
  }

  /**
   * Setup LiveStore native event listeners (replaces manual change tracking)
   */
  private async setupNativeEventListeners(): Promise<void> {
    console.log(`🎧 Setting up native LiveStore event listeners for org: ${this.config.organizationId}`);

    // Get generated components
    const components = liveStoreEventGenerator.getComponents(this.config.organizationId);
    if (!components) {
      throw new Error('Generated components not found');
    }

    // Subscribe to changes for each entity table using LiveStore's native subscriptions
    Object.keys(components.tables).forEach(entityName => {
      const table = components.tables[entityName];
      const tableName = table.name;

      console.log(`📡 Setting up subscription for ${entityName} → ${tableName}`);

      // Use LiveStore's native subscribe method
      // This automatically detects ALL changes to the table
      const unsubscribe = this.config.store.subscribe(tableName, (updatedData: any[]) => {
        if (this.isSyncMode) {
          // Skip during incoming sync to prevent loops
          console.log(`⏭️ Skipping change notification during sync mode for ${tableName}`);
          return;
        }

        // Suppressed: Native change detection logging
        this.handleNativeTableChange(entityName, tableName, updatedData);
      });

      // Store subscription for cleanup
      this.subscriptions.push({
        unsubscribe,
        entityName,
        tableName
      });
    });

    console.log(`✅ Set up ${this.subscriptions.length} native event listeners`);
  }

  /**
   * Handle native table changes from LiveStore subscriptions
   */
  private async handleNativeTableChange(
    entityName: string,
    tableName: string,
    updatedData: any[]
  ): Promise<void> {
    try {
      console.log(`📡 Processing native change for ${entityName}:`, updatedData.length, 'records');

      // For each updated record, determine what changed and create appropriate TableChange
      for (const record of updatedData) {
        // LiveStore provides the current state, we need to determine the operation
        const operation = await this.determineOperation(tableName, record);
        
        const tableChange: TableChange = {
          id: `change_${Date.now()}_${record.id}`,
          table: tableName,
          entity_id: record.id,
          operation,
          changes: this.formatChangeData(operation, record),
          organization_id: this.config.organizationId,
          created_at: new Date().toISOString(),
          synced: false,
          client_id: this.config.clientId,
          user_id: this.config.userId
        };

        // Send to existing OutgoingChangeService
        console.log(`📤 Sending ${operation} change for ${entityName}:${record.id} to OutgoingChangeService`);
        await this.config.outgoingChangeService.queueChange(tableChange);
      }

    } catch (error) {
      console.error(`❌ Error processing native change for ${entityName}:`, error);
    }
  }

  /**
   * Determine the operation type for a record change
   */
  private async determineOperation(tableName: string, record: any): Promise<'insert' | 'update' | 'delete'> {
    // For now, we'll use a simple heuristic based on created_at vs updated_at
    // TODO: Enhance this with LiveStore's native event metadata when available
    
    if (!record.created_at) {
      return 'delete'; // Soft delete or missing record
    }
    
    if (record.created_at === record.updated_at) {
      return 'insert'; // Just created
    }
    
    return 'update'; // Modified
  }

  /**
   * Format change data for existing sync system
   */
  private formatChangeData(operation: string, record: any): any {
    switch (operation) {
      case 'insert':
        return {
          type: 'insert',
          data: record
        };
      
      case 'update':
        return {
          type: 'update',
          data: record,
          // TODO: Include old data when available from LiveStore events
          oldData: null
        };
      
      case 'delete':
        return {
          type: 'delete',
          id: record.id
        };
      
      default:
        return { type: operation, data: record };
    }
  }

  /**
   * Setup handlers for incoming changes from existing sync services
   */
  private setupIncomingChangeHandlers(): void {
    console.log(`📥 Setting up incoming change handlers for org: ${this.config.organizationId}`);

    // Hook into existing IncomingChangeService
    this.config.incomingChangeService.onChangesReceived(async (changes: TableChange[]) => {
      await this.applyIncomingChanges(changes);
    });

    console.log(`✅ Incoming change handlers ready for org: ${this.config.organizationId}`);
  }

  /**
   * Apply incoming changes to LiveStore (replaces manual application)
   */
  async applyIncomingChanges(changes: TableChange[]): Promise<void> {
    if (!this.mutations) {
      console.error('❌ Mutations not initialized for applying incoming changes');
      return;
    }

    console.log(`📥 Applying ${changes.length} incoming changes via native LiveStore`);

    // Enable sync mode to prevent outgoing notifications during sync
    this.isSyncMode = true;

    try {
      for (const change of changes) {
        await this.applyIncomingChange(change);
      }

      console.log(`✅ Applied ${changes.length} incoming changes successfully`);

    } catch (error) {
      console.error('❌ Error applying incoming changes:', error);
      throw error;

    } finally {
      // Always disable sync mode
      this.isSyncMode = false;
    }
  }

  /**
   * Apply a single incoming change using native LiveStore mutations
   */
  private async applyIncomingChange(change: TableChange): Promise<void> {
    if (!this.mutations) {
      throw new Error('Mutations not initialized');
    }

    // Extract entity name from table name
    const entityName = this.extractEntityNameFromTable(change.table);
    let entityMutations = this.mutations[entityName];

    // Try different name variations if not found
    if (!entityMutations) {
      // Try capitalized version
      const capitalizedName = entityName.charAt(0).toUpperCase() + entityName.slice(1);
      entityMutations = this.mutations[capitalizedName];
      
      if (entityMutations) {
        console.log(`🔍 Found mutations for capitalized entity name: ${capitalizedName}`);
      }
    }

    if (!entityMutations) {
      console.warn(`⚠️ No mutations found for entity: ${entityName} (table: ${change.table})`);
      console.log(`🔍 Available mutations:`, Object.keys(this.mutations || {}));
      return;
    }

    // Note: Verbose change logging removed for performance

    try {
      // Operation is already lowercase in new TableChange format
      const operation = change.operation;
      
      // Extract data from the change object - data contains the full record
      const changeData = change.data;
      
      // For all operations, ID is in the data object
      let recordId: string | undefined;
      if (changeData && typeof changeData === 'object') {
        recordId = (changeData as any).id;
      }
      
      console.log(`🔍 Extracted data:`, { 
        recordId, 
        hasData: !!changeData, 
        dataKeys: changeData && typeof changeData === 'object' ? Object.keys(changeData) : 'not-object',
        dataType: typeof changeData,
        operation
      });
      
      switch (operation) {
        case 'insert':
          await entityMutations.create(changeData);
          break;

        case 'update':
          await entityMutations.update(recordId, changeData);
          break;

        case 'delete':
          await entityMutations.delete(recordId);
          break;

        default:
          console.warn(`⚠️ Unknown operation: ${change.operation} (normalized: ${operation})`);
      }

      console.log(`✅ Applied ${change.operation} for ${entityName}:${recordId}`);

    } catch (error) {
      console.error(`❌ Failed to apply ${change.operation} for ${entityName}:${recordId}:`, error);
      throw error;
    }
  }

  /**
   * Extract entity name from table name (reverse of table naming convention)
   * Table format: org_{FULL_ORG_ID}_{ENTITY_NAME}
   * Example: org_01920000_1000_7000_8000_000000000001_client -> client
   */
  private extractEntityNameFromTable(tableName: string): string {
    // Handle org-scoped table names
    if (tableName.startsWith('org_')) {
      // Find the last underscore - everything after it is the entity name
      const lastUnderscoreIndex = tableName.lastIndexOf('_');
      if (lastUnderscoreIndex > 3) { // Make sure we're not taking 'org'
        const entityName = tableName.substring(lastUnderscoreIndex + 1);
        console.log(`🔍 Extracted entity name: ${entityName} from table: ${tableName}`);
        return entityName;
      }
    }
    
    // Fallback to original table name
    console.warn(`⚠️ Could not extract entity name from table: ${tableName}`);
    return tableName;
  }

  /**
   * Get current sync status
   */
  getSyncStatus() {
    return {
      initialized: this.isInitialized,
      organizationId: this.config.organizationId,
      syncMode: this.isSyncMode,
      subscriptions: this.subscriptions.length,
      mutationsReady: !!this.mutations,
      lastActivity: new Date().toISOString()
    };
  }

  /**
   * Get mutations interface for manual operations
   */
  getMutations(): LiveStoreMutations | null {
    return this.mutations;
  }

  /**
   * Manually trigger sync for testing
   */
  async triggerManualSync(): Promise<void> {
    console.log(`🔄 Manual sync triggered for org: ${this.config.organizationId}`);
    
    // This could trigger outgoing change processing
    if (this.config.outgoingChangeService?.processPendingChanges) {
      await this.config.outgoingChangeService.processPendingChanges();
    }
  }

  /**
   * Clean shutdown
   */
  async shutdown(): Promise<void> {
    console.log(`🔌 Shutting down native sync for org: ${this.config.organizationId}`);

    // Unsubscribe from all LiveStore subscriptions
    this.subscriptions.forEach(sub => {
      try {
        sub.unsubscribe();
        console.log(`🔕 Unsubscribed from ${sub.entityName}`);
      } catch (error) {
        console.error(`❌ Error unsubscribing from ${sub.entityName}:`, error);
      }
    });

    this.subscriptions = [];
    this.mutations = null;
    this.isInitialized = false;

    // Dispatch shutdown event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('livestore:sync:shutdown', {
        detail: { organizationId: this.config.organizationId }
      }));
    }

    console.log(`✅ Native sync shutdown complete for org: ${this.config.organizationId}`);
  }
}

/**
 * Factory function to create native sync with existing services
 */
export async function createLiveStoreNativeSync(config: {
  organizationId: string;
  clientId: string;
  userId: string;
  store: any;
  orgSchema: OrgEntitySchema;
  // Existing service instances will be passed here
  outgoingChangeService?: any;
  incomingChangeService?: any;
}): Promise<LiveStoreNativeSync> {
  
  // For now, create mock services if not provided
  // TODO: Replace with actual service instances from ServiceCoordinator
  const outgoingChangeService = config.outgoingChangeService || {
    queueChange: async (change: TableChange) => {
      console.log('📤 [MOCK] OutgoingChangeService.queueChange:', change);
    },
    processPendingChanges: async () => {
      console.log('📤 [MOCK] OutgoingChangeService.processPendingChanges');
    }
  };

  const incomingChangeService = config.incomingChangeService || {
    onChangesReceived: (handler: (changes: TableChange[]) => Promise<void>) => {
      console.log('📥 [MOCK] IncomingChangeService.onChangesReceived registered');
      // In real implementation, this would register the handler
    }
  };

  const syncConfig: LiveStoreNativeSyncConfig = {
    ...config,
    outgoingChangeService,
    incomingChangeService
  };

  const nativeSync = new LiveStoreNativeSync(syncConfig);
  await nativeSync.initialize();

  return nativeSync;
}

export default LiveStoreNativeSync;