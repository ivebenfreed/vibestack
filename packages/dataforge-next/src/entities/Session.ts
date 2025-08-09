import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseSystemEntity } from './BaseSystemEntity.js';
import type { Account } from './Account.js';

@Entity()
export class Session extends BaseSystemEntity {
  @Property({ type: 'string' })
  sessionToken!: string;

  @Property({ type: 'timestamptz' })
  expiresAt!: Date;

  @ManyToOne(() => 'Account')
  account!: Account;
}