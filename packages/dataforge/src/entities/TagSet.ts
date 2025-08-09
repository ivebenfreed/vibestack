import { Entity, Property, OneToMany, ManyToMany, Collection, Index } from '@mikro-orm/core';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { Tag } from './Tag.js';
import { Project } from './Project.js';

@Entity({ tableName: 'tag_sets' })
@Index({ properties: ['displayOrder'] })
export class TagSet extends BaseDomainEntity {
  @Property({ type: 'string', length: 100 })
  name!: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Property({ type: 'string', length: 50, nullable: true })
  category?: string;

  @Property({ type: 'boolean', default: false })
  isSystem!: boolean;

  @Property({ type: 'boolean', default: true })
  isActive!: boolean;

  @Property({ type: 'string', length: 7, default: '#94a3b8' })
  defaultColor!: string;

  @Property({ type: 'integer', default: 0 })
  displayOrder!: number;

  @Property({ type: 'boolean', default: false })
  isExclusive!: boolean;

  @Property({ type: 'integer', nullable: true })
  maxTags?: number;

  @Property({ type: 'json', default: {} })
  metadata!: Record<string, any>;

  @OneToMany(() => Tag, 'tagSet')
  tags = new Collection<Tag>(this);

  @ManyToMany(() => Project, 'tagSets')
  projects = new Collection<Project>(this);
}