import { TableChange } from '@repo/sync-types';
import { 
  CLIENT_RELATIONSHIP_CONFIGS,
  getJunctionRelationships,
  hasRelationshipConfig 
} from '@repo/dataforge/client-entities';

/**
 * Encoder for local relationship operations to sync protocol format
 * Used when client makes local changes that need to be sent to server
 * 
 * Now integrated with the auto-generated RelationshipProcessor configuration system
 */
export class RelationshipChangeEncoder {
  
  /**
   * Encode local relationship operations as TableChange objects for sync
   * Uses auto-generated entity relationship configuration to validate the operation
   */
  static encodeRelationshipChange(
    entityTable: string,
    entityId: string,
    relationName: string,
    operation: 'set' | 'add' | 'remove',
    targetIds: string[]
  ): TableChange {
    // Validate that the relationship exists in auto-generated configuration
    const junctionRelationships = getJunctionRelationships(entityTable);
    const hasRelation = junctionRelationships.some(
      rel => rel.relationName === relationName
    );
    
    if (!hasRelation) {
      console.warn(`[RelationshipChangeEncoder] Unknown relationship '${relationName}' for entity '${entityTable}'. Available relationships:`, 
        junctionRelationships.map(r => r.relationName));
    }

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
      updatedAt: new Date().toISOString(),
      clientId: getCurrentClientId()
    };
  }
  
  /**
   * Encode multiple relationship operations as a single change
   * Validates all relationships against auto-generated entity configuration
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
    // Validate all relationships against auto-generated configuration
    const junctionRelationships = getJunctionRelationships(entityTable);
    const validRelations = new Set(junctionRelationships.map(rel => rel.relationName));
    
    operations.forEach(op => {
      if (!validRelations.has(op.relationName)) {
        console.warn(`[RelationshipChangeEncoder] Unknown relationship '${op.relationName}' for entity '${entityTable}'. Available relationships:`, 
          Array.from(validRelations));
      }
    });

    return {
      table: entityTable,
      operation: 'update',
      data: { id: entityId },
      relationshipUpdates: operations,
      entityRelations: operations.map(op => op.relationName),
      updatedAt: new Date().toISOString(),
      clientId: getCurrentClientId()
    };
  }

  /**
   * Get available relationships for an entity from auto-generated configuration
   */
  static getAvailableRelationships(entityTable: string): string[] {
    return getJunctionRelationships(entityTable).map(rel => rel.relationName);
  }

  /**
   * Validate a relationship operation against auto-generated entity configuration
   */
  static validateRelationshipOperation(
    entityTable: string,
    relationName: string,
    operation: 'set' | 'add' | 'remove',
    targetIds: string[]
  ): { valid: boolean; error?: string } {
    if (!hasRelationshipConfig(entityTable)) {
      return { valid: false, error: `No relationship configuration found for entity '${entityTable}'` };
    }

    const junctionRelationships = getJunctionRelationships(entityTable);
    
    if (junctionRelationships.length === 0) {
      return { valid: false, error: `Entity '${entityTable}' has no junction relationships configured` };
    }

    const relationship = junctionRelationships.find(rel => rel.relationName === relationName);
    if (!relationship) {
      const availableRelations = junctionRelationships.map(r => r.relationName);
      return { 
        valid: false, 
        error: `Unknown relationship '${relationName}' for entity '${entityTable}'. Available: ${availableRelations.join(', ')}` 
      };
    }

    if (targetIds.length === 0 && operation !== 'set') {
      return { valid: false, error: `Operation '${operation}' requires at least one target ID` };
    }

    return { valid: true };
  }

  /**
   * Get detailed relationship information for an entity
   */
  static getRelationshipInfo(entityTable: string, relationName?: string) {
    const junctionRelationships = getJunctionRelationships(entityTable);
    
    if (relationName) {
      return junctionRelationships.find(rel => rel.relationName === relationName);
    }
    
    return junctionRelationships;
  }
}

// Helper function to get current client ID
function getCurrentClientId(): string {
  // Implementation depends on your client ID strategy
  return localStorage.getItem('clientId') || 'unknown';
} 