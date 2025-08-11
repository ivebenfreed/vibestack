import { Entity, Property, ManyToOne, OneToMany, ManyToMany, Collection, Index } from '@mikro-orm/core';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { TagSet } from './TagSet.js';
import { Task } from './Task.js';

@Entity()
@Index({ properties: ['slug'] })
@Index({ properties: ['tagSet', 'sortOrder'] })
export class Tag extends BaseDomainEntity {

  @Property({ type: 'string', length: 50 })
  name!: string;

  @Property({ type: 'string', length: 50, unique: true })
  slug!: string;

  @Property({ type: 'string', length: 7 })
  color!: string;

  @Property({ type: 'string', length: 50, nullable: true })
  icon?: string;

  @Property({ type: 'string', length: 20, default: 'solid' })
  variant!: string;

  @Property({ type: 'integer', default: 0 })
  sortOrder!: number;


  @Property({ type: 'boolean', default: true })
  isActive!: boolean;

  @Property({ type: 'integer', default: 0 })
  usageCount!: number;

  @Property({ type: 'date', nullable: true })
  lastUsedAt?: Date;

  @Property({ type: 'json', default: {} })
  metadata!: Record<string, any>;

  @ManyToOne(() => TagSet, { fieldName: 'tag_set_id' })
  tagSet!: TagSet;

  @ManyToOne(() => Tag, { nullable: true, fieldName: 'parent_id' })
  parent?: Tag;

  @OneToMany(() => Tag, 'parent')
  children = new Collection<Tag>(this);

  @ManyToMany(() => Task, 'tags')
  tasks = new Collection<Task>(this);
}