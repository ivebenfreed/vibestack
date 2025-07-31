import { __decorate, __metadata } from "tslib";
import { Entity, Column, ManyToOne, ManyToMany, JoinTable, JoinColumn, Check } from 'typeorm';
import { IsString, MinLength, IsOptional, IsEnum, IsDate, IsArray, IsUUID, MaxLength } from 'class-validator';
// Import User and Project for use in decorators
// The Relation wrapper will handle circular dependencies
import { User } from './User.js';
import { Project } from './Project.js';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { StatusDefinition } from './StatusDefinition.js';
import { Tag } from './Tag.js';
// No need for ServerOnly/ClientOnly decorators as this is a shared entity
import { EnumTypeName } from '../utils/decorators.js'; // Import the new decorator
// These enum values must match the database exactly
export var TaskStatus;
(function (TaskStatus) {
    TaskStatus["OPEN"] = "open";
    TaskStatus["IN_PROGRESS"] = "in_progress";
    TaskStatus["COMPLETED"] = "completed";
})(TaskStatus || (TaskStatus = {}));
export var TaskPriority;
(function (TaskPriority) {
    TaskPriority["LOW"] = "low";
    TaskPriority["MEDIUM"] = "medium";
    TaskPriority["HIGH"] = "high";
})(TaskPriority || (TaskPriority = {}));
/**
 * Task entity
 * Contains task information and relationships to users and projects
 * Extends BaseDomainEntity for common fields and behavior
 */
let Task = class Task extends BaseDomainEntity {
};
__decorate([
    Column({ type: "varchar", length: 100 }),
    IsString(),
    MinLength(1, { message: "Title cannot be empty" }),
    MaxLength(100, { message: "Title cannot exceed 100 characters" }),
    __metadata("design:type", String)
], Task.prototype, "title", void 0);
__decorate([
    Column({ type: "text", nullable: true }),
    IsOptional(),
    IsString(),
    MaxLength(5000, { message: "Description cannot exceed 5000 characters" }),
    __metadata("design:type", String)
], Task.prototype, "description", void 0);
__decorate([
    Column({ type: "enum", enum: TaskStatus, default: TaskStatus.OPEN, nullable: true, name: 'legacy_status' }),
    IsOptional(),
    IsEnum(TaskStatus),
    EnumTypeName({ name: 'TaskStatus', sourcePath: './Task' }),
    __metadata("design:type", String)
], Task.prototype, "legacyStatus", void 0);
__decorate([
    Column({ type: 'uuid', nullable: true, name: 'status_id' }),
    IsOptional(),
    IsUUID(),
    __metadata("design:type", String)
], Task.prototype, "statusId", void 0);
__decorate([
    ManyToOne(() => StatusDefinition, status => status.tasks),
    JoinColumn({ name: 'status_id' }),
    __metadata("design:type", StatusDefinition)
], Task.prototype, "status", void 0);
__decorate([
    Column({ type: "enum", enum: TaskPriority, default: TaskPriority.MEDIUM }),
    IsEnum(TaskPriority),
    EnumTypeName({ name: 'TaskPriority', sourcePath: './Task' }),
    __metadata("design:type", String)
], Task.prototype, "priority", void 0);
__decorate([
    Column({ type: "timestamptz", nullable: true, name: "due_date" }),
    IsOptional(),
    IsDate(),
    __metadata("design:type", Date)
], Task.prototype, "dueDate", void 0);
__decorate([
    Column({ type: "timestamptz", nullable: true, name: "start_date" }),
    IsOptional(),
    IsDate(),
    __metadata("design:type", Object)
], Task.prototype, "startDate", void 0);
__decorate([
    Column({ type: "timestamptz", nullable: true, name: "completed_at" }),
    IsOptional(),
    IsDate(),
    __metadata("design:type", Date)
], Task.prototype, "completedAt", void 0);
__decorate([
    Column({ type: "tsrange", nullable: true, name: "time_range" }),
    IsOptional(),
    __metadata("design:type", String)
], Task.prototype, "timeRange", void 0);
__decorate([
    Column({ type: "interval", nullable: true, name: "estimated_duration" }),
    IsOptional(),
    __metadata("design:type", String)
], Task.prototype, "estimatedDuration", void 0);
__decorate([
    Column("text", { array: true, default: [], nullable: true, name: 'legacy_tags' }),
    IsOptional(),
    IsArray(),
    IsString({ each: true }),
    __metadata("design:type", Array)
], Task.prototype, "legacyTags", void 0);
__decorate([
    ManyToMany(() => Tag, tag => tag.tasks),
    JoinTable({
        name: 'task_tags',
        joinColumn: { name: 'task_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' }
    }),
    __metadata("design:type", Array)
], Task.prototype, "tags", void 0);
__decorate([
    Column({ type: "uuid", name: "project_id", nullable: true }),
    IsOptional(),
    IsUUID(4),
    __metadata("design:type", String)
], Task.prototype, "projectId", void 0);
__decorate([
    Column({ type: "uuid", nullable: true, name: "assignee_id" }),
    IsOptional(),
    IsUUID(4),
    __metadata("design:type", String)
], Task.prototype, "assigneeId", void 0);
__decorate([
    ManyToOne(() => Project, (project) => project.tasks, { nullable: true }),
    JoinColumn({ name: "project_id" }),
    __metadata("design:type", Promise)
], Task.prototype, "project", void 0);
__decorate([
    ManyToOne(() => User, (user) => user.tasks, { nullable: true }),
    JoinColumn({ name: "assignee_id" }),
    __metadata("design:type", Promise)
], Task.prototype, "assignee", void 0);
__decorate([
    ManyToMany(() => Task, task => task.tasksDependentOnThis) // Updated to point to the new inverse property
    ,
    JoinTable({
        name: 'task_dependencies',
        joinColumn: { name: 'dependent_task_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'dependency_task_id', referencedColumnName: 'id' }
    }),
    __metadata("design:type", Promise)
], Task.prototype, "dependencies", void 0);
__decorate([
    ManyToMany(() => Task, task => task.dependencies),
    __metadata("design:type", Promise)
], Task.prototype, "tasksDependentOnThis", void 0);
Task = __decorate([
    Entity('tasks'),
    Check('chk_task_start_date_before_due_date', '("start_date" IS NULL OR "due_date" IS NULL) OR ("start_date" < "due_date")')
], Task);
export { Task };
//# sourceMappingURL=Task.js.map