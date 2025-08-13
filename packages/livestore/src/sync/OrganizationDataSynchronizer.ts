/**
 * Organization-Aware Data Synchronization System
 * Handles multi-tenant data synchronization with access control integration
 */

import { 
  ProjectAccessControlService,
  TaskAccessControlService,
  FileAccessControlService,
  DiscussionAccessControlService
} from '@vibestack/dataforge';

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'batch';
  archetype: 'project' | 'task' | 'file' | 'discussion' | 'user' | 'organization';
  entityId: string;
  organizationId: string;
  userId: string;
  timestamp: Date;
  data: any;
  previousData?: any;
  version: number;
  checksum: string;
  metadata: SyncMetadata;
  conflicts?: SyncConflict[];
}

export interface SyncMetadata {
  source: 'client' | 'server' | 'api' | 'import' | 'migration';
  connectionId?: string;
  clientVersion?: string;
  serverVersion: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  retryCount: number;
  maxRetries: number;
  conflictResolution: 'client_wins' | 'server_wins' | 'merge' | 'manual';
  tags: string[];
  correlationId?: string;
  batchId?: string;
}

export interface SyncConflict {
  id: string;
  type: 'version_mismatch' | 'concurrent_edit' | 'permission_denied' | 'validation_error';
  field?: string;
  clientValue: any;
  serverValue: any;
  resolution?: 'use_client' | 'use_server' | 'merge' | 'reject';
  resolvedValue?: any;
  resolvedBy?: string;
  resolvedAt?: Date;
  description: string;
}

export interface OrganizationSyncState {
  organizationId: string;
  lastSyncTime: Date;
  syncVersion: number;
  activeConnections: Set<string>;
  pendingOperations: Map<string, SyncOperation>;
  conflictQueue: SyncConflict[];
  syncMetrics: SyncMetrics;
  dataChecksums: Map<string, string>; // entityId -> checksum
  schemaVersion: string;
  features: OrganizationSyncFeatures;
}

export interface OrganizationSyncFeatures {
  enableRealTimeSync: boolean;
  enableConflictResolution: boolean;
  enableOfflineSync: boolean;
  enableVersionHistory: boolean;
  enableBatchOperations: boolean;
  maxBatchSize: number;
  syncIntervalMs: number;
  conflictRetentionDays: number;
}

export interface SyncMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  conflictsDetected: number;
  conflictsResolved: number;
  averageSyncTime: number;
  lastSyncDuration: number;
  dataTransferred: number; // bytes
  operationsByType: Record<string, number>;
  operationsByArchetype: Record<string, number>;
}

export interface SyncResult {
  operationId: string;
  success: boolean;
  timestamp: Date;
  conflicts: SyncConflict[];
  syncTime: number;
  dataSize: number;
  error?: string;
  warning?: string;
}

export interface BatchSyncResult {
  batchId: string;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  conflicts: SyncConflict[];
  totalSyncTime: number;
  individualResults: SyncResult[];
  rollbackRequired: boolean;
}

export interface SyncSubscription {
  id: string;
  organizationId: string;
  connectionId: string;
  userId: string;
  archetypes: string[];
  entityFilters: EntityFilter[];
  permissions: string[];
  active: boolean;
  createdAt: Date;
  lastActivity: Date;
}

export interface EntityFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'contains' | 'starts_with' | 'ends_with';
  value: any;
}

export interface OfflineSyncData {
  organizationId: string;
  userId: string;
  operations: SyncOperation[];
  lastSyncVersion: number;
  cachedData: Map<string, any>;
  conflicts: SyncConflict[];
  storageQuotaUsed: number;
  maxStorageQuota: number;
  expiresAt: Date;
}

export type SyncEventHandler = (operation: SyncOperation, result: SyncResult) => void;

export class OrganizationDataSynchronizer {
  private projectAccessControl = new ProjectAccessControlService();
  private taskAccessControl = new TaskAccessControlService();
  private fileAccessControl = new FileAccessControlService();
  private discussionAccessControl = new DiscussionAccessControlService();

  private organizationStates: Map<string, OrganizationSyncState> = new Map();
  private syncSubscriptions: Map<string, SyncSubscription> = new Map();
  private eventHandlers: Map<string, SyncEventHandler[]> = new Map();
  private operationQueue: Map<string, SyncOperation[]> = new Map(); // organizationId -> operations
  private offlineData: Map<string, OfflineSyncData> = new Map(); // userId -> offline data

  // Configuration
  private readonly maxOrganizationStates = 50;
  private readonly syncBatchSize = 100;
  private readonly conflictRetentionDays = 30;
  private readonly operationTimeoutMs = 30000;
  private readonly maxOfflineOperations = 1000;

  constructor() {
    this.startSyncProcessor();
    this.startMetricsAggregator();
    this.startConflictCleanup();
  }

  /**
   * Initialize organization sync state
   */
  async initializeOrganizationSync(organizationId: string): Promise<OrganizationSyncState> {
    console.log(`🔄 Initializing sync state for organization ${organizationId}`);

    const syncState: OrganizationSyncState = {
      organizationId,
      lastSyncTime: new Date(),
      syncVersion: 1,
      activeConnections: new Set(),
      pendingOperations: new Map(),
      conflictQueue: [],
      syncMetrics: {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        conflictsDetected: 0,
        conflictsResolved: 0,
        averageSyncTime: 0,
        lastSyncDuration: 0,
        dataTransferred: 0,
        operationsByType: {},
        operationsByArchetype: {}
      },
      dataChecksums: new Map(),
      schemaVersion: '1.0.0',
      features: {
        enableRealTimeSync: true,
        enableConflictResolution: true,
        enableOfflineSync: true,
        enableVersionHistory: true,
        enableBatchOperations: true,
        maxBatchSize: 50,
        syncIntervalMs: 1000,
        conflictRetentionDays: 30
      }
    };

    this.organizationStates.set(organizationId, syncState);
    
    // Initialize operation queue
    this.operationQueue.set(organizationId, []);

    console.log(`✅ Initialized sync state for organization ${organizationId}`);
    return syncState;
  }

  /**
   * Create sync operation with access control validation
   */
  async createSyncOperation(
    type: SyncOperation['type'],
    archetype: SyncOperation['archetype'],
    entityId: string,
    organizationId: string,
    userId: string,
    data: any,
    metadata: Partial<SyncMetadata> = {}
  ): Promise<SyncOperation> {
    console.log(`📝 Creating sync operation: ${type} ${archetype}:${entityId} for user ${userId}`);

    // Validate permissions
    const hasPermission = await this.validateSyncPermission(type, archetype, entityId, organizationId, userId);
    if (!hasPermission) {
      throw new Error(`User ${userId} does not have permission to ${type} ${archetype}:${entityId}`);
    }

    // Get current data for conflict detection
    const previousData = type === 'update' ? await this.getCurrentEntityData(archetype, entityId, organizationId) : undefined;

    // Generate checksum
    const checksum = this.generateDataChecksum(data);

    // Create operation
    const operation: SyncOperation = {
      id: this.generateOperationId(),
      type,
      archetype,
      entityId,
      organizationId,
      userId,
      timestamp: new Date(),
      data,
      previousData,
      version: this.getNextVersion(organizationId),
      checksum,
      metadata: {
        source: 'client',
        serverVersion: '1.0.0',
        priority: 'normal',
        retryCount: 0,
        maxRetries: 3,
        conflictResolution: 'merge',
        tags: [],
        ...metadata
      }
    };

    // Check for conflicts
    const conflicts = await this.detectConflicts(operation);
    if (conflicts.length > 0) {
      operation.conflicts = conflicts;
      console.log(`⚠️ Detected ${conflicts.length} conflicts for operation ${operation.id}`);
    }

    // Queue operation for processing
    await this.queueSyncOperation(operation);

    return operation;
  }

  /**
   * Execute sync operation
   */
  async executeSyncOperation(operation: SyncOperation): Promise<SyncResult> {
    const startTime = Date.now();
    console.log(`⚙️ Executing sync operation ${operation.id}`);

    const result: SyncResult = {
      operationId: operation.id,
      success: false,
      timestamp: new Date(),
      conflicts: operation.conflicts || [],
      syncTime: 0,
      dataSize: JSON.stringify(operation.data).length
    };

    try {
      // Get organization state
      const syncState = await this.getOrganizationSyncState(operation.organizationId);

      // Resolve conflicts if any
      if (operation.conflicts && operation.conflicts.length > 0) {
        const resolvedConflicts = await this.resolveConflicts(operation.conflicts, operation);
        operation.conflicts = resolvedConflicts;
        result.conflicts = resolvedConflicts;

        // Check if all conflicts are resolved
        const unresolvedConflicts = resolvedConflicts.filter(c => !c.resolution);
        if (unresolvedConflicts.length > 0) {
          result.error = `${unresolvedConflicts.length} unresolved conflicts`;
          return result;
        }
      }

      // Apply the operation
      await this.applyOperation(operation);

      // Update checksums
      syncState.dataChecksums.set(operation.entityId, operation.checksum);

      // Propagate to subscribers
      await this.propagateToSubscribers(operation);

      // Update metrics
      this.updateSyncMetrics(syncState, operation, true, startTime);

      result.success = true;
      console.log(`✅ Successfully executed sync operation ${operation.id}`);

    } catch (error) {
      result.success = false;
      result.error = String(error);
      
      // Update metrics for failure
      const syncState = await this.getOrganizationSyncState(operation.organizationId);
      this.updateSyncMetrics(syncState, operation, false, startTime);
      
      console.error(`❌ Failed to execute sync operation ${operation.id}:`, error);
    } finally {
      result.syncTime = Date.now() - startTime;
    }

    // Emit event
    this.emitSyncEvent('operation_completed', operation, result);

    return result;
  }

  /**
   * Execute batch of sync operations
   */
  async executeBatchSync(operations: SyncOperation[], rollbackOnError: boolean = false): Promise<BatchSyncResult> {
    const startTime = Date.now();
    const batchId = this.generateBatchId();
    
    console.log(`📦 Executing batch sync with ${operations.length} operations (batch: ${batchId})`);

    const batchResult: BatchSyncResult = {
      batchId,
      totalOperations: operations.length,
      successfulOperations: 0,
      failedOperations: 0,
      conflicts: [],
      totalSyncTime: 0,
      individualResults: [],
      rollbackRequired: false
    };

    const rollbackOperations: SyncOperation[] = [];

    try {
      // Execute operations sequentially to maintain order
      for (const operation of operations) {
        const result = await this.executeSyncOperation(operation);
        batchResult.individualResults.push(result);
        
        if (result.success) {
          batchResult.successfulOperations++;
          
          // Store rollback operation if needed
          if (rollbackOnError) {
            rollbackOperations.push(this.createRollbackOperation(operation));
          }
        } else {
          batchResult.failedOperations++;
          
          // If rollback on error is enabled and we have a failure
          if (rollbackOnError) {
            console.log(`🔄 Rolling back batch due to operation failure`);
            batchResult.rollbackRequired = true;
            
            // Execute rollback operations in reverse order
            for (let i = rollbackOperations.length - 1; i >= 0; i--) {
              await this.executeSyncOperation(rollbackOperations[i]);
            }
            break;
          }
        }

        // Collect conflicts
        batchResult.conflicts.push(...result.conflicts);
      }

    } catch (error) {
      console.error(`❌ Batch sync failed:`, error);
      batchResult.rollbackRequired = rollbackOnError;
    } finally {
      batchResult.totalSyncTime = Date.now() - startTime;
    }

    console.log(`📊 Batch sync completed: ${batchResult.successfulOperations}/${batchResult.totalOperations} successful`);
    return batchResult;
  }

  /**
   * Subscribe to sync events for organization
   */
  async subscribeToSync(
    organizationId: string,
    connectionId: string,
    userId: string,
    options: {
      archetypes?: string[];
      entityFilters?: EntityFilter[];
    } = {}
  ): Promise<string> {
    console.log(`📡 Creating sync subscription for user ${userId} in org ${organizationId}`);

    // Validate user permissions
    const hasPermission = await this.validateSubscriptionPermission(organizationId, userId);
    if (!hasPermission) {
      throw new Error(`User ${userId} does not have permission to subscribe to sync events`);
    }

    const subscription: SyncSubscription = {
      id: this.generateSubscriptionId(),
      organizationId,
      connectionId,
      userId,
      archetypes: options.archetypes || ['project', 'task', 'file', 'discussion'],
      entityFilters: options.entityFilters || [],
      permissions: await this.getUserSyncPermissions(organizationId, userId),
      active: true,
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.syncSubscriptions.set(subscription.id, subscription);

    // Add connection to organization state
    const syncState = await this.getOrganizationSyncState(organizationId);
    syncState.activeConnections.add(connectionId);

    console.log(`✅ Created sync subscription ${subscription.id}`);
    return subscription.id;
  }

  /**
   * Unsubscribe from sync events
   */
  unsubscribeFromSync(subscriptionId: string): void {
    const subscription = this.syncSubscriptions.get(subscriptionId);
    if (subscription) {
      subscription.active = false;
      
      // Remove connection from organization state
      const syncState = this.organizationStates.get(subscription.organizationId);
      if (syncState) {
        syncState.activeConnections.delete(subscription.connectionId);
      }
      
      this.syncSubscriptions.delete(subscriptionId);
      console.log(`🔌 Removed sync subscription ${subscriptionId}`);
    }
  }

  /**
   * Get synchronization status for organization
   */
  getSyncStatus(organizationId: string): {
    isOnline: boolean;
    lastSyncTime: Date;
    pendingOperations: number;
    conflicts: number;
    metrics: SyncMetrics;
  } {
    const syncState = this.organizationStates.get(organizationId);
    if (!syncState) {
      throw new Error(`Sync state not found for organization ${organizationId}`);
    }

    return {
      isOnline: syncState.activeConnections.size > 0,
      lastSyncTime: syncState.lastSyncTime,
      pendingOperations: syncState.pendingOperations.size,
      conflicts: syncState.conflictQueue.length,
      metrics: syncState.syncMetrics
    };
  }

  /**
   * Handle offline sync when connection is restored
   */
  async syncOfflineData(userId: string, organizationId: string): Promise<BatchSyncResult> {
    console.log(`🔄 Syncing offline data for user ${userId} in org ${organizationId}`);

    const offlineData = this.offlineData.get(userId);
    if (!offlineData || offlineData.operations.length === 0) {
      console.log(`📭 No offline operations found for user ${userId}`);
      return {
        batchId: this.generateBatchId(),
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        conflicts: [],
        totalSyncTime: 0,
        individualResults: [],
        rollbackRequired: false
      };
    }

    // Filter operations for this organization
    const orgOperations = offlineData.operations.filter(op => op.organizationId === organizationId);
    
    // Execute batch sync
    const result = await this.executeBatchSync(orgOperations, false);

    // Clear synced operations
    if (result.successfulOperations > 0) {
      const syncedOperationIds = result.individualResults
        .filter(r => r.success)
        .map(r => r.operationId);
      
      offlineData.operations = offlineData.operations.filter(op => 
        !syncedOperationIds.includes(op.id)
      );
    }

    console.log(`📤 Synced ${result.successfulOperations} offline operations for user ${userId}`);
    return result;
  }

  /**
   * Get or create organization sync state
   */
  private async getOrganizationSyncState(organizationId: string): Promise<OrganizationSyncState> {
    let syncState = this.organizationStates.get(organizationId);
    if (!syncState) {
      syncState = await this.initializeOrganizationSync(organizationId);
    }
    return syncState;
  }

  /**
   * Validate sync permission for operation
   */
  private async validateSyncPermission(
    type: SyncOperation['type'],
    archetype: string,
    entityId: string,
    organizationId: string,
    userId: string
  ): Promise<boolean> {
    const mockEntity = { id: entityId, organizationId, archetype };

    try {
      switch (archetype) {
        case 'project':
          return type === 'delete' 
            ? await this.projectAccessControl.canDelete(userId, mockEntity as any)
            : await this.projectAccessControl.canWrite(userId, mockEntity as any);
        case 'task':
          return type === 'delete'
            ? await this.taskAccessControl.canDelete(userId, mockEntity as any)
            : await this.taskAccessControl.canWrite(userId, mockEntity as any);
        case 'file':
          return type === 'delete'
            ? await this.fileAccessControl.canDelete(userId, mockEntity as any)
            : await this.fileAccessControl.canWrite(userId, mockEntity as any);
        case 'discussion':
          return type === 'delete'
            ? await this.discussionAccessControl.canDelete(userId, mockEntity as any)
            : await this.discussionAccessControl.canWrite(userId, mockEntity as any);
        default:
          return false;
      }
    } catch (error) {
      console.error(`Error validating sync permission:`, error);
      return false;
    }
  }

  /**
   * Validate subscription permission
   */
  private async validateSubscriptionPermission(organizationId: string, userId: string): Promise<boolean> {
    // Check if user is a member of the organization and has read permissions
    // This would typically check with the organization access control service
    return true; // Simplified for now
  }

  /**
   * Get user sync permissions
   */
  private async getUserSyncPermissions(organizationId: string, userId: string): Promise<string[]> {
    // Get user's permissions in the organization
    return ['sync.read', 'sync.write']; // Simplified for now
  }

  /**
   * Queue sync operation for processing
   */
  private async queueSyncOperation(operation: SyncOperation): Promise<void> {
    const queue = this.operationQueue.get(operation.organizationId) || [];
    queue.push(operation);
    this.operationQueue.set(operation.organizationId, queue);

    // Add to pending operations in sync state
    const syncState = await this.getOrganizationSyncState(operation.organizationId);
    syncState.pendingOperations.set(operation.id, operation);

    console.log(`📋 Queued sync operation ${operation.id} (queue size: ${queue.length})`);
  }

  /**
   * Start sync processor
   */
  private startSyncProcessor(): void {
    setInterval(() => {
      this.processSyncQueues();
    }, 1000); // Process every second
  }

  /**
   * Process sync operation queues
   */
  private async processSyncQueues(): Promise<void> {
    for (const [organizationId, operations] of this.operationQueue.entries()) {
      if (operations.length === 0) continue;

      const batch = operations.splice(0, this.syncBatchSize);
      
      try {
        await Promise.all(batch.map(op => this.executeSyncOperation(op)));
      } catch (error) {
        console.error(`Error processing sync queue for org ${organizationId}:`, error);
      }
    }
  }

  // Additional helper methods would be implemented here...
  private getNextVersion(organizationId: string): number {
    const syncState = this.organizationStates.get(organizationId);
    if (syncState) {
      return ++syncState.syncVersion;
    }
    return 1;
  }

  private generateDataChecksum(data: any): string {
    // Simple checksum generation - in production use a proper hash function
    return `checksum_${Date.now()}_${JSON.stringify(data).length}`;
  }

  private async getCurrentEntityData(archetype: string, entityId: string, organizationId: string): Promise<any> {
    // Get current entity data from database
    return {}; // Placeholder
  }

  private async detectConflicts(operation: SyncOperation): Promise<SyncConflict[]> {
    // Detect conflicts with concurrent operations
    return []; // Placeholder
  }

  private async resolveConflicts(conflicts: SyncConflict[], operation: SyncOperation): Promise<SyncConflict[]> {
    // Resolve conflicts based on resolution strategy
    return conflicts; // Placeholder
  }

  private async applyOperation(operation: SyncOperation): Promise<void> {
    // Apply the sync operation to the database
    console.log(`Applied ${operation.type} operation for ${operation.archetype}:${operation.entityId}`);
  }

  private async propagateToSubscribers(operation: SyncOperation): Promise<void> {
    // Send operation to subscribed connections
    const relevantSubscriptions = Array.from(this.syncSubscriptions.values())
      .filter(sub => 
        sub.organizationId === operation.organizationId &&
        sub.archetypes.includes(operation.archetype) &&
        sub.active
      );

    console.log(`📡 Propagating operation ${operation.id} to ${relevantSubscriptions.length} subscribers`);
  }

  private updateSyncMetrics(syncState: OrganizationSyncState, operation: SyncOperation, success: boolean, startTime: number): void {
    const metrics = syncState.syncMetrics;
    const syncTime = Date.now() - startTime;

    metrics.totalOperations++;
    if (success) {
      metrics.successfulOperations++;
    } else {
      metrics.failedOperations++;
    }

    metrics.lastSyncDuration = syncTime;
    metrics.averageSyncTime = (metrics.averageSyncTime * (metrics.totalOperations - 1) + syncTime) / metrics.totalOperations;
    metrics.dataTransferred += JSON.stringify(operation.data).length;

    // Update operation breakdowns
    metrics.operationsByType[operation.type] = (metrics.operationsByType[operation.type] || 0) + 1;
    metrics.operationsByArchetype[operation.archetype] = (metrics.operationsByArchetype[operation.archetype] || 0) + 1;

    syncState.lastSyncTime = new Date();
  }

  private createRollbackOperation(operation: SyncOperation): SyncOperation {
    // Create rollback operation
    return {
      ...operation,
      id: this.generateOperationId(),
      type: operation.type === 'create' ? 'delete' : 
            operation.type === 'delete' ? 'create' : 'update',
      data: operation.previousData || {},
      previousData: operation.data,
      timestamp: new Date(),
      metadata: {
        ...operation.metadata,
        source: 'server',
        tags: [...operation.metadata.tags, 'rollback']
      }
    };
  }

  private emitSyncEvent(eventType: string, operation: SyncOperation, result: SyncResult): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.forEach(handler => {
      try {
        handler(operation, result);
      } catch (error) {
        console.error('Error in sync event handler:', error);
      }
    });
  }

  private startMetricsAggregator(): void {
    setInterval(() => {
      this.aggregateMetrics();
    }, 60000); // Aggregate every minute
  }

  private aggregateMetrics(): void {
    // Aggregate metrics across all organizations
    let totalOperations = 0;
    let totalSyncTime = 0;

    for (const syncState of this.organizationStates.values()) {
      totalOperations += syncState.syncMetrics.totalOperations;
      totalSyncTime += syncState.syncMetrics.averageSyncTime;
    }

    console.log(`📊 Global sync metrics: ${totalOperations} operations, avg sync time: ${totalSyncTime / this.organizationStates.size}ms`);
  }

  private startConflictCleanup(): void {
    setInterval(() => {
      this.cleanupOldConflicts();
    }, 24 * 60 * 60 * 1000); // Clean up daily
  }

  private cleanupOldConflicts(): void {
    const cutoffDate = new Date(Date.now() - this.conflictRetentionDays * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const syncState of this.organizationStates.values()) {
      const initialLength = syncState.conflictQueue.length;
      syncState.conflictQueue = syncState.conflictQueue.filter(conflict => {
        return conflict.resolvedAt && conflict.resolvedAt > cutoffDate;
      });
      cleanedCount += initialLength - syncState.conflictQueue.length;
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old sync conflicts`);
    }
  }

  // ID generators
  private generateOperationId(): string {
    return `sync_op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBatchId(): string {
    return `sync_batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSubscriptionId(): string {
    return `sync_sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default OrganizationDataSynchronizer;