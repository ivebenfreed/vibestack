import { __decorate, __metadata } from "tslib";
import { Entity, Column, ManyToOne, JoinColumn, UpdateDateColumn } from 'typeorm';
import { IsString, IsOptional } from 'class-validator';
import { BaseSystemEntity } from './BaseSystemEntity.js';
import { User } from './User.js';
import { ServerOnly } from '../utils/context.js';
/**
 * Account entity
 * Links users to authentication methods (email/password, social providers)
 * Aligned with Better Auth's account schema
 */
let Account = class Account extends BaseSystemEntity {
};
__decorate([
    Column({ type: 'uuid', name: 'user_id' }),
    __metadata("design:type", String)
], Account.prototype, "userId", void 0);
__decorate([
    ManyToOne(() => User),
    JoinColumn({ name: 'user_id' }),
    __metadata("design:type", Promise)
], Account.prototype, "user", void 0);
__decorate([
    Column({ type: 'text', name: 'account_id' }),
    IsString(),
    __metadata("design:type", String)
], Account.prototype, "accountId", void 0);
__decorate([
    Column({ type: 'text', name: 'provider_id' }),
    IsString(),
    __metadata("design:type", String)
], Account.prototype, "providerId", void 0);
__decorate([
    Column({ type: 'text', name: 'access_token', nullable: true }),
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], Account.prototype, "accessToken", void 0);
__decorate([
    Column({ type: 'text', name: 'refresh_token', nullable: true }),
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], Account.prototype, "refreshToken", void 0);
__decorate([
    Column({ type: 'text', name: 'id_token', nullable: true }),
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], Account.prototype, "idToken", void 0);
__decorate([
    Column({ type: 'timestamptz', name: 'access_token_expires_at', nullable: true }),
    __metadata("design:type", Date)
], Account.prototype, "accessTokenExpiresAt", void 0);
__decorate([
    Column({ type: 'timestamptz', name: 'refresh_token_expires_at', nullable: true }),
    __metadata("design:type", Date)
], Account.prototype, "refreshTokenExpiresAt", void 0);
__decorate([
    Column({ type: 'text', nullable: true }),
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], Account.prototype, "scope", void 0);
__decorate([
    Column({ type: 'text', nullable: true }),
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], Account.prototype, "password", void 0);
__decorate([
    UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' }),
    __metadata("design:type", Date)
], Account.prototype, "updatedAt", void 0);
Account = __decorate([
    Entity('accounts'),
    ServerOnly()
], Account);
export { Account };
//# sourceMappingURL=Account.js.map