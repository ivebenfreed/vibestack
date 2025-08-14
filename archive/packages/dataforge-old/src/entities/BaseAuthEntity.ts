import { PrimaryKey, Property } from '@mikro-orm/core';

/**
 * Base entity for Better Auth tables
 * Uses UUIDs with UUIDv7 generation and snake_case field names
 * Better Auth configured with generateId: false to let database handle UUID generation
 */
export abstract class BaseAuthEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'generate_uuidv7()' })
  id!: string;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  created_at!: Date;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updated_at!: Date;
}