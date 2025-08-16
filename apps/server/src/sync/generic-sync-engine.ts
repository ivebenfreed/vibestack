/**
 * Generic Sync Engine
 * 
 * Table-agnostic sync engine that uses metadata to sync any entity
 * without requiring domain-specific code.
 */

import { Kysely } from 'kysely';
import { NeonHTTPDialect } from '@repo/kysely-neon-http';
import { neonConfig } from '@neondatabase/serverless';
// TODO: Replace with server-only types when DataForge is moved
// import type { Database, TableName } from '@repo/dataforge/kysely-types';
// import type { TableSyncMetadata, JunctionTable, TRACKED_TABLES } from '@repo/dataforge/sync-metadata';
type Database = any;
type TableName = string;
type TableSyncMetadata = any;
type JunctionTable = any;
type TRACKED_TABLES = string[];
import { DeleteSafetyCheck } from './delete-safety-check.js';
import { ContainerPermissionService } from './container-permission-service';

export interface LocalChange {
  id: string;
  tableName: string;
  recordId: string;
  operationType: 'INSERT' | 'UPDATE' | 'DELETE';
  data: Record<string, any>;
  clientSequence: number;
  loopProtection?: number;
}

export class GenericSyncEngine {
  private db: Kysely<Database>;
  private syncMetadata: Record<string, TableSyncMetadata>;
  private junctionTables: JunctionTable[];
  private containerPermissionService: ContainerPermissionService;

  constructor(
    databaseUrl: string,
    syncMetadata: Record<string, TableSyncMetadata>,
    junctionTables: JunctionTable[],
    environment?: string
  ) {
    // Configure Neon for local development if environment is provided
    if (environment === "local" || environment === "development") {
      neonConfig.fetchEndpoint = (host) => {
        if (host === 'db.localtest.me') {
          return 'http://db.localtest.me:4444/sql';
        }
        return `https://${host}/sql`;
      };
    }
    
    this.db = new Kysely<Database>({
      dialect: new NeonHTTPDialect({ connectionString: databaseUrl }),
    });
    this.syncMetadata = syncMetadata;
    this.junctionTables = junctionTables;
    this.containerPermissionService = new ContainerPermissionService(this.db);
  }

  /**
   * Process all local changes from the client
   */
  async processLocalChanges(changes: LocalChange[]): Promise<void> {
    // Group changes by table for batch processing
    const changesByTable = new Map<string, LocalChange[]>();
    
    for (const change of changes) {
      const existing = changesByTable.get(change.tableName) || [];
      existing.push(change);
      changesByTable.set(change.tableName, existing);
    }

    // Process each table's changes
    for (const [tableName, tableChanges] of changesByTable) {
      await this.processTableChanges(tableName, tableChanges);
    }
  }

  /**
   * Process changes for a specific table
   */
  private async processTableChanges(tableName: string, changes: LocalChange[]): Promise<void> {
    // Check if it's a junction table
    const junctionTable = this.junctionTables.find(jt => jt.tableName === tableName);
    if (junctionTable) {
      await this.processJunctionTableChanges(junctionTable, changes);
      return;
    }

    // Get metadata for regular entity table
    const metadata = this.getMetadataByTableName(tableName);
    if (!metadata) {
      console.warn(`No metadata found for table: ${tableName}`);
      return;
    }

    for (const change of changes) {
      try {
        await this.applyChange(tableName as TableName, metadata, change);
      } catch (error) {
        console.error(`Error applying change to ${tableName}:`, error);
        // Could implement retry logic or dead letter queue here
      }
    }
  }

  /**
   * Process changes for junction tables (many-to-many relationships)
   */
  private async processJunctionTableChanges(
    junctionTable: JunctionTable,
    changes: LocalChange[]
  ): Promise<void> {
    const tableName = junctionTable.tableName as TableName;

    for (const change of changes) {
      try {
        switch (change.operationType) {
          case 'INSERT':
            await this.db
              .insertInto(tableName)
              .values(change.data)
              .execute();
            break;
            
          case 'DELETE':
            // For junction tables, we need both keys to delete
            let query = this.db.deleteFrom(tableName);
            for (const col of junctionTable.columns) {
              const fieldName = this.toSnakeCase(col.name);
              if (change.data[fieldName]) {
                query = query.where(col.name as any, '=', change.data[fieldName]);
              }
            }
            await query.execute();
            break;
            
          // Junction tables typically don't have updates
          default:
            console.warn(`Unexpected operation ${change.operationType} for junction table ${junctionTable.tableName}`);
        }
      } catch (error) {
        console.error(`Error processing junction table ${junctionTable.tableName}:`, error);
      }
    }
  }

  /**
   * Apply a single change to a table
   */
  private async applyChange(
    tableName: TableName,
    metadata: TableSyncMetadata,
    change: LocalChange
  ): Promise<void> {
    switch (change.operationType) {
      case 'INSERT':
      case 'UPDATE':
        await this.upsertRecord(tableName, metadata, change);
        break;
        
      case 'DELETE':
        await this.deleteRecord(tableName, metadata, change);
        break;
        
      default:
        console.warn(`Unknown operation type: ${change.operationType}`);
    }
  }

  /**
   * Upsert a record (insert or update)
   */
  private async upsertRecord(
    tableName: TableName,
    metadata: TableSyncMetadata,
    change: LocalChange
  ): Promise<void> {
    const data = this.prepareDataForUpsert(metadata, change.data);
    
    if (metadata.features.hasClientId) {
      // Use client_id for conflict resolution
      const clientIdField = metadata.columns.clientId as any;
      const existingRecord = await this.db
        .selectFrom(tableName)
        .selectAll()
        .where(clientIdField, '=', data[metadata.columns.clientId])
        .limit(1)
        .execute();

      if (existingRecord.length > 0) {
        // Update existing record
        await this.db
          .updateTable(tableName)
          .set(data)
          .where(clientIdField, '=', data[metadata.columns.clientId])
          .execute();
      } else {
        // Insert new record
        await this.db
          .insertInto(tableName)
          .values(data)
          .execute();
      }
    } else {
      // Use id for conflict resolution
      const idField = metadata.columns.id as any;
      const existingRecord = await this.db
        .selectFrom(tableName)
        .selectAll()
        .where(idField, '=', data[metadata.columns.id])
        .limit(1)
        .execute();

      if (existingRecord.length > 0) {
        // Update existing record
        await this.db
          .updateTable(tableName)
          .set(data)
          .where(idField, '=', data[metadata.columns.id])
          .execute();
      } else {
        // Insert new record
        await this.db
          .insertInto(tableName)
          .values(data)
          .execute();
      }
    }
  }

  /**
   * Delete a record (soft or hard delete)
   */
  private async deleteRecord(
    tableName: TableName,
    metadata: TableSyncMetadata,
    change: LocalChange
  ): Promise<void> {
    // CRITICAL: Extract the UUID for the specific record to delete
    const recordUuid = change.recordId || change.data?.id;
    
    // Validate UUID format (must be a valid UUID v4)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!recordUuid || !uuidRegex.test(recordUuid)) {
      console.error('🚨 DELETE BLOCKED - Invalid UUID:', {
        table: metadata.tableName,
        recordId: change.recordId,
        dataId: change.data?.id,
        clientId: change.data?.clientId || change.data?.client_id,
        fullData: change.data
      });
      throw new Error(
        `DELETE BLOCKED: Invalid or missing UUID for ${metadata.tableName}. ` +
        `Got: ${recordUuid}, expected UUID format`
      );
    }
    
    // Safety check: Prevent mass deletions
    const safetyCheck = DeleteSafetyCheck.checkDelete(metadata.tableName, recordUuid);
    if (!safetyCheck.allowed) {
      console.error('🚫 DELETE BLOCKED by safety check:', {
        table: metadata.tableName,
        uuid: recordUuid,
        reason: safetyCheck.reason
      });
      throw new Error(`DELETE BLOCKED: ${safetyCheck.reason}`);
    }
    
    // Log exactly what we're about to delete
    console.log('🗑️ DELETE Operation:', {
      table: metadata.tableName,
      uuid: recordUuid,
      clientId: change.data?.clientId || change.data?.client_id,
      softDelete: metadata.features.hasSoftDelete
    });
    
    if (metadata.features.hasSoftDelete) {
      // Soft delete - mark as deleted using the UUID primary key
      const updateData: Record<string, any> = {};
      updateData[metadata.columns.deleted] = true;
      updateData[metadata.columns.updatedAt] = new Date();
      
      const idField = metadata.columns.id as any;
      
      // Log the exact SQL-equivalent operation
      console.log(`📝 Soft DELETE: UPDATE ${metadata.tableName} SET deleted=true WHERE id='${recordUuid}'`);
      
      await this.db
        .updateTable(tableName)
        .set(updateData)
        .where(idField, '=', recordUuid)
        .execute();
      
      // Log successful soft delete
      DeleteSafetyCheck.logDelete(metadata.tableName, recordUuid, change.data?.clientId);
      console.log(`✅ Soft DELETE completed for ${metadata.tableName}:${recordUuid}`);
    } else {
      // Hard delete - use the UUID primary key ONLY
      const idField = metadata.columns.id as any;
      
      // Log the exact SQL-equivalent operation  
      console.log(`⚠️ Hard DELETE: DELETE FROM ${metadata.tableName} WHERE id='${recordUuid}'`);
      
      await this.db
        .deleteFrom(tableName)
        .where(idField, '=', recordUuid)
        .execute();
      
      // Log successful hard delete
      DeleteSafetyCheck.logDelete(metadata.tableName, recordUuid, change.data?.clientId);
      console.log(`✅ Hard DELETE completed for ${metadata.tableName}:${recordUuid}`);
    }
  }

  /**
   * Prepare data for upsert, converting field names and handling special fields
   */
  private prepareDataForUpsert(
    metadata: TableSyncMetadata,
    rawData: Record<string, any>
  ): Record<string, any> {
    const data: Record<string, any> = {};
    
    // Convert camelCase to snake_case for database columns
    for (const [key, value] of Object.entries(rawData)) {
      const snakeKey = this.toSnakeCase(key);
      
      // Skip id field - it's handled separately
      if (snakeKey === 'id') {
        if (!data[snakeKey]) {
          data[snakeKey] = value;
        }
        continue;
      }
      
      // Handle special timestamp fields that need Date objects
      if (snakeKey === 'created_at' || snakeKey === 'updated_at') {
        if (value instanceof Date) {
          data[snakeKey] = value;
        } else if (typeof value === 'string') {
          data[snakeKey] = new Date(value);
        } else if (snakeKey === 'updated_at') {
          data[snakeKey] = new Date(); // Always update updated_at
        }
      } else if (value !== undefined && value !== null) {
        // All other fields pass through as-is (including text date fields)
        data[snakeKey] = value;
      }
    }
    
    // Ensure required fields are present
    if (!data.id) {
      data.id = crypto.randomUUID();
    }
    if (!data.created_at) {
      data.created_at = new Date();
    }
    data.updated_at = new Date();
    
    return data;
  }

  /**
   * Get all changes that need to be synced to a client
   * For initial sync, this returns records filtered by user permissions
   * (LSN-based sync happens elsewhere in the system)
   */
  async getChangesForClient(
    lastSyncTimestamp: Date,
    tables: string[] = [],
    userId?: string,
    organizationId?: string
  ): Promise<Record<string, any[]>> {
    console.log('DEBUG: getChangesForClient called with tables:', tables);
    const changes: Record<string, any[]> = {};
    
    // CRITICAL: Only use provided tables - never fall back to getTrackedTables()
    // The caller is responsible for providing the correct organization-scoped tables
    if (tables.length === 0) {
      console.warn('DEBUG: No tables provided to getChangesForClient - returning empty results');
      return {};
    }
    
    const tablesToSync = tables;
    console.log('DEBUG: Tables to sync (organization-scoped):', tablesToSync);
    
    for (const tableName of tablesToSync) {
      console.log('DEBUG: Processing table:', tableName);
      
      try {
        // For initial sync, get ALL records from each table
        // LSN-based incremental sync is handled by the replication system
        const records = await this.db
          .selectFrom(tableName as TableName)
          .selectAll()
          .limit(1000)
          .execute();
        console.log(`DEBUG: Found ${records.length} records in ${tableName}`);
        
        if (records.length > 0) {
          // Apply user-based record filtering if userId is provided
          if (userId && organizationId) {
            const filteredRecords = await this.filterRecordsForUser(
              records, 
              tableName, 
              userId, 
              organizationId
            );
            console.log(`DEBUG: After user filtering: ${filteredRecords.length}/${records.length} records allowed for user ${userId}`);
            changes[tableName] = filteredRecords;
          } else {
            changes[tableName] = records;
          }
        }
      } catch (error) {
        console.log(`DEBUG: Error querying table ${tableName}:`, error);
      }
    }
    
    return changes;
  }

  /**
   * Filter records based on user's container permissions
   */
  private async filterRecordsForUser(
    records: any[],
    tableName: string,
    userId: string,
    organizationId: string
  ): Promise<any[]> {
    if (!records || records.length === 0) {
      return records;
    }

    console.log(`DEBUG: Filtering ${records.length} records from ${tableName} for user ${userId}`);

    // Get user's container permissions
    const userPermissions = await this.containerPermissionService.getUserContainerPermissions(
      userId,
      organizationId
    );

    console.log(`DEBUG: User has ${userPermissions.length} container permissions`);

    const filteredRecords = [];

    for (const record of records) {
      const hasAccess = await this.checkRecordAccess(
        record,
        tableName,
        userId,
        organizationId,
        userPermissions
      );

      if (hasAccess) {
        filteredRecords.push(record);
      }
    }

    console.log(`DEBUG: Filtered to ${filteredRecords.length} records for user ${userId}`);
    return filteredRecords;
  }

  /**
   * Check if a user has access to a specific record
   */
  private async checkRecordAccess(
    record: any,
    tableName: string,
    userId: string,
    organizationId: string,
    userPermissions: any[]
  ): Promise<boolean> {
    // Owner role has access to everything
    const hasOwnerRole = userPermissions.some(p => 
      p.containerType === 'organization' && 
      p.containerId === organizationId && 
      p.role === 'owner'
    );

    if (hasOwnerRole) {
      return true;
    }

    // Check if user created or is assigned to this record
    if (record.created_by === userId || record.assigned_to === userId) {
      return true;
    }

    // For project tables, check if user has project-level permissions
    if (tableName.includes('_project') && record.id) {
      const hasProjectPermission = userPermissions.some(p =>
        p.containerType === 'project' && 
        p.containerId === record.id &&
        p.canRead
      );
      if (hasProjectPermission) {
        return true;
      }
    }

    // For task tables, check project permissions via project_id
    if (tableName.includes('_task') && record.project_id) {
      const hasProjectPermission = userPermissions.some(p =>
        p.containerType === 'project' && 
        p.containerId === record.project_id &&
        p.canRead
      );
      if (hasProjectPermission) {
        return true;
      }
    }

    // For time_entry tables, check task permissions via task_id
    if (tableName.includes('_time_entry') && record.task_id) {
      // First, we'd need to get the task to check its project
      // For now, allow if user created or is assigned to the time entry
      return record.created_by === userId || record.user_id === userId;
    }

    // Admin role gets broad access within organization
    const hasAdminRole = userPermissions.some(p => 
      p.containerType === 'organization' && 
      p.containerId === organizationId && 
      p.role === 'admin'
    );

    if (hasAdminRole) {
      return true;
    }

    // Manager role gets read access to most organization data
    const hasManagerRole = userPermissions.some(p => 
      p.containerType === 'organization' && 
      p.containerId === organizationId && 
      p.role === 'manager'
    );

    if (hasManagerRole && ['project', 'task'].some(type => tableName.includes(`_${type}`))) {
      return true;
    }

    // Default deny
    return false;
  }

  /**
   * Get list of tables that should be tracked for sync
   */
  private getTrackedTables(): string[] {
    return Object.values(this.syncMetadata)
      .filter(m => m.syncable)
      .map(m => m.tableName);
  }

  /**
   * Helper to get metadata by table name
   */
  private getMetadataByTableName(tableName: string): TableSyncMetadata | undefined {
    return Object.values(this.syncMetadata).find(m => m.tableName === tableName);
  }

  /**
   * Convert snake_case to camelCase
   */
  private toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Convert camelCase to snake_case
   */
  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
  }

  /**
   * Update sync metadata after successful sync
   */
  async updateSyncMetadata(clientId: string, syncVersion: string): Promise<void> {
    try {
      console.log('DEBUG: Updating sync metadata for client:', clientId, 'with version:', syncVersion);
      
      // Try to insert into sync_metadata table if it exists
      await this.db
        .insertInto('sync_metadata' as TableName)
        .values({
          table_name: 'all', // Could track per-table sync status
          last_synced_version: syncVersion,
          last_synced_at: new Date(),
        } as any)
        .execute();
    } catch (error) {
      console.warn('Could not update sync metadata (table may not exist):', error);
    }
  }
}