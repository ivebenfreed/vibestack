import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseAuthEntity } from './BaseAuthEntity.js';
import { User } from './User.js';
import { ServerOnlyEntity } from '../utils/entity-context.js';

@ServerOnlyEntity() // Auth-related entity, server-only
@Entity()
export class Session extends BaseAuthEntity {
  @ManyToOne(() => User, { fieldName: 'userId' })
  user!: User;

  @Property({ type: 'string' })
  token!: string;

  @Property({ type: 'timestamptz', fieldName: 'expiresAt' })
  expiresAt!: Date;
  
  @Property({ type: 'string', nullable: true, fieldName: 'ipAddress' })
  ipAddress?: string;
  
  @Property({ type: 'string', nullable: true, fieldName: 'userAgent' })
  userAgent?: string;
}