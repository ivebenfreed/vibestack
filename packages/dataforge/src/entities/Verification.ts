import { Property } from '@mikro-orm/core';
import { BaseSystemEntity } from './BaseSystemEntity.js';
import { ServerOnlyEntity } from '../utils/entity-context.js';

/**
 * Verification entity
 * Stores tokens for email verification, password reset, etc.
 * Aligned with Better Auth's verification schema
 */
@ServerOnlyEntity({ tableName: 'verifications' }) // Auth-related entity, server-only
export class Verification extends BaseSystemEntity {
  @Property({ type: 'text' })
  identifier!: string;

  @Property({ type: 'text' })
  value!: string;

  @Property({ type: 'date' })
  expiresAt!: Date;
}