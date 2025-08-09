import { Entity, Property, Index, Unique } from '@mikro-orm/core';
import { BaseSystemEntity } from './BaseSystemEntity.js';

@Entity()
@Index({ properties: ['tableName', 'recordId'] })
@Unique({ properties: ['clientSequence'] })
export class LocalChanges extends BaseSystemEntity {
  @Property({ type: 'string' })
  tableName!: string;

  @Property({ type: 'string' })
  recordId!: string;

  @Property({ type: 'string' })
  operationType!: string;

  @Property({ type: 'json' })
  data!: any;

  @Property({ type: 'bigint' })
  clientSequence!: bigint;

  @Property({ type: 'integer', default: 0 })
  loopProtection!: number;
}