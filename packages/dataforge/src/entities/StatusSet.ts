import { Entity, Property, OneToMany, ManyToMany, Collection, Index } from '@mikro-orm/core';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { StatusDefinition } from './StatusDefinition.js';
import { Project } from './Project.js';

@Entity()
@Index({ properties: ['entityType'] })
export class StatusSet extends BaseDomainEntity {
  @Property({ type: 'string', length: 100 })
  name!: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Property({ type: 'string', length: 50 })
  entityType!: string;

  @Property({ type: 'boolean', default: false })
  isDefault!: boolean;

  @Property({ type: 'boolean', default: true })
  isActive!: boolean;

  @Property({ type: 'boolean', default: false })
  isSystem!: boolean;

  @Property({ type: 'json', default: '{}' })
  workflow!: Record<string, any>;

  @Property({ type: 'json', default: '{}' })
  metadata!: Record<string, any>;

  @OneToMany(() => StatusDefinition, 'statusSet')
  statuses = new Collection<StatusDefinition>(this);

  @ManyToMany(() => Project, 'statusSets')
  projects = new Collection<Project>(this);
}