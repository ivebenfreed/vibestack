import { Property } from '@mikro-orm/core';
import { BaseSystemEntity } from './BaseSystemEntity.js';

export abstract class BaseDomainEntity extends BaseSystemEntity {
  @Property({ type: 'uuid', nullable: true })
  clientId?: string;
}