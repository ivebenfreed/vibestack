/**
 * Relationship update information for junction table operations
 */
interface RelationshipUpdate {
    relationName: string;
    operation: 'set' | 'add' | 'remove';
    targetIds: string[];
}
/**
 * Core change type for replication
 * Represents a change to a table that needs to be replicated
 *
 * IMPORTANT: The `data` field should contain TypeORM entity data in camelCase format
 * with proper types (Date objects for dates, not strings). This preserves TypeORM
 * entity structure throughout the sync pipeline and reduces unnecessary conversions.
 */
interface TableChange {
    table: string;
    operation: 'insert' | 'update' | 'delete';
    /**
     * Entity data in TypeORM format (camelCase properties, proper types)
     * - Date fields should be Date objects, not ISO strings
     * - Property names should match TypeORM entity properties (camelCase)
     * - This preserves the entity structure from client to server
     */
    data: Record<string, unknown>;
    /**
     * ISO timestamp string of when the record was last updated
     * This is separate from data.updatedAt to avoid confusion
     */
    updatedAt: string;
    lsn?: string;
    clientId?: string;
    relationshipUpdates?: RelationshipUpdate[];
    entityRelations?: string[];
}

type SrvMessageType = 'srv_send_changes' | 'srv_catchup_changes' | 'srv_live_changes' | 'srv_init_start' | 'srv_init_changes' | 'srv_init_complete' | 'srv_heartbeat' | 'srv_error' | 'srv_state_change' | 'srv_lsn_update' | 'srv_changes_received' | 'srv_changes_applied' | 'srv_sync_completed' | 'srv_catchup_completed' | 'srv_live_start' | 'srv_sync_stats' | 'srv_integrity_reset' | 'srv_integrity_validation_response';
type CltMessageType = 'clt_sync_request' | 'clt_send_changes' | 'clt_heartbeat' | 'clt_error' | 'clt_changes_received' | 'clt_changes_applied' | 'clt_init_received' | 'clt_init_processed' | 'clt_catchup_received' | 'clt_integrity_validation' | 'clt_integrity_baseline_validation' | 'clt_integrity_reset_ack';
interface BaseMessage {
    messageId: string;
    timestamp: number;
    clientId: string;
}
interface ServerMessage extends BaseMessage {
    type: SrvMessageType;
}
interface ServerChangesMessage extends ServerMessage {
    type: 'srv_send_changes' | 'srv_catchup_changes' | 'srv_live_changes';
    changes: TableChange[];
    lastLSN: string;
    sequence?: {
        chunk: number;
        total: number;
    };
    isConflictResolution?: boolean;
}
interface ServerInitChangesMessage extends ServerMessage {
    type: 'srv_init_changes';
    changes: TableChange[];
    sequence: {
        table: string;
        chunk: number;
        total: number;
    };
}
interface ServerInitStartMessage extends ServerMessage {
    type: 'srv_init_start';
    serverLSN: string;
    resuming?: boolean;
}
interface ServerInitCompleteMessage extends ServerMessage {
    type: 'srv_init_complete';
    serverLSN: string;
}
interface ServerStateChangeMessage extends ServerMessage {
    type: 'srv_state_change';
    state: 'initial' | 'catchup' | 'live';
    lsn: string;
}
interface ServerLSNUpdateMessage extends ServerMessage {
    type: 'srv_lsn_update';
    lsn: string;
}
interface ServerReceivedMessage extends ServerMessage {
    type: 'srv_changes_received';
    changeIds: string[];
}
interface ServerAppliedMessage extends ServerMessage {
    type: 'srv_changes_applied';
    appliedChanges: string[];
    success: boolean;
    error?: string;
}
interface ServerSyncCompletedMessage extends ServerMessage {
    type: 'srv_sync_completed';
    startLSN: string;
    serverLSN: string;
    changeCount: number;
    success: boolean;
    error?: string;
}
/**
 * Server heartbeat response message
 */
interface ServerHeartbeatMessage extends ServerMessage {
    type: 'srv_heartbeat';
    serverLSN?: string;
    inReplyTo?: string;
    error?: string;
}
/**
 * Server integrity reset command message
 */
interface ServerIntegrityResetMessage extends ServerMessage {
    type: 'srv_integrity_reset';
    resetCommand: {
        type: 'full_reset' | 'table_reset';
        reason: string;
        affectedTables?: string[];
        preserveUserData?: boolean;
    };
    reason: string;
}
/**
 * Server integrity validation response message
 */
interface ServerIntegrityValidationResponseMessage extends ServerMessage {
    type: 'srv_integrity_validation_response';
    isValid: boolean;
    issues: Array<{
        type: 'record_count_mismatch' | 'missing_records' | 'extra_records' | 'data_corruption' | 'lsn_regression';
        table: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        description: string;
        details: any;
    }>;
    recommendedAction: 'none' | 'catchup' | 'reset';
    serverFingerprints: Record<string, any>;
    validationTimestamp: number;
    rollbackToLSN?: string;
    rollbackReason?: string;
}
/**
 * Message sent when a client connects and is already up-to-date,
 * confirming the transition to live sync.
 */
interface ServerLiveStartMessage extends ServerMessage {
    type: 'srv_live_start';
    startLSN: string;
    serverLSN: string;
    changeCount: number;
    success: boolean;
}
interface ServerCatchupCompletedMessage extends ServerMessage {
    type: 'srv_catchup_completed';
    startLSN: string;
    serverLSN: string;
    changeCount: number;
    success: boolean;
    error?: string;
}
/**
 * Statistics message for synchronization operations
 * Provides detailed metrics on filtering and deduplication
 */
interface ServerSyncStatsMessage extends ServerMessage {
    type: 'srv_sync_stats';
    syncType: 'live' | 'catchup' | 'initial';
    originalCount: number;
    processedCount: number;
    deduplicationStats?: {
        beforeCount: number;
        afterCount: number;
        reduction: number;
        reductionPercent: number;
        reasons: Record<string, number>;
    };
    filteringStats?: {
        beforeCount: number;
        afterCount: number;
        filtered: number;
        reasons: Record<string, number>;
        filteredChanges?: Array<{
            id: string;
            table: string;
            reason: string;
        }>;
    };
    contentStats?: {
        operations: Record<string, number>;
        tables: Record<string, number>;
        clients: Record<string, number>;
    };
    performanceStats?: {
        processingTimeMs: number;
        dbQueryTimeMs?: number;
        networkTimeMs?: number;
    };
    lsnRange?: {
        first: string;
        last: string;
    };
}
interface ClientMessage extends BaseMessage {
    type: CltMessageType;
}
interface ClientChangesMessage extends ClientMessage {
    type: 'clt_send_changes';
    changes: TableChange[];
}
interface ClientHeartbeatMessage extends ClientMessage {
    type: 'clt_heartbeat';
    state?: string;
    lsn: string;
    active: boolean;
}
interface ClientReceivedMessage extends ClientMessage {
    type: 'clt_changes_received';
    changeIds: string[];
    lastLSN: string;
}
interface ClientAppliedMessage extends ClientMessage {
    type: 'clt_changes_applied';
    changeIds: string[];
    lastLSN: string;
}
interface ClientInitReceivedMessage extends ClientMessage {
    type: 'clt_init_received';
    table: string;
    chunk: number;
}
interface ClientInitProcessedMessage extends ClientMessage {
    type: 'clt_init_processed';
}
/**
 * Client integrity validation request message
 */
interface ClientIntegrityValidationMessage extends ClientMessage {
    type: 'clt_integrity_validation';
    currentLSN: string;
    tableFingerprints: Record<string, {
        recordCount: number;
        lastUpdated: number;
        recordIdHash: string;
        recentDataHash: string;
    }>;
}
/**
 * Client integrity reset acknowledgment message
 */
interface ClientIntegrityResetAckMessage extends ClientMessage {
    type: 'clt_integrity_reset_ack';
    success: boolean;
    result?: {
        success: boolean;
        tablesCleared: string[];
        lsnReset: boolean;
        error?: string;
    };
    error?: string;
    inReplyTo?: string;
}
type Message = ServerMessage | ServerCatchupCompletedMessage | ServerLiveStartMessage | ServerSyncStatsMessage | ServerHeartbeatMessage | ServerIntegrityResetMessage | ServerIntegrityValidationResponseMessage | ClientMessage | ClientIntegrityValidationMessage | ClientIntegrityResetAckMessage;

/**
 * Strongly typed record data for sync operations
 * Represents the common fields expected in all records
 */
interface RecordData {
    id: string;
    clientId: string;
    updatedAt: string;
    [key: string]: unknown;
}
/**
 * Result of executing a client change
 */
interface ExecutionResult {
    success: boolean;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    data?: any;
    isConflict?: boolean;
    skipped?: boolean;
}

/**
 * Client registration types for managing sync clients
 */
interface ClientRegistration {
    clientId: string;
    timestamp: string;
}
interface ClientDeregistration {
    clientId: string;
}
declare function isTableChange(payload: unknown): payload is TableChange;
declare function isClientMessageType(type: string): type is CltMessageType;

export { type BaseMessage, type ClientAppliedMessage, type ClientChangesMessage, type ClientDeregistration, type ClientHeartbeatMessage, type ClientInitProcessedMessage, type ClientInitReceivedMessage, type ClientIntegrityResetAckMessage, type ClientIntegrityValidationMessage, type ClientMessage, type ClientReceivedMessage, type ClientRegistration, type CltMessageType, type ExecutionResult, type Message, type RecordData, type RelationshipUpdate, type ServerAppliedMessage, type ServerCatchupCompletedMessage, type ServerChangesMessage, type ServerHeartbeatMessage, type ServerInitChangesMessage, type ServerInitCompleteMessage, type ServerInitStartMessage, type ServerIntegrityResetMessage, type ServerIntegrityValidationResponseMessage, type ServerLSNUpdateMessage, type ServerLiveStartMessage, type ServerMessage, type ServerReceivedMessage, type ServerStateChangeMessage, type ServerSyncCompletedMessage, type ServerSyncStatsMessage, type SrvMessageType, type TableChange, isClientMessageType, isTableChange };
