/**
 * Relationship update information for junction table operations
 */
export interface RelationshipUpdate {
    relationName: string;
    operation: 'set' | 'add' | 'remove';
    targetIds: string[];
}
/**
 * Core change type for replication
 * Represents a change to a table that needs to be replicated
 *
 * IMPORTANT: The `data` field should contain TypeORM entity data in camelCase format
 * with proper types (Date objects for dates, not strings). This preserves TypeORM
 * entity structure throughout the sync pipeline and reduces unnecessary conversions.
 */
export interface TableChange {
    table: string;
    operation: 'insert' | 'update' | 'delete';
    /**
     * Entity data in TypeORM format (camelCase properties, proper types)
     * - Date fields should be Date objects, not ISO strings
     * - Property names should match TypeORM entity properties (camelCase)
     * - This preserves the entity structure from client to server
     */
    data: Record<string, unknown>;
    /**
     * ISO timestamp string of when the record was last updated
     * This is separate from data.updatedAt to avoid confusion
     */
    updatedAt: string;
    lsn?: string;
    clientId?: string;
    relationshipUpdates?: RelationshipUpdate[];
    entityRelations?: string[];
}
export declare function isTableChange(payload: unknown): payload is TableChange;
export declare function isRelationshipUpdate(payload: unknown): payload is RelationshipUpdate;
//# sourceMappingURL=table-changes.d.ts.map