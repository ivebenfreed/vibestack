import { __decorate, __metadata } from "tslib";
import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Column } from 'typeorm';
import { IsUUID, IsDate, IsOptional } from 'class-validator';
import { TableCategory } from '../utils/context.js';
/**
 * Base Domain Entity
 *
 * Provides common properties and behavior for all domain entities
 * that participate in business logic and are replicated between devices.
 *
 * Features:
 * - UUID primary key
 * - Creation and update timestamps
 * - Client ID for CRDT operations
 * - Domain table categorization
 */
let BaseDomainEntity = class BaseDomainEntity {
};
__decorate([
    PrimaryGeneratedColumn('uuid'),
    IsUUID(4, { message: "ID must be a valid UUID" }),
    __metadata("design:type", String)
], BaseDomainEntity.prototype, "id", void 0);
__decorate([
    Column({ type: "uuid", nullable: true, name: "client_id" }),
    IsOptional(),
    IsUUID(4, { message: "Client ID must be a valid UUID" }),
    __metadata("design:type", String)
], BaseDomainEntity.prototype, "clientId", void 0);
__decorate([
    CreateDateColumn({ type: "timestamptz", name: "created_at" }),
    IsDate({ message: "Created date must be a valid date" }),
    __metadata("design:type", Date)
], BaseDomainEntity.prototype, "createdAt", void 0);
__decorate([
    UpdateDateColumn({
        type: "timestamptz",
        name: "updated_at"
    }),
    IsDate({ message: "Updated date must be a valid date" }),
    __metadata("design:type", Date)
], BaseDomainEntity.prototype, "updatedAt", void 0);
BaseDomainEntity = __decorate([
    TableCategory('domain')
], BaseDomainEntity);
export { BaseDomainEntity };
//# sourceMappingURL=BaseDomainEntity.js.map