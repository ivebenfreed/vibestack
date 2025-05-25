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
 */
export interface TableChange {
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: Record<string, unknown>;
  updated_at: string;  // ISO timestamp of when the record was updated
  lsn?: string;        // WAL LSN for ordering
  client_id?: string;  // Client ID for conflict resolution
  
  // ✨ NEW: TypeORM-native relationship support
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
    && typeof p.updated_at === 'string';
}

export function isRelationshipUpdate(payload: unknown): payload is RelationshipUpdate {
  const p = payload as RelationshipUpdate;
  return p
    && typeof p.relationName === 'string'
    && ['set', 'add', 'remove'].includes(p.operation)
    && Array.isArray(p.targetIds)
    && p.targetIds.every(id => typeof id === 'string');
} 