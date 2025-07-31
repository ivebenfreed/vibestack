import { BaseSystemEntity } from './BaseSystemEntity.js';
export declare enum MigrationStatus {
    PENDING = "pending",// Not yet started
    IN_PROGRESS = "in_progress",// Currently being applied
    COMPLETED = "completed",// Successfully applied
    FAILED = "failed",// Failed to apply
    ROLLED_BACK = "rolled_back"
}
/**
 * This entity tracks the status of client migrations that have been applied.
 * It is only used in the client database and maintains the client's current
 * schema version and migration state.
 * Categorized as a system table for internal state management
 */
export declare class ClientMigrationStatus extends BaseSystemEntity {
    migrationName: string;
    schemaVersion: string;
    status: MigrationStatus;
    startedAt?: Date;
    completedAt?: Date;
    errorMessage?: string;
    attempts: number;
    timestamp: number;
}
//# sourceMappingURL=ClientMigrationStatus.d.ts.map