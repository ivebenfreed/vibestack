import { Entity, Property, ManyToOne, Index } from '@mikro-orm/core';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { StatusSet } from './StatusSet.js';

@Entity()
@Index({ properties: ['statusSet', 'sortOrder'] })
@Index({ properties: ['name'] })
export class StatusDefinition extends BaseDomainEntity {

  @Property({ type: 'string', length: 50 })
  name!: string;

  @Property({ type: 'string', length: 100 })
  label!: string;

  @Property({ type: 'string', length: 7 })
  color!: string;

  @Property({ type: 'string', length: 50, nullable: true })
  icon?: string;

  @Property({ type: 'string', length: 20, nullable: true })
  variant?: string;

  @Property({ type: 'integer' })
  sortOrder!: number;

  @Property({ type: 'boolean', default: false })
  isDefault!: boolean;

  @Property({ type: 'boolean', default: false })
  isFinal!: boolean;

  @Property({ type: 'boolean', default: true })
  isActive!: boolean;

  @Property({ type: 'array', nullable: true })
  allowedTransitions?: string[];

  @Property({ type: 'integer', nullable: true })
  autoTransitionDays?: number;

  @Property({ type: 'json', default: '{}' })
  metadata!: Record<string, any>;

  @ManyToOne(() => StatusSet, { fieldName: 'status_set_id' })
  statusSet!: StatusSet;

}