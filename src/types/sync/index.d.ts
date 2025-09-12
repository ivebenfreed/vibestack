import type { CltMessageType } from './messages';
export type { TableChange, RelationshipUpdate } from './table-changes';
import type { TableChange } from './table-changes';
/**
 * Strongly typed record data for sync operations
 * Represents the common fields expected in all records
 */
export interface RecordData {
    id: string;
    clientId: string;
    updatedAt: string;
    [key: string]: unknown;
}
/**
 * Result of executing a client change
 */
export interface ExecutionResult {
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
export type { CltMessageType, SrvMessageType, BaseMessage, ServerMessage, ServerChangesMessage, ServerInitChangesMessage, ServerInitStartMessage, ServerInitCompleteMessage, ServerStateChangeMessage, ServerLSNUpdateMessage, ServerReceivedMessage, ServerAppliedMessage, ServerSyncCompletedMessage, ServerLiveStartMessage, ServerCatchupCompletedMessage, ServerSyncStatsMessage, ServerHeartbeatMessage, ServerIntegrityResetMessage, ServerIntegrityValidationResponseMessage, ClientMessage, ClientChangesMessage, ClientHeartbeatMessage, ClientReceivedMessage, ClientAppliedMessage, ClientInitReceivedMessage, ClientInitProcessedMessage, ClientIntegrityValidationMessage, ClientIntegrityResetAckMessage, Message } from './messages';
/**
 * Client registration types for managing sync clients
 */
export interface ClientRegistration {
    clientId: string;
    timestamp: string;
}
export interface ClientDeregistration {
    clientId: string;
}
export declare function isTableChange(payload: unknown): payload is TableChange;
export declare function isClientMessageType(type: string): type is CltMessageType;
//# sourceMappingURL=index.d.ts.map