import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseAuthEntity } from './BaseAuthEntity.js';
import { ServerOnlyEntity } from '../utils/entity-context.js';
import { User } from './User.js';

@ServerOnlyEntity() // Auth-related entity, server-only
@Entity()
export class Account extends BaseAuthEntity {
  @ManyToOne(() => User, { fieldName: 'userId' })
  user!: User;

  @Property({ type: 'string', fieldName: 'providerId' })
  providerId!: string;

  @Property({ type: 'string', fieldName: 'accountId' })
  accountId!: string;
  
  @Property({ type: 'string', nullable: true })
  password?: string;

  @Property({ type: 'string', nullable: true, fieldName: 'refreshToken' })
  refreshToken?: string;

  @Property({ type: 'string', nullable: true, fieldName: 'accessToken' })
  accessToken?: string;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'accessTokenExpiresAt' })
  accessTokenExpiresAt?: Date;
  
  @Property({ type: 'timestamptz', nullable: true, fieldName: 'refreshTokenExpiresAt' })
  refreshTokenExpiresAt?: Date;

  @Property({ type: 'string', nullable: true, fieldName: 'tokenType' })
  tokenType?: string;

  @Property({ type: 'string', nullable: true })
  scope?: string;

  @Property({ type: 'string', nullable: true, fieldName: 'idToken' })
  idToken?: string;

  @Property({ type: 'string', nullable: true, fieldName: 'sessionState' })
  sessionState?: string;
}