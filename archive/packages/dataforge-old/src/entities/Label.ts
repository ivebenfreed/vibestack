import { Entity, Property, OneToMany, Collection, ManyToOne, Unique, Index } from '@mikro-orm/core';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { EntityLabel } from './EntityLabel.js';
import { User } from './User.js';

@Entity()
@Unique({ properties: ['name'] })
@Index({ properties: ['category'] })
@Index({ properties: ['isActive'] })
export class Label extends BaseDomainEntity {
  @Property({ type: 'string' })
  name!: string; // Unique label name

  @Property({ type: 'string', nullable: true })
  description?: string; // Optional description

  @Property({ type: 'string', default: '#94a3b8' })
  color!: string; // Hex color code

  @Property({ type: 'string', nullable: true })
  icon?: string; // Optional icon identifier

  @Property({ type: 'string', nullable: true })
  category?: string; // Label category for grouping (status, priority, type, etc.)

  @Property({ type: 'boolean', default: true, fieldName: 'is_active' })
  isActive!: boolean; // Allow soft deletion

  @Property({ type: 'boolean', default: false, fieldName: 'is_system' })
  isSystem!: boolean; // System-defined vs user-defined labels

  @Property({ type: 'int', default: 0, fieldName: 'usage_count' })
  usageCount!: number; // Track how often this label is used

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'last_used_at' })
  lastUsedAt?: Date; // When this label was last applied

  @ManyToOne(() => Label, { nullable: true, fieldName: 'parent_id' })
  parent?: Label; // For hierarchical labels

  @OneToMany(() => Label, 'parent')
  children = new Collection<Label>(this);

  @OneToMany(() => EntityLabel, 'label')
  entityLabels = new Collection<EntityLabel>(this);

  @ManyToOne(() => User, { nullable: true, fieldName: 'created_by_user_id' })
  createdByUser?: User; // User who created this label

  // Computed properties
  get isHierarchical(): boolean {
    return !!this.parent || this.children.length > 0;
  }

  get fullPath(): string {
    if (this.parent) {
      return `${this.parent.fullPath} > ${this.name}`;
    }
    return this.name;
  }

  /**
   * Increment usage count when label is applied
   */
  incrementUsage(): void {
    this.usageCount++;
    this.lastUsedAt = new Date();
  }

  /**
   * Decrement usage count when label is removed
   */
  decrementUsage(): void {
    if (this.usageCount > 0) {
      this.usageCount--;
    }
  }
}