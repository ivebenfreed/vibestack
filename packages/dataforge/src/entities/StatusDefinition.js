import { __decorate, __metadata } from "tslib";
import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { IsString, IsUUID, IsHexColor, IsOptional, IsIn, IsInt, Min, Matches } from 'class-validator';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { StatusSet } from './StatusSet.js';
import { Task } from './Task.js';
import { EnumTypeName } from '../utils/decorators.js';
/**
 * StatusDefinition entity
 * Represents an individual status within a status set
 * Contains visual properties, workflow rules, and sort order
 */
let StatusDefinition = class StatusDefinition extends BaseDomainEntity {
};
__decorate([
    Column({ type: 'uuid', name: 'status_set_id' }),
    IsUUID(),
    __metadata("design:type", String)
], StatusDefinition.prototype, "statusSetId", void 0);
__decorate([
    Column({ type: 'varchar', length: 50 }),
    IsString(),
    Matches(/^[a-z][a-z0-9_]*$/, { message: 'Name must be snake_case' }),
    __metadata("design:type", String)
], StatusDefinition.prototype, "name", void 0);
__decorate([
    Column({ type: 'varchar', length: 100 }),
    IsString(),
    __metadata("design:type", String)
], StatusDefinition.prototype, "label", void 0);
__decorate([
    Column({ type: 'varchar', length: 7 }),
    IsHexColor(),
    __metadata("design:type", String)
], StatusDefinition.prototype, "color", void 0);
__decorate([
    Column({ type: 'varchar', length: 50, nullable: true }),
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], StatusDefinition.prototype, "icon", void 0);
__decorate([
    Column({ type: 'varchar', length: 20, nullable: true }),
    IsOptional(),
    IsString(),
    IsIn(['solid', 'outline', 'ghost']),
    EnumTypeName({ name: 'StatusVariant', sourcePath: './StatusDefinition' }),
    __metadata("design:type", String)
], StatusDefinition.prototype, "variant", void 0);
__decorate([
    Column({ type: 'int', name: 'sort_order' }),
    IsInt(),
    Min(0),
    __metadata("design:type", Number)
], StatusDefinition.prototype, "sortOrder", void 0);
__decorate([
    Column({ type: 'boolean', default: false, name: 'is_default' }),
    __metadata("design:type", Boolean)
], StatusDefinition.prototype, "isDefault", void 0);
__decorate([
    Column({ type: 'boolean', default: false, name: 'is_final' }),
    __metadata("design:type", Boolean)
], StatusDefinition.prototype, "isFinal", void 0);
__decorate([
    Column({ type: 'boolean', default: true, name: 'is_active' }),
    __metadata("design:type", Boolean)
], StatusDefinition.prototype, "isActive", void 0);
__decorate([
    Column({ type: 'uuid', array: true, nullable: true, name: 'allowed_transitions' }),
    IsOptional(),
    IsUUID('4', { each: true }),
    __metadata("design:type", Array)
], StatusDefinition.prototype, "allowedTransitions", void 0);
__decorate([
    Column({ type: 'int', nullable: true, name: 'auto_transition_days' }),
    IsOptional(),
    IsInt(),
    Min(0),
    __metadata("design:type", Number)
], StatusDefinition.prototype, "autoTransitionDays", void 0);
__decorate([
    Column({ type: 'jsonb', default: {} }),
    __metadata("design:type", Object)
], StatusDefinition.prototype, "metadata", void 0);
__decorate([
    ManyToOne(() => StatusSet, set => set.statuses),
    JoinColumn({ name: 'status_set_id' }),
    __metadata("design:type", Promise)
], StatusDefinition.prototype, "statusSet", void 0);
__decorate([
    OneToMany(() => Task, task => task.status),
    __metadata("design:type", Promise)
], StatusDefinition.prototype, "tasks", void 0);
StatusDefinition = __decorate([
    Entity('status_definitions')
], StatusDefinition);
export { StatusDefinition };
//# sourceMappingURL=StatusDefinition.js.map