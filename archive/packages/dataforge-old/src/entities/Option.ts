import { Entity, Property, ManyToOne, Unique } from '@mikro-orm/core';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { OptionSet } from './OptionSet.js';

@Entity()
@Unique({ properties: ['optionSet', 'value'] })
export class Option extends BaseDomainEntity {
  @ManyToOne(() => OptionSet, { fieldName: 'option_set_id' })
  optionSet!: OptionSet;

  @Property({ type: 'string' })
  value!: string; // The actual value used in code

  @Property({ type: 'string' })
  label!: string; // Display label for users

  @Property({ type: 'string', fieldName: 'option_type' })
  optionType!: string; // status, priority, category, discussionType, generic

  @Property({ type: 'int', default: 0, fieldName: 'sort_order' })
  sortOrder!: number;

  @Property({ type: 'boolean', default: true, fieldName: 'is_active' })
  isActive!: boolean;

  @Property({ type: 'string', nullable: true })
  color?: string; // UI color (hex code)

  @Property({ type: 'string', nullable: true })
  icon?: string; // UI icon identifier

  @Property({ type: 'text', nullable: true })
  description?: string; // Additional description

  // Computed properties
  get isSystemOption(): boolean {
    return ['status', 'priority', 'category', 'discussionType'].includes(this.optionType);
  }

  get isCustomOption(): boolean {
    return this.optionType === 'generic' || !this.isSystemOption;
  }
}