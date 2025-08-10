import { Property, ManyToOne } from '@mikro-orm/core';
import { BaseSystemEntity } from './BaseSystemEntity.js';
import { Account } from './Account.js';
import { ServerOnlyEntity } from '../utils/entity-context.js';

@ServerOnlyEntity() // Auth-related entity, server-only
export class Session extends BaseSystemEntity {
  @Property({ type: 'string' })
  sessionToken!: string;

  @Property({ type: 'timestamptz' })
  expiresAt!: Date;

  @ManyToOne(() => Account)
  account!: Account;
}