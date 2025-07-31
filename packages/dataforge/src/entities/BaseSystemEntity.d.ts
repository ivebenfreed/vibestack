/**
 * Base System Entity
 *
 * Provides common properties and behavior for all system entities
 * that manage internal state and are not replicated between devices.
 *
 * Features:
 * - UUID primary key
 * - Creation timestamp
 * - System table categorization
 *
 * Note: System entities typically don't need client_id or updated_at
 * as they aren't part of CRDT operations
 */
export declare abstract class BaseSystemEntity {
    id: string;
    createdAt: Date;
}
//# sourceMappingURL=BaseSystemEntity.d.ts.map