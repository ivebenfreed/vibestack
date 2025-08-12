import { Entity, Property, OneToMany, Collection } from '@mikro-orm/core';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { Option } from './Option.js';

@Entity()
export class OptionSet extends BaseDomainEntity {
  @Property({ type: 'string' })
  name!: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Property({ type: 'string', fieldName: 'option_set_type' })
  optionSetType!: string; // status, priority, category, discussionType, custom

  @Property({ type: 'boolean', default: false, fieldName: 'is_system_type' })
  isSystemType!: boolean; // true for built-in business logic types

  @Property({ type: 'boolean', default: true, fieldName: 'is_active' })
  isActive!: boolean;

  @Property({ type: 'json', nullable: true })
  settings?: any; // General settings for the option set

  @OneToMany(() => Option, 'optionSet')
  options = new Collection<Option>(this);

  // Computed properties
  get isStatusType(): boolean {
    return this.optionSetType === 'status' && this.isSystemType;
  }

  get isPriorityType(): boolean {
    return this.optionSetType === 'priority' && this.isSystemType;
  }

  get isCategoryType(): boolean {
    return this.optionSetType === 'category' && this.isSystemType;
  }

  get isDiscussionType(): boolean {
    return this.optionSetType === 'discussionType' && this.isSystemType;
  }

  get isCustomType(): boolean {
    return !this.isSystemType;
  }
}