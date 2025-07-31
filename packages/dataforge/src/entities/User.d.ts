import { BaseDomainEntity } from './BaseDomainEntity.js';
export declare enum UserRole {
    ADMIN = "admin",
    MEMBER = "member",
    VIEWER = "viewer",
    SUPER_ADMIN = "super_admin"
}
/**
 * User entity
 * Contains fields for both server and client contexts with appropriate decorators
 * This is a shared entity (not server-only or client-only)
 * Extends BaseDomainEntity for common fields and behavior
 * Aligned with Better Auth's user schema
 */
export declare class User extends BaseDomainEntity {
    name: string;
    email: string;
    emailVerified: boolean;
    image?: string;
    role: UserRole;
    tasks: Promise<import('./Task.js').Task[]>;
    ownedProjects: Promise<import('./Project.js').Project[]>;
    memberProjects: Promise<import('./Project.js').Project[]>;
    sessions: Promise<import('./Session.js').Session[]>;
    accounts: Promise<import('./Account.js').Account[]>;
}
//# sourceMappingURL=User.d.ts.map