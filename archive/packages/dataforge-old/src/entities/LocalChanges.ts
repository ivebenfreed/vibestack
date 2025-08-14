import { Property, Index } from '@mikro-orm/core';
import { BaseSystemEntity } from './BaseSystemEntity.js';
import { ClientSystemEntity } from '../utils/entity-context.js';

/**
 * LocalChanges entity
 * Tracks local changes that need to be synced to the server
 * This is a client-only entity that won't be exposed to the server
 */
@ClientSystemEntity() // Client-side system table for tracking local changes
@Index({ properties: ['table', 'recordId'] })
export class LocalChanges extends BaseSystemEntity {
  @Property({ type: 'string' })
  @Index()
  table!: string; // Table name for the change
  
  // Alias for backward compatibility
  get tableName(): string { return this.table; }
  set tableName(value: string) { this.table = value; }

  @Property({ type: 'string' })
  recordId!: string; // ID of the record that changed

  @Property({ type: 'string' })
  operation!: string; // Operation type: insert, update, delete
  
  // Alias for backward compatibility
  get operationType(): string { return this.operation; }
  set operationType(value: string) { this.operation = value; }

  @Property({ type: 'json' })
  data!: any; // The actual data/changes

  @Property({ type: 'string', nullable: true })
  lsn!: string; // Log Sequence Number (empty for client-originated)

  @Property({ type: 'string', nullable: true })
  clientSequence?: string; // Client-side sequence for ordering

  @Property({ type: 'integer', default: 0 })
  @Index() // Index for efficient querying of unprocessed changes
  processedSync!: number; // 0 = pending, 1 = processed

  @Property({ type: 'integer', default: 0 })
  sendAttempts!: number; // Number of send attempts

  @Property({ type: 'date', nullable: true })
  lastSendAttempt?: Date; // Timestamp of last send attempt

  @Property({ type: 'string', nullable: true })
  lastError?: string; // Error message from last failed attempt
}