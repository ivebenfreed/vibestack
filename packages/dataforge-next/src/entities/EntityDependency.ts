import { Entity, Property, Index, Unique } from '@mikro-orm/core';
import { BaseSystemEntity } from './BaseSystemEntity.js';

@Entity()
@Index({ properties: ['fromTable', 'fromId'] })
@Index({ properties: ['toTable', 'toId'] })
@Unique({ properties: ['fromTable', 'fromId', 'toTable', 'toId', 'dependencyType'] })
export class EntityDependency extends BaseSystemEntity {
  @Property({ type: 'string' })
  fromTable!: string;

  @Property({ type: 'string' })
  fromId!: string;

  @Property({ type: 'string' })
  toTable!: string;

  @Property({ type: 'string' })
  toId!: string;

  @Property({ type: 'string' })
  dependencyType!: string;

  @Property({ type: 'json', nullable: true })
  metadata?: any;
}