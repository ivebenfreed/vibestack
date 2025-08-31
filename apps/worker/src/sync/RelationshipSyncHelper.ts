import type { TableChange, RelationshipUpdate } from '@repo/sync-types';
import type { Dexie } from 'dexie';

export class RelationshipSyncHelper {
  /**
   * Track a relationship change for sync
   */
  static async trackRelationshipChange(
    entityTable: string,
    entityId: string,
    relationName: string,
    operation: 'set' | 'add' | 'remove',
    targetIds: string[],
    trackOutgoingChange: (change: Partial<TableChange>) => Promise<void>
  ): Promise<void> {
    const relationshipUpdate: RelationshipUpdate = {
      relationName,
      operation,
      targetIds
    };

    await trackOutgoingChange({
      table: entityTable,
      operation: 'update',
      data: { id: entityId },
      relationshipUpdates: [relationshipUpdate]
    });
  }

  /**
   * Process incoming relationship updates
   */
  static async processIncomingRelationshipUpdates(
    change: TableChange,
    junctionTable: string,
    sourceColumn: string,
    targetColumn: string,
    db: Dexie
  ): Promise<void> {
    if (!change.relationshipUpdates || change.relationshipUpdates.length === 0) {
      return;
    }

    const entityId = change.data.id;
    
    for (const update of change.relationshipUpdates) {
      if (update.operation === 'set') {
        // Remove all existing relationships
        await (db as any)[junctionTable]
          .where(sourceColumn)
          .equals(entityId)
          .delete();
        
        // Add new relationships
        if (update.targetIds && update.targetIds.length > 0) {
          const now = new Date();
          const junctionRecords = update.targetIds.map(targetId => ({
            [sourceColumn]: entityId,
            [targetColumn]: targetId,
            createdAt: now,
            updatedAt: now
          }));
          
          await (db as any)[junctionTable].bulkAdd(junctionRecords);
        }
      } else if (update.operation === 'add') {
        // Add new relationships
        if (update.targetIds && update.targetIds.length > 0) {
          const now = new Date();
          const junctionRecords = update.targetIds.map(targetId => ({
            [sourceColumn]: entityId,
            [targetColumn]: targetId,
            createdAt: now,
            updatedAt: now
          }));
          
          // Use bulkPut to handle duplicates gracefully
          await (db as any)[junctionTable].bulkPut(junctionRecords);
        }
      } else if (update.operation === 'remove') {
        // Remove specific relationships
        if (update.targetIds && update.targetIds.length > 0) {
          for (const targetId of update.targetIds) {
            await (db as any)[junctionTable]
              .where(`[${sourceColumn}+${targetColumn}]`)
              .equals([entityId, targetId])
              .delete();
          }
        }
      }
    }
  }
}