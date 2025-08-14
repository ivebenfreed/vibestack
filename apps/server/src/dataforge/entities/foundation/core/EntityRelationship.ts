/**
 * EntityRelationship Entity - Universal System Entity
 * 
 * Adapted from archived DataForge MikroORM entity to Kysely-based system.
 * Provides polymorphic relationships between any entities in the system.
 * Extends BaseSystemEntity for audit trails and core functionality.
 */

import { BaseSystemEntity } from '../../base/BaseSystemEntity';
import type { BaseSystemEntityFields } from '../../base/BaseSystemEntity';

export interface EntityRelationshipFields extends BaseSystemEntityFields {
  source_entity_type: string;
  source_entity_id: string;
  target_entity_type: string;
  target_entity_id: string;
  relationship_type: string;
  metadata: any;
  sort_order: number;
  is_active: boolean;
  is_bidirectional: boolean;
  created_by_user_id: string | null;
}

export class EntityRelationship extends BaseSystemEntity {
  source_entity_type!: string; // project, task, record, document, file, activity, discussion, collection
  source_entity_id!: string; // UUID of the source entity
  target_entity_type!: string; // project, task, record, document, file, activity, discussion, collection
  target_entity_id!: string; // UUID of the target entity
  relationship_type!: string; // depends_on, blocks, relates_to, contains, references, parent_of, child_of
  metadata!: any; // Relationship-specific data (strength, notes, conditions, etc.)
  sort_order!: number; // For ordered relationships
  is_active!: boolean; // Allow soft deletion of relationships
  is_bidirectional!: boolean; // Whether this relationship implies the reverse
  created_by_user_id?: string | null; // User who created this relationship

  constructor(data?: Partial<EntityRelationshipFields>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
    
    // Set defaults if not provided
    if (this.sort_order === undefined) this.sort_order = 0;
    if (this.is_active === undefined) this.is_active = true;
    if (this.is_bidirectional === undefined) this.is_bidirectional = false;
    if (!this.metadata) this.metadata = {};
  }

  /**
   * Get the Kysely schema definition for EntityRelationship table
   */
  static getKyselySchema() {
    return {
      ...super.getKyselySchema(),
      source_entity_type: 'varchar(50)',
      source_entity_id: 'uuid',
      target_entity_type: 'varchar(50)',
      target_entity_id: 'uuid',
      relationship_type: 'varchar(50)',
      metadata: 'jsonb',
      sort_order: 'integer',
      is_active: 'boolean',
      is_bidirectional: 'boolean',
      created_by_user_id: 'uuid'
    } as const;
  }

  /**
   * Get the SQL DDL for EntityRelationship table creation
   */
  static getEntityRelationshipDDL(): string {
    return `
      CREATE TABLE IF NOT EXISTS "entity_relationship" (
        ${super.getSystemDDL()},
        source_entity_type VARCHAR(50) NOT NULL,
        source_entity_id UUID NOT NULL,
        target_entity_type VARCHAR(50) NOT NULL,
        target_entity_id UUID NOT NULL,
        relationship_type VARCHAR(50) NOT NULL,
        metadata JSONB DEFAULT '{}' NOT NULL,
        sort_order INTEGER DEFAULT 0 NOT NULL,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        is_bidirectional BOOLEAN DEFAULT FALSE NOT NULL,
        created_by_user_id UUID REFERENCES "user"(id),
        CONSTRAINT unique_entity_relationship UNIQUE (
          source_entity_type, source_entity_id, target_entity_type, 
          target_entity_id, relationship_type
        ),
        CONSTRAINT chk_different_entities CHECK (
          NOT (source_entity_type = target_entity_type AND source_entity_id = target_entity_id)
        )
      );
    `;
  }

  /**
   * Get the indexes for EntityRelationship table
   */
  static getEntityRelationshipIndexes(): string[] {
    return [
      ...super.getSystemIndexes('entity_relationship'),
      `CREATE INDEX IF NOT EXISTS idx_entity_relationship_source ON "entity_relationship"(source_entity_type, source_entity_id);`,
      `CREATE INDEX IF NOT EXISTS idx_entity_relationship_target ON "entity_relationship"(target_entity_type, target_entity_id);`,
      `CREATE INDEX IF NOT EXISTS idx_entity_relationship_type ON "entity_relationship"(relationship_type);`,
      `CREATE INDEX IF NOT EXISTS idx_entity_relationship_active ON "entity_relationship"(is_active);`,
      `CREATE INDEX IF NOT EXISTS idx_entity_relationship_sort ON "entity_relationship"(sort_order);`,
      `CREATE INDEX IF NOT EXISTS idx_entity_relationship_bidirectional ON "entity_relationship"(is_bidirectional);`,
      `CREATE INDEX IF NOT EXISTS idx_entity_relationship_created_by ON "entity_relationship"(created_by_user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_entity_relationship_metadata ON "entity_relationship" USING GIN(metadata);`
    ];
  }

  /**
   * Prepare data for database insertion
   */
  prepareForInsert(): EntityRelationshipFields {
    const baseData = super.prepareForInsert();
    return {
      ...baseData,
      source_entity_type: this.source_entity_type,
      source_entity_id: this.source_entity_id,
      target_entity_type: this.target_entity_type,
      target_entity_id: this.target_entity_id,
      relationship_type: this.relationship_type,
      metadata: this.metadata || {},
      sort_order: this.sort_order || 0,
      is_active: this.is_active !== false,
      is_bidirectional: this.is_bidirectional || false,
      created_by_user_id: this.created_by_user_id
    };
  }

  /**
   * Prepare data for database update
   */
  prepareForUpdate(): Partial<EntityRelationshipFields> {
    const baseData = super.prepareForUpdate();
    return {
      ...baseData,
      source_entity_type: this.source_entity_type,
      source_entity_id: this.source_entity_id,
      target_entity_type: this.target_entity_type,
      target_entity_id: this.target_entity_id,
      relationship_type: this.relationship_type,
      metadata: this.metadata,
      sort_order: this.sort_order,
      is_active: this.is_active,
      is_bidirectional: this.is_bidirectional,
      created_by_user_id: this.created_by_user_id
    };
  }

  /**
   * Convert to JSON
   */
  toJSON(): EntityRelationshipFields {
    const baseData = super.toJSON();
    return {
      ...baseData,
      source_entity_type: this.source_entity_type,
      source_entity_id: this.source_entity_id,
      target_entity_type: this.target_entity_type,
      target_entity_id: this.target_entity_id,
      relationship_type: this.relationship_type,
      metadata: this.metadata,
      sort_order: this.sort_order,
      is_active: this.is_active,
      is_bidirectional: this.is_bidirectional,
      created_by_user_id: this.created_by_user_id
    };
  }

  // Business logic methods

  /**
   * Check if this is a dependency relationship
   */
  isDependency(): boolean {
    return ['depends_on', 'blocks', 'blocked_by'].includes(this.relationship_type);
  }

  /**
   * Check if this is a hierarchy relationship
   */
  isHierarchy(): boolean {
    return ['parent_of', 'child_of', 'contains', 'contained_by'].includes(this.relationship_type);
  }

  /**
   * Check if this is a reference relationship
   */
  isReference(): boolean {
    return ['relates_to', 'references', 'referenced_by'].includes(this.relationship_type);
  }

  /**
   * Check if this relationship is active
   */
  isActiveRelationship(): boolean {
    return this.is_active;
  }

  /**
   * Check if this relationship can be bidirectional
   */
  canBeBidirectional(): boolean {
    const bidirectionalTypes = ['relates_to', 'depends_on', 'blocks', 'contains'];
    return bidirectionalTypes.includes(this.relationship_type);
  }

  /**
   * Get the inverse relationship type for bidirectional relationships
   */
  getInverseRelationshipType(): string | null {
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

    return inverseMap[this.relationship_type] || null;
  }

  /**
   * Create a unique key for this relationship (for deduplication)
   */
  getRelationshipKey(): string {
    return `${this.source_entity_type}:${this.source_entity_id}->${this.target_entity_type}:${this.target_entity_id}:${this.relationship_type}`;
  }

  /**
   * Get the reverse relationship key
   */
  getReverseRelationshipKey(): string {
    return `${this.target_entity_type}:${this.target_entity_id}->${this.source_entity_type}:${this.source_entity_id}:${this.getInverseRelationshipType() || 'reverse'}`;
  }

  /**
   * Check if this relationship involves a specific entity
   */
  involvesEntity(entityType: string, entityId: string): boolean {
    return (this.source_entity_type === entityType && this.source_entity_id === entityId) ||
           (this.target_entity_type === entityType && this.target_entity_id === entityId);
  }

  /**
   * Check if this is the source entity for the relationship
   */
  isSourceEntity(entityType: string, entityId: string): boolean {
    return this.source_entity_type === entityType && this.source_entity_id === entityId;
  }

  /**
   * Check if this is the target entity for the relationship
   */
  isTargetEntity(entityType: string, entityId: string): boolean {
    return this.target_entity_type === entityType && this.target_entity_id === entityId;
  }

  /**
   * Get the other entity in the relationship (given one side)
   */
  getOtherEntity(entityType: string, entityId: string): { type: string; id: string } | null {
    if (this.isSourceEntity(entityType, entityId)) {
      return { type: this.target_entity_type, id: this.target_entity_id };
    }
    if (this.isTargetEntity(entityType, entityId)) {
      return { type: this.source_entity_type, id: this.source_entity_id };
    }
    return null;
  }

  /**
   * Update relationship metadata
   */
  updateMetadata(key: string, value: any): void {
    if (!this.metadata) {
      this.metadata = {};
    }
    this.metadata[key] = value;
  }

  /**
   * Get metadata value
   */
  getMetadata(key: string): any {
    return this.metadata?.[key];
  }

  /**
   * Remove metadata key
   */
  removeMetadata(key: string): void {
    if (this.metadata) {
      delete this.metadata[key];
    }
  }

  /**
   * Deactivate the relationship (soft delete)
   */
  deactivate(): void {
    this.is_active = false;
  }

  /**
   * Reactivate the relationship
   */
  reactivate(): void {
    this.is_active = true;
  }

  /**
   * Update sort order
   */
  updateSortOrder(order: number): void {
    this.sort_order = order;
  }

  /**
   * Get relationship strength (from metadata)
   */
  getStrength(): number {
    return this.metadata?.strength || 1;
  }

  /**
   * Set relationship strength
   */
  setStrength(strength: number): void {
    this.updateMetadata('strength', Math.max(0, Math.min(10, strength)));
  }

  /**
   * Get relationship notes (from metadata)
   */
  getNotes(): string | null {
    return this.metadata?.notes || null;
  }

  /**
   * Set relationship notes
   */
  setNotes(notes: string): void {
    this.updateMetadata('notes', notes);
  }

  /**
   * Get relationship priority (from metadata)
   */
  getPriority(): string {
    return this.metadata?.priority || 'medium';
  }

  /**
   * Set relationship priority
   */
  setPriority(priority: 'low' | 'medium' | 'high' | 'critical'): void {
    this.updateMetadata('priority', priority);
  }
}

/**
 * EntityRelationship Utilities
 */
export class EntityRelationshipUtilities {
  /**
   * Valid relationship types
   */
  static readonly RELATIONSHIP_TYPES = [
    'depends_on',
    'blocks',
    'blocked_by',
    'relates_to',
    'references',
    'referenced_by',
    'contains',
    'contained_by',
    'parent_of',
    'child_of',
    'duplicates',
    'duplicated_by',
    'follows',
    'preceded_by'
  ] as const;

  /**
   * Valid entity types (archetypes)
   */
  static readonly ENTITY_TYPES = [
    'project',
    'task',
    'record',
    'document',
    'file',
    'activity',
    'discussion',
    'collection'
  ] as const;

  /**
   * Validate relationship data for creation
   */
  static validateRelationshipData(data: Partial<EntityRelationshipFields>): string[] {
    const errors: string[] = [];

    if (!data.source_entity_type) {
      errors.push('Source entity type is required');
    } else if (!this.ENTITY_TYPES.includes(data.source_entity_type as any)) {
      errors.push(`Invalid source entity type: ${data.source_entity_type}`);
    }

    if (!data.source_entity_id) {
      errors.push('Source entity ID is required');
    }

    if (!data.target_entity_type) {
      errors.push('Target entity type is required');
    } else if (!this.ENTITY_TYPES.includes(data.target_entity_type as any)) {
      errors.push(`Invalid target entity type: ${data.target_entity_type}`);
    }

    if (!data.target_entity_id) {
      errors.push('Target entity ID is required');
    }

    if (!data.relationship_type) {
      errors.push('Relationship type is required');
    } else if (!this.RELATIONSHIP_TYPES.includes(data.relationship_type as any)) {
      errors.push(`Invalid relationship type: ${data.relationship_type}`);
    }

    // Prevent self-relationships
    if (data.source_entity_type === data.target_entity_type && 
        data.source_entity_id === data.target_entity_id) {
      errors.push('Entity cannot have a relationship with itself');
    }

    return errors;
  }

  /**
   * Create a new EntityRelationship instance with validation
   */
  static createRelationship(data: Partial<EntityRelationshipFields>): EntityRelationship {
    const errors = this.validateRelationshipData(data);
    if (errors.length > 0) {
      throw new Error(`Relationship validation failed: ${errors.join(', ')}`);
    }

    return new EntityRelationship({
      source_entity_type: data.source_entity_type!,
      source_entity_id: data.source_entity_id!,
      target_entity_type: data.target_entity_type!,
      target_entity_id: data.target_entity_id!,
      relationship_type: data.relationship_type!,
      metadata: data.metadata || {},
      sort_order: data.sort_order || 0,
      is_active: data.is_active !== false,
      is_bidirectional: data.is_bidirectional || false,
      created_by_user_id: data.created_by_user_id
    });
  }

  /**
   * Filter relationships by type
   */
  static filterByType(relationships: EntityRelationship[], type: string): EntityRelationship[] {
    return relationships.filter(rel => rel.relationship_type === type);
  }

  /**
   * Filter relationships by entity
   */
  static filterByEntity(relationships: EntityRelationship[], entityType: string, entityId: string): EntityRelationship[] {
    return relationships.filter(rel => rel.involvesEntity(entityType, entityId));
  }

  /**
   * Get relationships where entity is the source
   */
  static getOutgoingRelationships(relationships: EntityRelationship[], entityType: string, entityId: string): EntityRelationship[] {
    return relationships.filter(rel => rel.isSourceEntity(entityType, entityId));
  }

  /**
   * Get relationships where entity is the target
   */
  static getIncomingRelationships(relationships: EntityRelationship[], entityType: string, entityId: string): EntityRelationship[] {
    return relationships.filter(rel => rel.isTargetEntity(entityType, entityId));
  }

  /**
   * Get all active relationships
   */
  static getActiveRelationships(relationships: EntityRelationship[]): EntityRelationship[] {
    return relationships.filter(rel => rel.is_active);
  }

  /**
   * Group relationships by type
   */
  static groupByType(relationships: EntityRelationship[]): Record<string, EntityRelationship[]> {
    return relationships.reduce((groups, rel) => {
      if (!groups[rel.relationship_type]) {
        groups[rel.relationship_type] = [];
      }
      groups[rel.relationship_type].push(rel);
      return groups;
    }, {} as Record<string, EntityRelationship[]>);
  }

  /**
   * Sort relationships by sort order
   */
  static sortBySortOrder(relationships: EntityRelationship[]): EntityRelationship[] {
    return relationships.sort((a, b) => a.sort_order - b.sort_order);
  }

  /**
   * Check for circular dependencies
   */
  static hasCircularDependency(relationships: EntityRelationship[], entityType: string, entityId: string): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    function hasCycle(currentType: string, currentId: string): boolean {
      const key = `${currentType}:${currentId}`;
      
      if (recursionStack.has(key)) {
        return true; // Cycle detected
      }
      
      if (visited.has(key)) {
        return false; // Already processed
      }
      
      visited.add(key);
      recursionStack.add(key);
      
      const dependencies = relationships.filter(rel => 
        rel.isSourceEntity(currentType, currentId) && 
        rel.relationship_type === 'depends_on' &&
        rel.is_active
      );
      
      for (const dep of dependencies) {
        if (hasCycle(dep.target_entity_type, dep.target_entity_id)) {
          return true;
        }
      }
      
      recursionStack.delete(key);
      return false;
    }

    return hasCycle(entityType, entityId);
  }

  /**
   * Get dependency path between two entities
   */
  static getDependencyPath(
    relationships: EntityRelationship[], 
    fromType: string, 
    fromId: string, 
    toType: string, 
    toId: string
  ): EntityRelationship[] | null {
    const visited = new Set<string>();
    const path: EntityRelationship[] = [];

    function findPath(currentType: string, currentId: string): boolean {
      const key = `${currentType}:${currentId}`;
      
      if (visited.has(key)) {
        return false;
      }
      
      if (currentType === toType && currentId === toId) {
        return true; // Found target
      }
      
      visited.add(key);
      
      const dependencies = relationships.filter(rel => 
        rel.isSourceEntity(currentType, currentId) && 
        rel.relationship_type === 'depends_on' &&
        rel.is_active
      );
      
      for (const dep of dependencies) {
        path.push(dep);
        if (findPath(dep.target_entity_type, dep.target_entity_id)) {
          return true;
        }
        path.pop();
      }
      
      return false;
    }

    return findPath(fromType, fromId) ? path : null;
  }

  /**
   * Calculate relationship metrics for an entity
   */
  static calculateMetrics(relationships: EntityRelationship[], entityType: string, entityId: string) {
    const entityRelationships = this.filterByEntity(relationships, entityType, entityId);
    const outgoing = this.getOutgoingRelationships(relationships, entityType, entityId);
    const incoming = this.getIncomingRelationships(relationships, entityType, entityId);
    
    const byType = this.groupByType(entityRelationships);
    
    return {
      total: entityRelationships.length,
      outgoing: outgoing.length,
      incoming: incoming.length,
      dependencies: (byType['depends_on'] || []).length,
      blocks: (byType['blocks'] || []).length,
      references: (byType['references'] || []).length + (byType['relates_to'] || []).length,
      hierarchical: (byType['parent_of'] || []).length + (byType['child_of'] || []).length + (byType['contains'] || []).length,
      bidirectional: entityRelationships.filter(rel => rel.is_bidirectional).length,
      active: entityRelationships.filter(rel => rel.is_active).length,
      inactive: entityRelationships.filter(rel => !rel.is_active).length
    };
  }
}

export default EntityRelationship;