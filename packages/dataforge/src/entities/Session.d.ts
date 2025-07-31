import { BaseSystemEntity } from './BaseSystemEntity.js';
/**
 * Session entity
 * Stores active user sessions
 * Aligned with Better Auth's session schema
 */
export declare class Session extends BaseSystemEntity {
    userId: string;
    user: Promise<import('./User.js').User>;
    token: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
    updatedAt: Date;
}
//# sourceMappingURL=Session.d.ts.map