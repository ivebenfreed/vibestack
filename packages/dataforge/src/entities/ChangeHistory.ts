import { Property, Index } from '@mikro-orm/core';
import { BaseSystemEntity } from './BaseSystemEntity.js';
import { ServerSystemEntity } from '../utils/entity-context.js';

/**
 * ChangeHistory entity for tracking changes for catchup sync
 * Server-only entity - not replicated to clients
 */
@ServerSystemEntity({ tableName: 'change_history' }) // Server-side system table for change tracking
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