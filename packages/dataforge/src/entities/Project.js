import { __decorate, __metadata } from "tslib";
import { Entity, Column, ManyToOne, OneToMany, ManyToMany, JoinTable, JoinColumn } from 'typeorm';
import { IsString, MinLength, IsOptional, IsUUID, MaxLength, Matches, IsEnum } from 'class-validator';
// Import User and Task for use in decorators
// The Relation wrapper will handle circular dependencies
import { User } from './User.js';
import { Task } from './Task.js';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { StatusSet } from './StatusSet.js';
import { TagSet } from './TagSet.js';
// No need for ServerOnly/ClientOnly decorators as this is a shared entity
import { EnumTypeName } from '../utils/decorators.js';
export var ProjectStatus;
(function (ProjectStatus) {
    ProjectStatus["ACTIVE"] = "active";
    ProjectStatus["IN_PROGRESS"] = "in_progress";
    ProjectStatus["COMPLETED"] = "completed";
    ProjectStatus["ON_HOLD"] = "on_hold";
})(ProjectStatus || (ProjectStatus = {}));
/**
 * Project entity
 * Contains project information and relationships to users and tasks
 * Extends BaseDomainEntity for common fields and behavior
 */
let Project = class Project extends BaseDomainEntity {
};
__decorate([
    Column({ type: "varchar", length: 100 }),
    IsString({ message: "Name must be a string" }),
    MinLength(2, { message: "Name must be at least 2 characters long" }),
    MaxLength(100, { message: "Name cannot exceed 100 characters" }),
    Matches(/^[a-zA-Z0-9\s\-_'.]+$/, {
        message: "Name can only contain letters, numbers, spaces, hyphens, underscores, apostrophes, and periods"
    }),
    __metadata("design:type", String)
], Project.prototype, "name", void 0);
__decorate([
    Column({ type: "text", nullable: true }),
    IsOptional(),
    IsString({ message: "Description must be a string" }),
    MaxLength(5000, { message: "Description cannot exceed 5000 characters" }),
    __metadata("design:type", String)
], Project.prototype, "description", void 0);
__decorate([
    Column({ type: "enum", enum: ProjectStatus, default: ProjectStatus.ACTIVE }),
    IsEnum(ProjectStatus),
    EnumTypeName({ name: 'ProjectStatus', sourcePath: './Project' }),
    __metadata("design:type", String)
], Project.prototype, "status", void 0);
__decorate([
    Column({ type: "uuid", name: "owner_id", nullable: true }),
    IsOptional(),
    IsUUID(4, { message: "Owner ID must be a valid UUID" }),
    __metadata("design:type", String)
], Project.prototype, "ownerId", void 0);
__decorate([
    ManyToOne(() => User, (user) => user.ownedProjects, { nullable: true }),
    JoinColumn({ name: "owner_id" }),
    __metadata("design:type", Promise)
], Project.prototype, "owner", void 0);
__decorate([
    ManyToMany(() => User, (user) => user.memberProjects),
    JoinTable({
        name: 'project_members',
        joinColumn: {
            name: 'project_id',
            referencedColumnName: 'id'
        },
        inverseJoinColumn: {
            name: 'user_id',
            referencedColumnName: 'id'
        }
    }),
    __metadata("design:type", Promise)
], Project.prototype, "members", void 0);
__decorate([
    OneToMany(() => Task, (task) => task.project),
    __metadata("design:type", Promise)
], Project.prototype, "tasks", void 0);
__decorate([
    ManyToMany(() => StatusSet, (statusSet) => statusSet.projects),
    JoinTable({
        name: 'project_status_sets',
        joinColumn: {
            name: 'project_id',
            referencedColumnName: 'id'
        },
        inverseJoinColumn: {
            name: 'status_set_id',
            referencedColumnName: 'id'
        }
    }),
    __metadata("design:type", Promise)
], Project.prototype, "statusSets", void 0);
__decorate([
    ManyToMany(() => TagSet, (tagSet) => tagSet.projects),
    JoinTable({
        name: 'project_tag_sets',
        joinColumn: {
            name: 'project_id',
            referencedColumnName: 'id'
        },
        inverseJoinColumn: {
            name: 'tag_set_id',
            referencedColumnName: 'id'
        }
    }),
    __metadata("design:type", Promise)
], Project.prototype, "tagSets", void 0);
Project = __decorate([
    Entity('projects')
], Project);
export { Project };
//# sourceMappingURL=Project.js.map