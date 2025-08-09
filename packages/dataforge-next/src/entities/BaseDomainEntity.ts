import { Property, ManyToOne } from '@mikro-orm/core';
import { BaseSystemEntity } from './BaseSystemEntity.js';
import type { User } from './User.js';

export abstract class BaseDomainEntity extends BaseSystemEntity {
  @Property({ type: 'integer', default: 0 })
  version!: number;

  @Property({ type: 'boolean', default: false })
  deleted!: boolean;

  @Property({ type: 'uuid' })
  clientId!: string;

  @ManyToOne(() => 'User', { nullable: true })
  createdBy?: User;

  @ManyToOne(() => 'User', { nullable: true })
  updatedBy?: User;
}