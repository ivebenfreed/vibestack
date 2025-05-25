import { TableChange } from '@repo/sync-types';

/**
 * Encoder for local relationship operations to sync protocol format
 * Used when client makes local changes that need to be sent to server
 */
export class RelationshipChangeEncoder {
  
  /**
   * Encode local relationship operations as TableChange objects for sync
   */
  static encodeRelationshipChange(
    entityTable: string,
    entityId: string,
    relationName: string,
    operation: 'set' | 'add' | 'remove',
    targetIds: string[]
  ): TableChange {
    return {
      table: entityTable,
      operation: 'update',
      data: { id: entityId },
      relationshipUpdates: [{
        relationName,
        operation,
        targetIds
      }],
      entityRelations: [relationName],
      updated_at: new Date().toISOString(),
      client_id: getCurrentClientId() // Add client ID for conflict resolution
    };
  }
  
  /**
   * Encode multiple relationship operations as a single change
   */
  static encodeBatchRelationshipChanges(
    entityTable: string,
    entityId: string,
    operations: Array<{
      relationName: string;
      operation: 'set' | 'add' | 'remove';
      targetIds: string[];
    }>
  ): TableChange {
    return {
      table: entityTable,
      operation: 'update',
      data: { id: entityId },
      relationshipUpdates: operations,
      entityRelations: operations.map(op => op.relationName),
      updated_at: new Date().toISOString(),
      client_id: getCurrentClientId()
    };
  }
}

// Helper function to get current client ID
function getCurrentClientId(): string {
  // Implementation depends on your client ID strategy
  return localStorage.getItem('client_id') || 'unknown';
} 