import { BaseSystemEntity } from './BaseSystemEntity.js';
/**
 * Account entity
 * Links users to authentication methods (email/password, social providers)
 * Aligned with Better Auth's account schema
 */
export declare class Account extends BaseSystemEntity {
    userId: string;
    user: Promise<import('./User.js').User>;
    accountId: string;
    providerId: string;
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
    accessTokenExpiresAt?: Date;
    refreshTokenExpiresAt?: Date;
    scope?: string;
    password?: string;
    updatedAt: Date;
}
//# sourceMappingURL=Account.d.ts.map