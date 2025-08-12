import { PrimaryKey, Property, ManyToOne } from '@mikro-orm/core';

export abstract class BaseSystemEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'generate_uuidv7()' })
  id!: string;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Date;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt!: Date;

  @ManyToOne(() => 'User', { nullable: true, fieldName: 'created_by_id' })
  createdBy?: any; // Use lazy reference to avoid circular imports
}