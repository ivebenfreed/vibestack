import { Property, OneToMany, Collection } from '@mikro-orm/core';
import { BaseSystemEntity } from './BaseSystemEntity.js';
import { ServerOnlyEntity } from '../utils/entity-context.js';
import { User } from './User.js';
import { Session } from './Session.js';

@ServerOnlyEntity() // Auth-related entity, server-only
export class Account extends BaseSystemEntity {
  @Property({ type: 'string' })
  providerId!: string;

  @Property({ type: 'string' })
  providerAccountId!: string;

  @Property({ type: 'string', nullable: true })
  refreshToken?: string;

  @Property({ type: 'string', nullable: true })
  accessToken?: string;

  @Property({ type: 'bigint', nullable: true })
  expiresAt?: bigint;

  @Property({ type: 'string', nullable: true })
  tokenType?: string;

  @Property({ type: 'string', nullable: true })
  scope?: string;

  @Property({ type: 'string', nullable: true })
  idToken?: string;

  @Property({ type: 'string', nullable: true })
  sessionState?: string;

  @OneToMany(() => User, 'account')
  users = new Collection<User>(this);

  @OneToMany(() => Session, 'account')
  sessions = new Collection<Session>(this);
}