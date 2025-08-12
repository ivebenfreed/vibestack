import { PrimaryKey, Property } from '@mikro-orm/core';

/**
 * Base entity for Better Auth tables
 * Uses text IDs and camelCase field names as expected by Better Auth
 */
export abstract class BaseAuthEntity {
  @PrimaryKey({ type: 'text', defaultRaw: `gen_random_uuid()::text` })
  id!: string;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'createdAt' })
  createdAt!: Date;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updatedAt' })
  updatedAt!: Date;
}