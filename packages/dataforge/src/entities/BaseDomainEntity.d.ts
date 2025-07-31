/**
 * Base Domain Entity
 *
 * Provides common properties and behavior for all domain entities
 * that participate in business logic and are replicated between devices.
 *
 * Features:
 * - UUID primary key
 * - Creation and update timestamps
 * - Client ID for CRDT operations
 * - Domain table categorization
 */
export declare abstract class BaseDomainEntity {
    id: string;
    clientId?: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=BaseDomainEntity.d.ts.map