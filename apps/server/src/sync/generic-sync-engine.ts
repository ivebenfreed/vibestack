/**
 * Generic Sync Engine
 * 
 * Table-agnostic sync engine that uses metadata to sync any entity
 * without requiring domain-specific code.
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, and, or, sql, inArray, gt } from 'drizzle-orm';
import type { 
  TableSyncMetadata, 
  JunctionTable,
  TRACKED_TABLES
} from '@repo/dataforge-next/sync-metadata';

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
  private db: any;
  private schema: any;
  private syncMetadata: Record<string, TableSyncMetadata>;
  private junctionTables: JunctionTable[];

  constructor(
    databaseUrl: string,
    schema: any,
    syncMetadata: Record<string, TableSyncMetadata>,
    junctionTables: JunctionTable[]
  ) {
    const client = neon(databaseUrl);
    this.db = drizzle(client, { schema });
    this.schema = schema;
    this.syncMetadata = syncMetadata;
    this.junctionTables = junctionTables;
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

    const table = this.getTableFromSchema(tableName);
    if (!table) {
      console.warn(`No schema found for table: ${tableName}`);
      return;
    }

    for (const change of changes) {
      try {
        await this.applyChange(table, metadata, change);
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
    // Junction tables preserve underscores in schema export names
    const table = this.schema[junctionTable.tableName + 'Table'];
    if (!table) {
      console.warn(`No schema found for junction table: ${junctionTable.tableName} (looking for ${this.toCamelCase(junctionTable.tableName) + 'Table'})`);
      return;
    }

    for (const change of changes) {
      try {
        switch (change.operationType) {
          case 'INSERT':
            await this.db.insert(table).values(change.data);
            break;
            
          case 'DELETE':
            // For junction tables, we need both keys to delete
            const conditions = [];
            for (const col of junctionTable.columns) {
              const fieldName = this.toSnakeCase(col.name);
              if (change.data[fieldName]) {
                conditions.push(eq(table[col.name], change.data[fieldName]));
              }
            }
            if (conditions.length > 0) {
              await this.db.delete(table).where(and(...conditions));
            }
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
    table: any,
    metadata: TableSyncMetadata,
    change: LocalChange
  ): Promise<void> {
    switch (change.operationType) {
      case 'INSERT':
      case 'UPDATE':
        await this.upsertRecord(table, metadata, change);
        break;
        
      case 'DELETE':
        await this.deleteRecord(table, metadata, change);
        break;
        
      default:
        console.warn(`Unknown operation type: ${change.operationType}`);
    }
  }

  /**
   * Upsert a record (insert or update)
   */
  private async upsertRecord(
    table: any,
    metadata: TableSyncMetadata,
    change: LocalChange
  ): Promise<void> {
    const data = this.prepareDataForUpsert(metadata, change.data);
    
    if (metadata.features.hasClientId) {
      // Use client_id for conflict resolution
      const existingRecord = await this.db
        .select()
        .from(table)
        .where(eq(table.clientId, data.client_id))
        .limit(1);

      if (existingRecord.length > 0) {
        // Update existing record
        await this.db
          .update(table)
          .set(data)
          .where(eq(table.clientId, data.client_id));
      } else {
        // Insert new record
        await this.db.insert(table).values(data);
      }
    } else {
      // Use id for conflict resolution
      const existingRecord = await this.db
        .select()
        .from(table)
        .where(eq(table.id, data.id))
        .limit(1);

      if (existingRecord.length > 0) {
        // Update existing record
        await this.db
          .update(table)
          .set(data)
          .where(eq(table.id, data.id));
      } else {
        // Insert new record
        await this.db.insert(table).values(data);
      }
    }
  }

  /**
   * Delete a record (soft or hard delete)
   */
  private async deleteRecord(
    table: any,
    metadata: TableSyncMetadata,
    change: LocalChange
  ): Promise<void> {
    if (metadata.features.hasSoftDelete) {
      // Soft delete - just mark as deleted
      const updateData = {
        deleted: true,
        updated_at: new Date()
      };
      
      if (metadata.features.hasClientId && change.data.client_id) {
        await this.db
          .update(table)
          .set(updateData)
          .where(eq(table.clientId, change.data.client_id));
      } else {
        await this.db
          .update(table)
          .set(updateData)
          .where(eq(table.id, change.recordId));
      }
    } else {
      // Hard delete
      if (metadata.features.hasClientId && change.data.client_id) {
        await this.db
          .delete(table)
          .where(eq(table.clientId, change.data.client_id));
      } else {
        await this.db
          .delete(table)
          .where(eq(table.id, change.recordId));
      }
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
      
      // Skip fields that shouldn't be updated
      if (snakeKey === 'id' || snakeKey === 'created_at') {
        if (!data[snakeKey]) {
          data[snakeKey] = value;
        }
        continue;
      }
      
      // Handle special date fields
      if (snakeKey === 'updated_at') {
        data[snakeKey] = new Date();
      } else if (value !== undefined && value !== null) {
        // Handle date strings
        if (snakeKey.includes('_at') || snakeKey.includes('date')) {
          data[snakeKey] = new Date(value);
        } else {
          data[snakeKey] = value;
        }
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
   */
  async getChangesForClient(
    lastSyncTimestamp: Date,
    tables: string[] = []
  ): Promise<Record<string, any[]>> {
    const changes: Record<string, any[]> = {};
    
    // Use provided tables or all tracked tables
    const tablesToSync = tables.length > 0 ? tables : this.getTrackedTables();
    
    for (const tableName of tablesToSync) {
      const metadata = this.getMetadataByTableName(tableName);
      if (!metadata || !metadata.syncable) {
        continue;
      }
      
      const table = this.getTableFromSchema(tableName);
      if (!table) {
        continue;
      }
      
      // Get records updated since last sync
      const records = await this.db
        .select()
        .from(table)
        .where(gt(table.updated_at, lastSyncTimestamp))
        .limit(1000); // Paginate for large datasets
      
      if (records.length > 0) {
        changes[tableName] = records;
      }
    }
    
    // Also get junction table changes
    for (const junctionTable of this.junctionTables) {
      // Junction tables preserve underscores in schema export names
    const table = this.schema[junctionTable.tableName + 'Table'];
      if (!table) {
        continue;
      }
      
      // Junction tables might not have updatedAt, so we need a different strategy
      // This is simplified - in production you'd track junction table changes separately
      const records = await this.db.select().from(table);
      if (records.length > 0) {
        changes[junctionTable.tableName] = records;
      }
    }
    
    return changes;
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

  // Manual mapping table for known mismatches between table names and schema exports
  private static readonly TABLE_MAPPINGS: Record<string, string> = {
    'tag_sets': 'tagsetTable',
    'tags': 'tagTable', 
    'status_sets': 'statussetTable',
    'status_definitions': 'statusdefinitionTable'
  };

  /**
   * Get table from schema by table name, handling various naming conventions
   */
  private getTableFromSchema(tableName: string): any {
    // Check manual mappings first
    if (GenericSyncEngine.TABLE_MAPPINGS[tableName]) {
      return this.schema[GenericSyncEngine.TABLE_MAPPINGS[tableName]];
    }

    // Standard pattern: toCamelCase + 'Table'
    const camelCase = this.toCamelCase(tableName);
    let table = this.schema[camelCase + 'Table'];
    if (table) return table;

    // Try className.toLowerCase() + 'Table' pattern (used in schema generation)
    const schemaKeys = Object.keys(this.schema);
    const matchingKey = schemaKeys.find(key => {
      if (!key.endsWith('Table')) return false;
      const baseName = key.slice(0, -5); // Remove 'Table' suffix
      
      // Check if this table name matches our target in various forms
      return baseName.toLowerCase() === tableName.toLowerCase() ||
             baseName.toLowerCase() === camelCase.toLowerCase() ||
             key.toLowerCase() === (tableName + 'table').toLowerCase();
    });

    if (matchingKey) {
      return this.schema[matchingKey];
    }

    return null;
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
    const syncMetadataTable = this.schema.syncMetadata;
    if (!syncMetadataTable) {
      console.warn('No sync_metadata table in schema');
      return;
    }
    
    await this.db.insert(syncMetadataTable).values({
      id: crypto.randomUUID(),
      table_name: 'all', // Could track per-table sync status
      last_synced_version: syncVersion,
      last_synced_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    });
  }
}