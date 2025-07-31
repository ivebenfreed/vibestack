import { __decorate, __metadata } from "tslib";
import { Entity, Column, ManyToOne, OneToMany, ManyToMany, JoinColumn } from 'typeorm';
import { IsString, IsUUID, IsHexColor, IsOptional, IsIn, IsInt, Min, IsDate, Matches, MaxLength } from 'class-validator';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { TagSet } from './TagSet.js';
import { Task } from './Task.js';
import { EnumTypeName } from '../utils/decorators.js';
/**
 * Tag entity
 * Represents an individual tag within a tag set
 * Supports hierarchical organization and usage tracking
 */
let Tag = class Tag extends BaseDomainEntity {
};
__decorate([
    Column({ type: 'uuid', name: 'tag_set_id' }),
    IsUUID(),
    __metadata("design:type", String)
], Tag.prototype, "tagSetId", void 0);
__decorate([
    Column({ type: 'varchar', length: 50 }),
    IsString(),
    MaxLength(50),
    __metadata("design:type", String)
], Tag.prototype, "name", void 0);
__decorate([
    Column({ type: 'varchar', length: 50, unique: true }),
    IsString(),
    Matches(/^[a-z][a-z0-9-]*$/, { message: 'Slug must be kebab-case' }),
    __metadata("design:type", String)
], Tag.prototype, "slug", void 0);
__decorate([
    Column({ type: 'varchar', length: 7 }),
    IsHexColor(),
    __metadata("design:type", String)
], Tag.prototype, "color", void 0);
__decorate([
    Column({ type: 'varchar', length: 50, nullable: true }),
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], Tag.prototype, "icon", void 0);
__decorate([
    Column({ type: 'varchar', length: 20, default: 'solid' }),
    IsString(),
    IsIn(['solid', 'outline', 'ghost']),
    EnumTypeName({ name: 'TagVariant', sourcePath: './Tag' }),
    __metadata("design:type", String)
], Tag.prototype, "variant", void 0);
__decorate([
    Column({ type: 'int', default: 0, name: 'sort_order' }),
    IsInt(),
    Min(0),
    __metadata("design:type", Number)
], Tag.prototype, "sortOrder", void 0);
__decorate([
    Column({ type: 'uuid', nullable: true, name: 'parent_id' }),
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], Tag.prototype, "parentId", void 0);
__decorate([
    Column({ type: 'boolean', default: true, name: 'is_active' }),
    __metadata("design:type", Boolean)
], Tag.prototype, "isActive", void 0);
__decorate([
    Column({ type: 'int', default: 0, name: 'usage_count' }),
    IsInt(),
    Min(0),
    __metadata("design:type", Number)
], Tag.prototype, "usageCount", void 0);
__decorate([
    Column({ type: 'timestamptz', nullable: true, name: 'last_used_at' }),
    IsOptional(),
    IsDate(),
    __metadata("design:type", Date)
], Tag.prototype, "lastUsedAt", void 0);
__decorate([
    Column({ type: 'jsonb', default: {} }),
    __metadata("design:type", Object)
], Tag.prototype, "metadata", void 0);
__decorate([
    ManyToOne(() => TagSet, set => set.tags),
    JoinColumn({ name: 'tag_set_id' }),
    __metadata("design:type", Promise)
], Tag.prototype, "tagSet", void 0);
__decorate([
    ManyToOne(() => Tag, tag => tag.children, { nullable: true }),
    JoinColumn({ name: 'parent_id' }),
    __metadata("design:type", Promise)
], Tag.prototype, "parent", void 0);
__decorate([
    OneToMany(() => Tag, tag => tag.parent),
    __metadata("design:type", Promise)
], Tag.prototype, "children", void 0);
__decorate([
    ManyToMany(() => Task, task => task.tags),
    __metadata("design:type", Promise)
], Tag.prototype, "tasks", void 0);
Tag = __decorate([
    Entity('tags')
], Tag);
export { Tag };
//# sourceMappingURL=Tag.js.map