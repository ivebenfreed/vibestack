import { Entity, Property, ManyToOne, Unique, Index } from '@mikro-orm/core';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { User } from './User.js';

@Entity()
@Unique({ properties: ['sourceArchetype', 'sourceId', 'targetArchetype', 'targetId', 'relationshipType'] })
@Index({ properties: ['sourceArchetype', 'sourceId'] })
@Index({ properties: ['targetArchetype', 'targetId'] })
@Index({ properties: ['relationshipType'] })
export class EntityRelationship extends BaseDomainEntity {
  // Source entity (polymorphic)
  @Property({ type: 'string', fieldName: 'source_archetype' })
  sourceArchetype!: string; // project, task, record, document, file, activity, discussion, collection

  @Property({ type: 'uuid', fieldName: 'source_id' })
  sourceId!: string; // UUID of the source entity

  // Target entity (polymorphic)
  @Property({ type: 'string', fieldName: 'target_archetype' })
  targetArchetype!: string; // project, task, record, document, file, activity, discussion, collection

  @Property({ type: 'uuid', fieldName: 'target_id' })
  targetId!: string; // UUID of the target entity

  // Relationship type and metadata
  @Property({ type: 'string', fieldName: 'relationship_type' })
  relationshipType!: string; // depends_on, blocks, relates_to, contains, references, parent_of, child_of

  @Property({ type: 'json', nullable: true })
  metadata?: any; // Relationship-specific data (strength, notes, conditions, etc.)

  @Property({ type: 'int', default: 0, fieldName: 'sort_order' })
  sortOrder!: number; // For ordered relationships

  @Property({ type: 'boolean', default: true, fieldName: 'is_active' })
  isActive!: boolean; // Allow soft deletion of relationships

  @Property({ type: 'boolean', default: false, fieldName: 'is_bidirectional' })
  isBidirectional!: boolean; // Whether this relationship implies the reverse

  @ManyToOne(() => User, { nullable: true, fieldName: 'created_by_user_id' })
  createdByUser?: User; // User who created this relationship

  // Computed properties for common relationship types
  get isDependency(): boolean {
    return ['depends_on', 'blocks', 'blocked_by'].includes(this.relationshipType);
  }

  get isHierarchy(): boolean {
    return ['parent_of', 'child_of', 'contains'].includes(this.relationshipType);
  }

  get isReference(): boolean {
    return ['relates_to', 'references'].includes(this.relationshipType);
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

    return inverseMap[this.relationshipType] || null;
  }

  /**
   * Create a unique key for this relationship (for deduplication)
   */
  getRelationshipKey(): string {
    return `${this.sourceArchetype}:${this.sourceId}->${this.targetArchetype}:${this.targetId}:${this.relationshipType}`;
  }
}