import { Entity, Property } from '@mikro-orm/core';
import { BaseSystemEntity } from './BaseSystemEntity.js';

@Entity()
export class SyncMetadata extends BaseSystemEntity {
  @Property({ type: 'string' })
  tableName!: string;

  @Property({ type: 'bigint', default: 0 })
  lastSyncedVersion!: bigint;

  @Property({ type: 'timestamptz', nullable: true })
  lastSyncedAt?: Date;
}