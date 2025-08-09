import { getDb, sql, eq } from '../lib/drizzle.js';
import * as schema from '@repo/dataforge/drizzle-schema';
import { ChangePayload, EntityChange } from '../lib/sync-common.js';


export async function processIncomingChanges(changes: ChangePayload): Promise<{
  accepted: string[];
  rejected: Array<{ id: string; reason: string }>;
}> {
  const db = getDb();
  const accepted: string[] = [];
  const rejected: Array<{ id: string; reason: string }> = [];
  
  // Process changes in a transaction
  await db.transaction(async (tx) => {
    for (const change of changes.changes) {
      try {
        await processEntityChange(tx, change);
        accepted.push(change.id);
      } catch (error) {
        rejected.push({
          id: change.id,
          reason: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });
  
  return { accepted, rejected };
}

async function processEntityChange(tx: any, change: EntityChange) {
  const table = (schema as any)[change.table];
  if (!table) {
    throw new Error(`Unknown table: ${change.table}`);
  }
  
  switch (change.operation) {
    case 'upsert':
      await upsertEntity(tx, table, change);
      break;
    
    case 'delete':
      await deleteEntity(tx, table, change);
      break;
    
    default:
      throw new Error(`Unknown operation: ${change.operation}`);
  }
}

async function upsertEntity(tx: any, table: any, change: EntityChange) {
  // CRDT logic - only update if incoming is newer
  const result = await tx.insert(table)
    .values(change.data)
    .onConflictDoUpdate({
      target: table.id,
      set: change.data,
      where: sql`${table.updatedAt} < ${change.data.updatedAt}`
    })
    .returning();
  
  if (result.length === 0) {
    throw new Error('CRDT conflict: existing data is newer');
  }
}

async function deleteEntity(tx: any, table: any, change: EntityChange) {
  // For deletes, check if the entity exists and if we should delete it
  const existing = await tx.select()
    .from(table)
    .where(eq(table.id, change.id))
    .limit(1);
  
  if (existing.length === 0) {
    // Already deleted
    return;
  }
  
  // Check timestamp for CRDT
  const existingTimestamp = new Date(existing[0].updatedAt);
  const deleteTimestamp = new Date(change.timestamp);
  
  if (deleteTimestamp >= existingTimestamp) {
    await tx.delete(table).where(eq(table.id, change.id));
  } else {
    throw new Error('CRDT conflict: existing data is newer than delete timestamp');
  }
}

// Get changes for initial sync
export async function getChangesForSync(since?: Date): Promise<ChangePayload> {
  const db = getDb();
  const changes: EntityChange[] = [];
  
  // Get all domain tables
  const domainTables = schema.tableCategories.domain;
  
  for (const tableName of domainTables) {
    const table = (schema as any)[tableName];
    if (!table) continue;
    
    let query = db.select().from(table);
    
    if (since) {
      query = query.where(sql`${table.updatedAt} >= ${since}`);
    }
    
    const rows = await query;
    
    for (const row of rows) {
      changes.push({
        id: row.id,
        table: tableName,
        operation: 'upsert',
        data: row,
        timestamp: row.updatedAt,
        version: 1,
      });
    }
  }
  
  // Sort by timestamp for proper ordering
  changes.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeA - timeB;
  });
  
  return {
    changes,
    timestamp: new Date().toISOString(),
    lastSyncedAt: since?.toISOString(),
  };
}