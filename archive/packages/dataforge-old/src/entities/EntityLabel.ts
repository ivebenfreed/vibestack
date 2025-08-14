import { Entity, Property, ManyToOne, Unique, Index } from '@mikro-orm/core';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { Label } from './Label.js';
import { User } from './User.js';

@Entity()
@Unique({ properties: ['entityArchetype', 'entityId', 'label'] })
@Index({ properties: ['entityArchetype', 'entityId'] })
@Index({ properties: ['label'] })
export class EntityLabel extends BaseDomainEntity {
  // Entity being labeled (polymorphic)
  @Property({ type: 'string', fieldName: 'entity_archetype' })
  entityArchetype!: string; // project, task, record, document, file, activity, discussion, collection

  @Property({ type: 'uuid', fieldName: 'entity_id' })
  entityId!: string; // UUID of the entity being labeled

  @ManyToOne(() => Label, { fieldName: 'label_id' })
  label!: Label; // The label being applied

  @Property({ type: 'int', default: 0, fieldName: 'sort_order' })
  sortOrder!: number; // Order of labels on the entity

  @Property({ type: 'boolean', default: true, fieldName: 'is_active' })
  isActive!: boolean; // Allow soft deletion

  @Property({ type: 'json', nullable: true })
  metadata?: any; // Label-specific metadata for this application

  @ManyToOne(() => User, { nullable: true, fieldName: 'applied_by_user_id' })
  appliedByUser?: User; // User who applied this label

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'applied_at' })
  appliedAt?: Date; // When this label was applied

  /**
   * Create a unique key for this entity-label relationship
   */
  getEntityLabelKey(): string {
    return `${this.entityArchetype}:${this.entityId}:${this.label.id}`;
  }

  /**
   * Check if this label is a system label
   */
  get isSystemLabel(): boolean {
    return this.label.isSystem;
  }

  /**
   * Get the label color for UI purposes
   */
  get labelColor(): string {
    return this.label.color;
  }

  /**
   * Get the label name for display
   */
  get labelName(): string {
    return this.label.name;
  }
}