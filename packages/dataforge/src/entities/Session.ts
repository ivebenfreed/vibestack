import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseSystemEntity } from './BaseSystemEntity.js';
import { User } from './User.js';
import { ServerOnlyEntity } from '../utils/entity-context.js';

@ServerOnlyEntity() // Auth-related entity, server-only
@Entity()
export class Session extends BaseSystemEntity {
  @ManyToOne(() => User)
  user!: User;

  @Property({ type: 'string', fieldName: 'session_token' })
  token!: string;

  @Property({ type: 'timestamptz', fieldName: 'expires_at' })
  expiresAt!: Date;
  
  @Property({ type: 'string', nullable: true })
  ipAddress?: string;
  
  @Property({ type: 'string', nullable: true })
  userAgent?: string;
}