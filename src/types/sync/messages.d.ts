import type { TableChange } from './table-changes';
export type SrvMessageType = 'srv_send_changes' | 'srv_catchup_changes' | 'srv_live_changes' | 'srv_init_start' | 'srv_init_changes' | 'srv_init_complete' | 'srv_heartbeat' | 'srv_error' | 'srv_state_change' | 'srv_lsn_update' | 'srv_changes_received' | 'srv_changes_applied' | 'srv_sync_completed' | 'srv_catchup_completed' | 'srv_live_start' | 'srv_sync_stats' | 'srv_integrity_reset' | 'srv_integrity_validation_response';
export type CltMessageType = 'clt_sync_request' | 'clt_send_changes' | 'clt_heartbeat' | 'clt_error' | 'clt_changes_received' | 'clt_changes_applied' | 'clt_init_received' | 'clt_init_processed' | 'clt_catchup_received' | 'clt_integrity_validation' | 'clt_integrity_baseline_validation' | 'clt_integrity_reset_ack';
export interface BaseMessage {
    messageId: string;
    timestamp: number;
    clientId: string;
}
export interface ServerMessage extends BaseMessage {
    type: SrvMessageType;
}
export interface ServerChangesMessage extends ServerMessage {
    type: 'srv_send_changes' | 'srv_catchup_changes' | 'srv_live_changes';
    changes: TableChange[];
    lastLSN: string;
    sequence?: {
        chunk: number;
        total: number;
    };
    isConflictResolution?: boolean;
}
export interface ServerCatchupChangesMessage extends ServerChangesMessage {
    type: 'srv_catchup_changes';
}
export interface ServerLiveChangesMessage extends ServerChangesMessage {
    type: 'srv_live_changes';
}
export interface ServerInitChangesMessage extends ServerMessage {
    type: 'srv_init_changes';
    changes: TableChange[];
    sequence: {
        table: string;
        chunk: number;
        total: number;
    };
}
export interface ServerInitStartMessage extends ServerMessage {
    type: 'srv_init_start';
    serverLSN: string;
    resuming?: boolean;
}
export interface ServerInitCompleteMessage extends ServerMessage {
    type: 'srv_init_complete';
    serverLSN: string;
}
export interface ServerStateChangeMessage extends ServerMessage {
    type: 'srv_state_change';
    state: 'initial' | 'catchup' | 'live';
    lsn: string;
}
export interface ServerLSNUpdateMessage extends ServerMessage {
    type: 'srv_lsn_update';
    lsn: string;
}
export interface ServerReceivedMessage extends ServerMessage {
    type: 'srv_changes_received';
    changeIds: string[];
}
export interface ServerAppliedMessage extends ServerMessage {
    type: 'srv_changes_applied';
    appliedChanges: string[];
    success: boolean;
    error?: string;
}
export interface ServerSyncCompletedMessage extends ServerMessage {
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
export interface ServerHeartbeatMessage extends ServerMessage {
    type: 'srv_heartbeat';
    serverLSN?: string;
    inReplyTo?: string;
    error?: string;
}
/**
 * Server integrity reset command message
 */
export interface ServerIntegrityResetMessage extends ServerMessage {
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
export interface ServerIntegrityValidationResponseMessage extends ServerMessage {
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
export interface ServerLiveStartMessage extends ServerMessage {
    type: 'srv_live_start';
    startLSN: string;
    serverLSN: string;
    changeCount: number;
    success: boolean;
}
export interface ServerCatchupCompletedMessage extends ServerMessage {
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
export interface ServerSyncStatsMessage extends ServerMessage {
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
export interface ClientMessage extends BaseMessage {
    type: CltMessageType;
}
export interface ClientChangesMessage extends ClientMessage {
    type: 'clt_send_changes';
    changes: TableChange[];
}
export interface ClientHeartbeatMessage extends ClientMessage {
    type: 'clt_heartbeat';
    state?: string;
    lsn: string;
    active: boolean;
}
export interface ClientReceivedMessage extends ClientMessage {
    type: 'clt_changes_received';
    changeIds: string[];
    lastLSN: string;
}
export interface ClientAppliedMessage extends ClientMessage {
    type: 'clt_changes_applied';
    changeIds: string[];
    lastLSN: string;
}
export interface ClientInitReceivedMessage extends ClientMessage {
    type: 'clt_init_received';
    table: string;
    chunk: number;
}
export interface ClientInitProcessedMessage extends ClientMessage {
    type: 'clt_init_processed';
}
export interface ClientCatchupReceivedMessage extends ClientMessage {
    type: 'clt_catchup_received';
    chunk: number;
    lsn: string;
}
/**
 * Client integrity validation request message
 */
export interface ClientIntegrityValidationMessage extends ClientMessage {
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
export interface ClientIntegrityResetAckMessage extends ClientMessage {
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
export type Message = ServerMessage | ServerCatchupCompletedMessage | ServerLiveStartMessage | ServerSyncStatsMessage | ServerHeartbeatMessage | ServerIntegrityResetMessage | ServerIntegrityValidationResponseMessage | ClientMessage | ClientIntegrityValidationMessage | ClientIntegrityResetAckMessage;
//# sourceMappingURL=messages.d.ts.map