import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseSystemEntity } from './BaseSystemEntity.js';
import { ServerOnlyEntity } from '../utils/entity-context.js';
import { User } from './User.js';

@ServerOnlyEntity() // Auth-related entity, server-only
@Entity()
export class Account extends BaseSystemEntity {
  @ManyToOne(() => User)
  user!: User;

  @Property({ type: 'string', fieldName: 'provider_id' })
  providerId!: string;

  @Property({ type: 'string', fieldName: 'provider_account_id' })
  accountId!: string;
  
  @Property({ type: 'string', nullable: true })
  password?: string;

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
  
  @Property({ type: 'timestamptz', nullable: true, fieldName: 'access_token_expires_at' })
  accessTokenExpiresAt?: Date;
  
  @Property({ type: 'timestamptz', nullable: true, fieldName: 'refresh_token_expires_at' })
  refreshTokenExpiresAt?: Date;
}