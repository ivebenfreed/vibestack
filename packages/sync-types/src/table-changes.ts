/**
 * Relationship update information for junction table operations
 */
export interface RelationshipUpdate {
  relationName: string;        // 'members', 'dependencies', 'tasks'
  operation: 'set' | 'add' | 'remove';
  targetIds: string[];         // Complete state for 'set', deltas for 'add'/'remove'
}

/**
 * Core change type for replication
 * Represents a change to a table that needs to be replicated
 * 
 * IMPORTANT: The `data` field should contain TypeORM entity data in camelCase format
 * with proper types (Date objects for dates, not strings). This preserves TypeORM
 * entity structure throughout the sync pipeline and reduces unnecessary conversions.
 */
export interface TableChange {
  table: string;
  operation: 'insert' | 'update' | 'delete';
  
  /**
   * Entity data in TypeORM format (camelCase properties, proper types)
   * - Date fields should be Date objects, not ISO strings
   * - Property names should match TypeORM entity properties (camelCase)
   * - This preserves the entity structure from client to server
   */
  data: Record<string, unknown>;
  
  /**
   * ISO timestamp string of when the record was last updated
   * This is separate from data.updatedAt to avoid confusion
   */
  updatedAt: string;
  
  lsn?: string;        // WAL LSN for ordering
  clientId?: string;  // Client ID for conflict resolution
  
  // ✨ TypeORM-native relationship support
  relationshipUpdates?: RelationshipUpdate[];
  entityRelations?: string[]; // Which relations to load/save
}

// Type guards for message handling
export function isTableChange(payload: unknown): payload is TableChange {
  const p = payload as TableChange;
  return p 
    && typeof p.table === 'string'
    && ['insert', 'update', 'delete'].includes(p.operation)
    && typeof p.data === 'object'
    && p.data !== null
    && typeof p.updatedAt === 'string';
}

export function isRelationshipUpdate(payload: unknown): payload is RelationshipUpdate {
  const p = payload as RelationshipUpdate;
  return p
    && typeof p.relationName === 'string'
    && ['set', 'add', 'remove'].includes(p.operation)
    && Array.isArray(p.targetIds)
    && p.targetIds.every(id => typeof id === 'string');
} 