import { Entity, Property } from '@mikro-orm/core';
import { BaseSystemEntity } from './BaseSystemEntity.js';

/**
 * Verification entity
 * Stores tokens for email verification, password reset, etc.
 * Aligned with Better Auth's verification schema
 */
@Entity({ tableName: 'verifications' })
export class Verification extends BaseSystemEntity {
  @Property({ type: 'text' })
  identifier!: string;

  @Property({ type: 'text' })
  value!: string;

  @Property({ type: 'date' })
  expiresAt!: Date;
}