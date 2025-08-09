import { PrimaryKey, Property } from '@mikro-orm/core';

export abstract class BaseSystemEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Date;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date() })
  updatedAt!: Date;
}