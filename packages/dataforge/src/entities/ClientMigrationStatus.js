import { __decorate, __metadata } from "tslib";
import { Entity, Column, Index } from 'typeorm';
import { IsString, IsNumber, IsEnum, Matches } from 'class-validator';
import { ClientOnly, TableCategory } from '../utils/context.js';
import { EnumTypeName } from '../utils/decorators.js';
import { BaseSystemEntity } from './BaseSystemEntity.js';
export var MigrationStatus;
(function (MigrationStatus) {
    MigrationStatus["PENDING"] = "pending";
    MigrationStatus["IN_PROGRESS"] = "in_progress";
    MigrationStatus["COMPLETED"] = "completed";
    MigrationStatus["FAILED"] = "failed";
    MigrationStatus["ROLLED_BACK"] = "rolled_back"; // Successfully rolled back
})(MigrationStatus || (MigrationStatus = {}));
/**
 * This entity tracks the status of client migrations that have been applied.
 * It is only used in the client database and maintains the client's current
 * schema version and migration state.
 * Categorized as a system table for internal state management
 */
let ClientMigrationStatus = class ClientMigrationStatus extends BaseSystemEntity {
};
__decorate([
    Column({ type: "text", name: "migration_name" }),
    IsString(),
    __metadata("design:type", String)
], ClientMigrationStatus.prototype, "migrationName", void 0);
__decorate([
    Column({ type: "text", name: "schema_version" }),
    Matches(/^\d+\.\d+\.\d+$/),
    Index(),
    __metadata("design:type", String)
], ClientMigrationStatus.prototype, "schemaVersion", void 0);
__decorate([
    Column({ type: "enum", enum: MigrationStatus }),
    IsEnum(MigrationStatus),
    EnumTypeName({ name: 'MigrationStatus', sourcePath: './ClientMigrationStatus' }),
    __metadata("design:type", String)
], ClientMigrationStatus.prototype, "status", void 0);
__decorate([
    Column({ type: "timestamptz", nullable: true, name: "started_at" }),
    __metadata("design:type", Date)
], ClientMigrationStatus.prototype, "startedAt", void 0);
__decorate([
    Column({ type: "timestamptz", nullable: true, name: "completed_at" }),
    __metadata("design:type", Date)
], ClientMigrationStatus.prototype, "completedAt", void 0);
__decorate([
    Column({ type: "text", nullable: true, name: "error_message" }),
    __metadata("design:type", String)
], ClientMigrationStatus.prototype, "errorMessage", void 0);
__decorate([
    Column({ type: "integer", default: 0 }),
    IsNumber(),
    __metadata("design:type", Number)
], ClientMigrationStatus.prototype, "attempts", void 0);
__decorate([
    Column({ type: "bigint" }),
    IsNumber(),
    __metadata("design:type", Number)
], ClientMigrationStatus.prototype, "timestamp", void 0);
ClientMigrationStatus = __decorate([
    Entity('client_migration_status'),
    ClientOnly(),
    TableCategory('system')
], ClientMigrationStatus);
export { ClientMigrationStatus };
//# sourceMappingURL=ClientMigrationStatus.js.map