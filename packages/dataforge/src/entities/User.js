import { __decorate, __metadata } from "tslib";
import { Entity, Column, OneToMany, ManyToMany } from 'typeorm';
import { IsString, IsEmail, MinLength, IsOptional, IsUrl, Matches, IsEnum, IsBoolean } from 'class-validator';
import { ServerOnly } from '../utils/context.js';
// Import Task and Project for use in decorators
// The Relation wrapper will handle circular dependencies
import { Task } from './Task.js';
import { Project } from './Project.js';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { EnumTypeName } from '../utils/decorators.js';
import { Session } from './Session.js';
import { Account } from './Account.js';
export var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "admin";
    UserRole["MEMBER"] = "member";
    UserRole["VIEWER"] = "viewer";
    UserRole["SUPER_ADMIN"] = "super_admin";
})(UserRole || (UserRole = {}));
/**
 * User entity
 * Contains fields for both server and client contexts with appropriate decorators
 * This is a shared entity (not server-only or client-only)
 * Extends BaseDomainEntity for common fields and behavior
 * Aligned with Better Auth's user schema
 */
let User = class User extends BaseDomainEntity {
};
__decorate([
    Column({ type: "varchar", length: 100 }),
    IsString(),
    MinLength(2, { message: "Name must be at least 2 characters long" }),
    Matches(/^[a-zA-Z0-9\s\-']+$/, {
        message: "Name can only contain letters, numbers, spaces, hyphens, and apostrophes"
    }),
    __metadata("design:type", String)
], User.prototype, "name", void 0);
__decorate([
    Column({ type: "varchar", length: 255, unique: true }),
    IsEmail({}, { message: "Please provide a valid email address" }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    Column({ type: "boolean", name: "email_verified", default: false }),
    IsBoolean(),
    __metadata("design:type", Boolean)
], User.prototype, "emailVerified", void 0);
__decorate([
    Column({ type: "varchar", length: 255, nullable: true, name: "image" }),
    IsOptional(),
    IsUrl({}, { message: "Image URL must be a valid URL" }),
    __metadata("design:type", String)
], User.prototype, "image", void 0);
__decorate([
    Column({ type: "enum", enum: UserRole, default: UserRole.MEMBER }),
    IsEnum(UserRole),
    EnumTypeName({ name: 'UserRole', sourcePath: './User' }),
    __metadata("design:type", String)
], User.prototype, "role", void 0);
__decorate([
    OneToMany(() => Task, (task) => task.assignee),
    __metadata("design:type", Promise)
], User.prototype, "tasks", void 0);
__decorate([
    OneToMany(() => Project, (project) => project.owner),
    __metadata("design:type", Promise)
], User.prototype, "ownedProjects", void 0);
__decorate([
    ManyToMany(() => Project, (project) => project.members),
    __metadata("design:type", Promise)
], User.prototype, "memberProjects", void 0);
__decorate([
    ServerOnly(),
    OneToMany(() => Session, (session) => session.user),
    __metadata("design:type", Promise)
], User.prototype, "sessions", void 0);
__decorate([
    ServerOnly(),
    OneToMany(() => Account, (account) => account.user),
    __metadata("design:type", Promise)
], User.prototype, "accounts", void 0);
User = __decorate([
    Entity('users')
], User);
export { User };
//# sourceMappingURL=User.js.map