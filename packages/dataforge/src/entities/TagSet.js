import { __decorate, __metadata } from "tslib";
import { Entity, Column, OneToMany, ManyToMany } from 'typeorm';
import { IsString, IsOptional, IsIn, IsHexColor, IsInt, Min, MaxLength } from 'class-validator';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { Tag } from './Tag.js';
import { Project } from './Project.js';
import { EnumTypeName } from '../utils/decorators.js';
/**
 * TagSet entity
 * Represents a collection of tags that can be applied to entities
 * Supports categorization and sharing tag collections across projects
 */
let TagSet = class TagSet extends BaseDomainEntity {
};
__decorate([
    Column({ type: 'varchar', length: 100 }),
    IsString(),
    MaxLength(100),
    __metadata("design:type", String)
], TagSet.prototype, "name", void 0);
__decorate([
    Column({ type: 'text', nullable: true }),
    IsOptional(),
    IsString(),
    MaxLength(500),
    __metadata("design:type", String)
], TagSet.prototype, "description", void 0);
__decorate([
    Column({ type: 'varchar', length: 50, nullable: true }),
    IsOptional(),
    IsString(),
    IsIn(['priority', 'type', 'component', 'general']),
    EnumTypeName({ name: 'TagCategory', sourcePath: './TagSet' }),
    __metadata("design:type", String)
], TagSet.prototype, "category", void 0);
__decorate([
    Column({ type: 'boolean', default: false, name: 'is_system' }),
    __metadata("design:type", Boolean)
], TagSet.prototype, "isSystem", void 0);
__decorate([
    Column({ type: 'boolean', default: true, name: 'is_active' }),
    __metadata("design:type", Boolean)
], TagSet.prototype, "isActive", void 0);
__decorate([
    Column({ type: 'varchar', length: 7, default: '#94a3b8', name: 'default_color' }),
    IsHexColor(),
    __metadata("design:type", String)
], TagSet.prototype, "defaultColor", void 0);
__decorate([
    Column({ type: 'int', default: 0, name: 'display_order' }),
    IsInt(),
    Min(0),
    __metadata("design:type", Number)
], TagSet.prototype, "displayOrder", void 0);
__decorate([
    Column({ type: 'boolean', default: false, name: 'is_exclusive' }),
    __metadata("design:type", Boolean)
], TagSet.prototype, "isExclusive", void 0);
__decorate([
    Column({ type: 'int', nullable: true, name: 'max_tags' }),
    IsOptional(),
    IsInt(),
    Min(0),
    __metadata("design:type", Number)
], TagSet.prototype, "maxTags", void 0);
__decorate([
    Column({ type: 'jsonb', default: {} }),
    __metadata("design:type", Object)
], TagSet.prototype, "metadata", void 0);
__decorate([
    OneToMany(() => Tag, tag => tag.tagSet),
    __metadata("design:type", Promise)
], TagSet.prototype, "tags", void 0);
__decorate([
    ManyToMany(() => Project, project => project.tagSets),
    __metadata("design:type", Promise)
], TagSet.prototype, "projects", void 0);
TagSet = __decorate([
    Entity('tag_sets')
], TagSet);
export { TagSet };
//# sourceMappingURL=TagSet.js.map