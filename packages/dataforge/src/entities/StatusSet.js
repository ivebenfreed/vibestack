import { __decorate, __metadata } from "tslib";
import { Entity, Column, OneToMany, ManyToMany } from 'typeorm';
import { IsString, MinLength, MaxLength, IsIn, IsOptional, IsHexColor, IsInt, Min } from 'class-validator';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { StatusDefinition } from './StatusDefinition.js';
import { Project } from './Project.js';
import { EnumTypeName } from '../utils/decorators.js';
/**
 * StatusSet entity
 * Represents a collection of status definitions that can be applied to entities
 * Supports sharing status workflows across multiple projects
 */
let StatusSet = class StatusSet extends BaseDomainEntity {
};
__decorate([
    Column({ type: 'varchar', length: 100 }),
    IsString(),
    MinLength(1),
    MaxLength(100),
    __metadata("design:type", String)
], StatusSet.prototype, "name", void 0);
__decorate([
    Column({ type: 'varchar', length: 50 }),
    IsString(),
    IsIn(['task', 'project']),
    EnumTypeName({ name: 'EntityType', sourcePath: './StatusSet' }),
    __metadata("design:type", String)
], StatusSet.prototype, "entityType", void 0);
__decorate([
    Column({ type: 'text', nullable: true }),
    IsOptional(),
    IsString(),
    MaxLength(500),
    __metadata("design:type", String)
], StatusSet.prototype, "description", void 0);
__decorate([
    Column({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], StatusSet.prototype, "isSystem", void 0);
__decorate([
    Column({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], StatusSet.prototype, "isActive", void 0);
__decorate([
    Column({ type: 'varchar', length: 7, nullable: true, name: 'default_color' }),
    IsOptional(),
    IsHexColor(),
    __metadata("design:type", String)
], StatusSet.prototype, "defaultColor", void 0);
__decorate([
    Column({ type: 'int', default: 0, name: 'display_order' }),
    IsInt(),
    Min(0),
    __metadata("design:type", Number)
], StatusSet.prototype, "displayOrder", void 0);
__decorate([
    Column({ type: 'jsonb', default: {} }),
    __metadata("design:type", Object)
], StatusSet.prototype, "metadata", void 0);
__decorate([
    OneToMany(() => StatusDefinition, def => def.statusSet),
    __metadata("design:type", Promise)
], StatusSet.prototype, "statuses", void 0);
__decorate([
    ManyToMany(() => Project, project => project.statusSets),
    __metadata("design:type", Promise)
], StatusSet.prototype, "projects", void 0);
StatusSet = __decorate([
    Entity('status_sets')
], StatusSet);
export { StatusSet };
//# sourceMappingURL=StatusSet.js.map