import { Entity, Property, Index } from '@mikro-orm/core';
import { BaseSystemEntity } from './BaseSystemEntity.js';

/**
 * ChangeHistory entity for tracking changes for catchup sync
 * Server-only entity - not replicated to clients
 */
@Entity({ tableName: 'change_history' })
@Index({ properties: ['lsn'] })
@Index({ properties: ['tableName', 'timestamp'] })
export class ChangeHistory extends BaseSystemEntity {
  @Property({ type: 'text' })
  lsn!: string;

  @Property({ type: 'text' })
  tableName!: string;

  @Property({ type: 'text' })
  operation!: string;

  @Property({ type: 'json', nullable: true })
  data?: Record<string, any>;

  @Property({ type: 'date', onCreate: () => new Date() })
  timestamp!: Date;
}