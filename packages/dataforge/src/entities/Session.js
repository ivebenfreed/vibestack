import { __decorate, __metadata } from "tslib";
import { Entity, Column, ManyToOne, JoinColumn, UpdateDateColumn } from 'typeorm';
import { IsString, IsOptional } from 'class-validator';
import { BaseSystemEntity } from './BaseSystemEntity.js';
import { User } from './User.js';
import { ServerOnly } from '../utils/context.js';
/**
 * Session entity
 * Stores active user sessions
 * Aligned with Better Auth's session schema
 */
let Session = class Session extends BaseSystemEntity {
};
__decorate([
    Column({ type: 'uuid', name: 'user_id' }),
    __metadata("design:type", String)
], Session.prototype, "userId", void 0);
__decorate([
    ManyToOne(() => User),
    JoinColumn({ name: 'user_id' }),
    __metadata("design:type", Promise)
], Session.prototype, "user", void 0);
__decorate([
    Column({ type: 'text', unique: true }),
    IsString(),
    __metadata("design:type", String)
], Session.prototype, "token", void 0);
__decorate([
    Column({ type: 'timestamptz', name: 'expires_at' }),
    __metadata("design:type", Date)
], Session.prototype, "expiresAt", void 0);
__decorate([
    Column({ type: 'text', name: 'ip_address', nullable: true }),
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], Session.prototype, "ipAddress", void 0);
__decorate([
    Column({ type: 'text', name: 'user_agent', nullable: true }),
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], Session.prototype, "userAgent", void 0);
__decorate([
    UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }),
    __metadata("design:type", Date)
], Session.prototype, "updatedAt", void 0);
Session = __decorate([
    Entity('sessions'),
    ServerOnly()
], Session);
export { Session };
//# sourceMappingURL=Session.js.map