/**
 * Schema Update Sync Messages
 * 
 * Real-time schema update messages for LiveStore dynamic schema system.
 * Allows clients to update organization schemas without app reload.
 */

import type { BaseMessage } from './messages';

// Schema-specific message types
export type SchemaMessageType = 
  | 'srv_schema_updated'        // Server notifies schema change
  | 'srv_schema_migration'      // Server notifies schema migration
  | 'srv_schema_validated'      // Server validates schema change
  | 'srv_schema_error'          // Server schema error
  | 'clt_schema_request'        // Client requests schema
  | 'clt_schema_received'       // Client acknowledges schema receipt
  | 'clt_schema_applied'        // Client confirms schema applied
  | 'clt_schema_error';         // Client schema error

// Schema change types
export type SchemaChangeType = 
  | 'entity_created'     // New entity added
  | 'entity_updated'     // Entity definition changed
  | 'entity_deleted'     // Entity removed
  | 'field_added'        // Field added to entity
  | 'field_updated'      // Field definition changed
  | 'field_deleted'      // Field removed from entity
  | 'validation_updated' // Validation rules changed
  | 'schema_version'     // Schema version updated
  | 'migration_applied'; // Database migration completed

// Field change details
export interface FieldChange {
  fieldName: string;
  changeType: 'added' | 'updated' | 'deleted';
  oldDefinition?: any;
  newDefinition?: any;
}

// Entity change details  
export interface EntityChange {
  entityName: string;
  changeType: SchemaChangeType;
  tableName: string;
  oldDefinition?: any;
  newDefinition?: any;
  fieldChanges?: FieldChange[];
}

// Schema change payload
export interface SchemaChangePayload {
  orgId: string;
  changeType: SchemaChangeType;
  timestamp: number;
  version: string;
  entityChanges: EntityChange[];
  migrationId?: string;
  requiresRestart?: boolean;
  // Complete syncable schema (filtered)
  updatedSchema?: {
    orgId: string;
    entities: Record<string, any>;
    version: string;
  };
}

// Base schema message
export interface SchemaMessage extends BaseMessage {
  type: SchemaMessageType;
  orgId: string;
}

// Server Messages

/**
 * Server notifies clients of schema changes
 */
export interface ServerSchemaUpdatedMessage extends SchemaMessage {
  type: 'srv_schema_updated';
  payload: SchemaChangePayload;
  affectedClients?: string[];  // Specific clients to notify (optional)
  broadcastToOrg: boolean;     // Whether to broadcast to all org clients
}

/**
 * Server notifies clients of schema migration progress
 */
export interface ServerSchemaMigrationMessage extends SchemaMessage {
  type: 'srv_schema_migration';
  migrationId: string;
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  progress?: {
    current: number;
    total: number;
    description: string;
  };
  error?: string;
  estimatedCompletion?: number; // Milliseconds
}

/**
 * Server validates schema change request
 */
export interface ServerSchemaValidatedMessage extends SchemaMessage {
  type: 'srv_schema_validated';
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  canProceed: boolean;
  inReplyTo: string; // Original request message ID
}

/**
 * Server schema operation error
 */
export interface ServerSchemaErrorMessage extends SchemaMessage {
  type: 'srv_schema_error';
  error: string;
  errorCode: 'validation_failed' | 'migration_failed' | 'permission_denied' | 'unknown';
  details?: any;
  inReplyTo?: string;
}

// Client Messages

/**
 * Client requests current schema for organization
 */
export interface ClientSchemaRequestMessage extends SchemaMessage {
  type: 'clt_schema_request';
  requestedVersion?: string;    // Specific version (optional)
  forceRefresh?: boolean;       // Force refresh from server
  includeServerOnly?: boolean;  // Include server-only fields (admin only)
}

/**
 * Client acknowledges schema receipt
 */
export interface ClientSchemaReceivedMessage extends SchemaMessage {
  type: 'clt_schema_received';
  version: string;
  inReplyTo: string;  // Server message ID
  changeCount: number;
}

/**
 * Client confirms schema has been applied
 */
export interface ClientSchemaAppliedMessage extends SchemaMessage {
  type: 'clt_schema_applied';
  version: string;
  appliedChanges: string[];  // Change IDs that were applied
  success: boolean;
  errors?: string[];
  inReplyTo: string;
}

/**
 * Client schema operation error  
 */
export interface ClientSchemaErrorMessage extends SchemaMessage {
  type: 'clt_schema_error';
  error: string;
  errorCode: 'parse_failed' | 'apply_failed' | 'validation_failed' | 'unknown';
  details?: any;
  inReplyTo?: string;
}

// Union types
export type SchemaServerMessage = 
  | ServerSchemaUpdatedMessage
  | ServerSchemaMigrationMessage  
  | ServerSchemaValidatedMessage
  | ServerSchemaErrorMessage;

export type SchemaClientMessage =
  | ClientSchemaRequestMessage
  | ClientSchemaReceivedMessage
  | ClientSchemaAppliedMessage
  | ClientSchemaErrorMessage;

export type AllSchemaMessages = SchemaServerMessage | SchemaClientMessage;

// Helper types for LiveStore integration
export interface LiveStoreSchemaUpdate {
  orgId: string;
  previousVersion: string;
  newVersion: string;
  schemaChanges: EntityChange[];
  liveStoreSchema: any;  // Generated LiveStore schema
  liveStoreEvents: any;  // Generated LiveStore events
  requiresInstanceRestart: boolean;
}

// Event types for client-side handling
export interface SchemaUpdateEvent {
  type: 'schema:updated' | 'schema:migration' | 'schema:error';
  orgId: string;
  payload: SchemaChangePayload | ServerSchemaMigrationMessage | ServerSchemaErrorMessage;
  timestamp: number;
}

// Client-side schema manager interface
export interface SchemaUpdateHandler {
  onSchemaUpdated(event: SchemaUpdateEvent): Promise<void>;
  onSchemaMigration(event: SchemaUpdateEvent): Promise<void>;
  onSchemaError(event: SchemaUpdateEvent): Promise<void>;
}