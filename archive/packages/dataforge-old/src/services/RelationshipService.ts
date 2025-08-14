import { EntityRelationship } from '../entities/EntityRelationship.js';

export interface RelationshipData {
  sourceArchetype: string;
  sourceId: string;
  targetArchetype: string;
  targetId: string;
  relationshipType: string;
  metadata?: any;
  sortOrder?: number;
  isBidirectional?: boolean;
}

export interface RelationshipQuery {
  archetype?: string;
  entityId?: string;
  relationshipType?: string;
  direction?: 'source' | 'target' | 'both';
}

/**
 * Service for managing universal polymorphic relationships
 */
export class RelationshipService {
  
  /**
   * Validate relationship data before creation
   */
  validateRelationshipData(data: RelationshipData): string[] {
    const errors: string[] = [];

    // Validate required fields
    if (!data.sourceArchetype || data.sourceArchetype.trim() === '') {
      errors.push('Source archetype is required');
    }

    if (!data.sourceId || data.sourceId.trim() === '') {
      errors.push('Source ID is required');
    }

    if (!data.targetArchetype || data.targetArchetype.trim() === '') {
      errors.push('Target archetype is required');
    }

    if (!data.targetId || data.targetId.trim() === '') {
      errors.push('Target ID is required');
    }

    if (!data.relationshipType || data.relationshipType.trim() === '') {
      errors.push('Relationship type is required');
    }

    // Validate relationship type
    const validTypes = [
      'depends_on', 'blocks', 'blocked_by',
      'parent_of', 'child_of', 'contains', 'contained_by',
      'relates_to', 'references', 'referenced_by'
    ];

    if (data.relationshipType && !validTypes.includes(data.relationshipType)) {
      errors.push(`Invalid relationship type: ${data.relationshipType}`);
    }

    // Prevent self-relationships
    if (data.sourceArchetype === data.targetArchetype && data.sourceId === data.targetId) {
      errors.push('Entity cannot have a relationship with itself');
    }

    return errors;
  }

  /**
   * Check for circular dependency relationships
   */
  checkCircularDependency(relationships: EntityRelationship[], newRelationship: RelationshipData): boolean {
    if (!newRelationship.relationshipType.includes('depends_on') && !newRelationship.relationshipType.includes('blocks')) {
      return false; // Only check for dependency relationships
    }

    // Create a graph of dependencies
    const graph = new Map<string, Set<string>>();
    
    // Add existing relationships
    for (const rel of relationships) {
      if (rel.relationshipType === 'depends_on' || rel.relationshipType === 'blocks') {
        const sourceKey = `${rel.sourceArchetype}:${rel.sourceId}`;
        const targetKey = `${rel.targetArchetype}:${rel.targetId}`;
        
        if (!graph.has(sourceKey)) {
          graph.set(sourceKey, new Set());
        }
        graph.get(sourceKey)!.add(targetKey);
      }
    }

    // Add the new relationship
    const newSourceKey = `${newRelationship.sourceArchetype}:${newRelationship.sourceId}`;
    const newTargetKey = `${newRelationship.targetArchetype}:${newRelationship.targetId}`;
    
    if (!graph.has(newSourceKey)) {
      graph.set(newSourceKey, new Set());
    }
    graph.get(newSourceKey)!.add(newTargetKey);

    // Check for cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    function hasCycle(node: string): boolean {
      if (recursionStack.has(node)) {
        return true; // Found a cycle
      }
      
      if (visited.has(node)) {
        return false; // Already processed this node
      }

      visited.add(node);
      recursionStack.add(node);

      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (hasCycle(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    }

    // Check all nodes for cycles
    for (const node of graph.keys()) {
      if (!visited.has(node) && hasCycle(node)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get default relationship types for different archetype combinations
   */
  getDefaultRelationshipTypes(sourceArchetype: string, targetArchetype: string): string[] {
    const relationshipMatrix: Record<string, Record<string, string[]>> = {
      project: {
        project: ['parent_of', 'child_of', 'relates_to'],
        task: ['contains', 'relates_to'],
        record: ['relates_to', 'references'],
        document: ['relates_to', 'references'],
        file: ['relates_to', 'references'],
        activity: ['relates_to'],
        discussion: ['relates_to'],
        collection: ['relates_to']
      },
      task: {
        project: ['contained_by', 'relates_to'],
        task: ['depends_on', 'blocks', 'parent_of', 'child_of', 'relates_to'],
        record: ['relates_to', 'references'],
        document: ['relates_to', 'references'],
        file: ['relates_to', 'references'],
        activity: ['relates_to'],
        discussion: ['relates_to'],
        collection: ['relates_to']
      },
      record: {
        project: ['relates_to', 'referenced_by'],
        task: ['relates_to', 'referenced_by'],
        record: ['parent_of', 'child_of', 'relates_to'],
        document: ['relates_to', 'references'],
        file: ['relates_to', 'references'],
        activity: ['relates_to'],
        discussion: ['relates_to'],
        collection: ['relates_to']
      }
    };

    return relationshipMatrix[sourceArchetype]?.[targetArchetype] || ['relates_to'];
  }

  /**
   * Create bidirectional relationship if specified
   */
  createBidirectionalRelationship(relationship: RelationshipData): RelationshipData | null {
    if (!relationship.isBidirectional) {
      return null;
    }

    const inverseType = this.getInverseRelationshipType(relationship.relationshipType);
    if (!inverseType) {
      return null;
    }

    return {
      sourceArchetype: relationship.targetArchetype,
      sourceId: relationship.targetId,
      targetArchetype: relationship.sourceArchetype,
      targetId: relationship.sourceId,
      relationshipType: inverseType,
      metadata: relationship.metadata,
      sortOrder: relationship.sortOrder,
      isBidirectional: false // Prevent infinite recursion
    };
  }

  /**
   * Get the inverse relationship type
   */
  private getInverseRelationshipType(relationshipType: string): string | null {
    const inverseMap: Record<string, string> = {
      'depends_on': 'blocks',
      'blocks': 'depends_on',
      'parent_of': 'child_of',
      'child_of': 'parent_of',
      'contains': 'contained_by',
      'contained_by': 'contains',
      'relates_to': 'relates_to', // Self-inverse
      'references': 'referenced_by',
      'referenced_by': 'references'
    };

    return inverseMap[relationshipType] || null;
  }
}