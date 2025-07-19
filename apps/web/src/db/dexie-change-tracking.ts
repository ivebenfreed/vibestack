/**
 * Dexie Change Tracking Hooks
 * 
 * Automatically tracks all changes made to Dexie tables in the local_changes table
 * for outgoing sync. Uses Dexie's database hooks (not React hooks) to intercept
 * create, update, and delete operations.
 */

import { db } from '@repo/dataforge/dexie-schema';
import { nanoid } from 'nanoid';
import type { LocalChanges } from '@repo/dataforge/client-entities';

let currentClientId = 'default-client';
let currentUserId = 'default-user';
let isTrackingEnabled = true; // Flag to control change tracking during sync

// Symbol to mark sync transactions
export const SYNC_TRANSACTION = Symbol('sync-transaction');

// Track recent changes to prevent duplicates
const recentChanges = new Map<string, number>();
const DUPLICATE_WINDOW_MS = 1000; // 1 second window for duplicate detection

/**
 * Generate a client-side change sequence number
 * Note: This is NOT a PostgreSQL LSN, but a client-specific sequence
 * to track local changes before they get a server LSN
 */
function generateClientSequence(): string {
  // Use timestamp + random suffix for uniqueness
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Log a change outside the main transaction to avoid "object store not found" errors
 * Uses setTimeout to defer execution until after the current transaction completes
 * Includes duplicate detection to prevent multiple identical changes
 */
function logChange(changeRecord: Omit<LocalChanges, 'id'>, transaction?: any): void {
  // Skip if tracking is disabled (e.g., during initial/catchup sync)
  if (!isTrackingEnabled) {
    return;
  }
  
  // Skip if this is a sync transaction from the server
  if (transaction && (transaction as any)[SYNC_TRANSACTION]) {
    console.log(`[Dexie Change Tracking] Skipping change tracking for sync operation: ${changeRecord.table}`);
    return;
  }
  
  // Create a unique key for this change
  const changeKey = `${changeRecord.table}:${changeRecord.operation}:${JSON.stringify(changeRecord.data)}`;
  const now = Date.now();
  
  // Check for recent duplicate
  const lastChangeTime = recentChanges.get(changeKey);
  if (lastChangeTime && (now - lastChangeTime) < DUPLICATE_WINDOW_MS) {
    console.log(`[Dexie Change Tracking] Skipping duplicate change for ${changeRecord.table}`);
    return;
  }
  
  // Record this change timestamp
  recentChanges.set(changeKey, now);
  
  // Clean up old entries periodically
  if (recentChanges.size > 100) {
    const cutoff = now - DUPLICATE_WINDOW_MS;
    for (const [key, timestamp] of recentChanges.entries()) {
      if (timestamp < cutoff) {
        recentChanges.delete(key);
      }
    }
  }
  
  // Defer execution to after current transaction completes
  setTimeout(async () => {
    try {
      const record = {
        id: nanoid(),
        ...changeRecord
      };
      await db.local_changes.add(record);
      console.log(`[Dexie Change Tracking] Logged ${changeRecord.operation} for ${changeRecord.table}:`, record.id);
    } catch (error) {
      console.error('[Dexie Change Tracking] Failed to log change:', error);
    }
  }, 0);
}

// Tables to track for sync (exclude system tables)
const TRACKED_TABLES = [
  'tasks',
  'projects',
  'users',
  'comments',
  'status_definitions',
  'status_sets',
  'tags',
  'tag_sets'
] as const;

// Track if hooks have been initialized to prevent duplicates
let hooksInitialized = false;

/**
 * Initialize Dexie change tracking hooks
 * 
 * @param clientId - The client ID for this session
 * @param userId - The current user ID
 */
export function initializeDexieChangeTracking(clientId: string, userId: string) {
  console.log('[Dexie Change Tracking] Initializing hooks for client:', clientId);
  
  // Update global client and user IDs
  currentClientId = clientId;
  currentUserId = userId;
  
  // Prevent duplicate initialization
  if (hooksInitialized) {
    console.log('[Dexie Change Tracking] Hooks already initialized, skipping');
    return;
  }
  hooksInitialized = true;
  
  TRACKED_TABLES.forEach(tableName => {
    const table = db[tableName];
    if (!table) {
      console.warn(`[Dexie Change Tracking] Table ${tableName} not found`);
      return;
    }
    
    // Hook for tracking inserts
    table.hook('creating', function(primKey, obj, transaction) {
      // Skip sync transactions
      if ((transaction as any)[SYNC_TRANSACTION]) {
        return;
      }
      console.log(`[Dexie Change Tracking] Creating ${tableName} record:`, primKey);
      
      const changeRecord: Omit<LocalChanges, 'id'> = {
        table: tableName,
        operation: 'insert',
        data: { ...obj, id: primKey },
        lsn: generateClientSequence(),
        clientId: currentClientId,
        updatedAt: new Date(),
        processedSync: 0
      };
      
      // Log change asynchronously to avoid transaction conflicts
      logChange(changeRecord, transaction);
    });
    
    // Hook for tracking updates
    table.hook('updating', function(modifications, primKey, obj, transaction) {
      // Skip sync transactions
      if ((transaction as any)[SYNC_TRANSACTION]) {
        return;
      }
      console.log(`[Dexie Change Tracking] Updating ${tableName} record:`, primKey);
      
      const updatedData = { ...obj, ...modifications, id: primKey };
      
      const changeRecord: Omit<LocalChanges, 'id'> = {
        table: tableName,
        operation: 'update',
        data: updatedData,
        lsn: generateClientSequence(),
        clientId: currentClientId,
        updatedAt: new Date(),
        processedSync: 0
      };
      
      // Log change asynchronously to avoid transaction conflicts
      logChange(changeRecord, transaction);
    });
    
    // Hook for tracking deletes
    table.hook('deleting', function(primKey, obj, transaction) {
      // Skip sync transactions
      if ((transaction as any)[SYNC_TRANSACTION]) {
        return;
      }
      console.log(`[Dexie Change Tracking] Deleting ${tableName} record:`, primKey);
      
      const changeRecord: Omit<LocalChanges, 'id'> = {
        table: tableName,
        operation: 'delete',
        data: { ...obj, id: primKey },
        lsn: generateClientSequence(),
        clientId: currentClientId,
        updatedAt: new Date(),
        processedSync: 0
      };
      
      // Log change asynchronously to avoid transaction conflicts
      logChange(changeRecord, transaction);
    });
  });
  
  console.log('[Dexie Change Tracking] Hooks initialized for tables:', TRACKED_TABLES);
}

/**
 * Get pending changes that haven't been synced
 */
export async function getPendingChanges(limit = 100): Promise<LocalChanges[]> {
  return await db.local_changes
    .where('processedSync')
    .equals(0)
    .limit(limit)
    .toArray();
}

/**
 * Mark changes as processed
 */
export async function markChangesAsProcessed(changeIds: string[]): Promise<void> {
  console.log(`[Dexie Change Tracking] Marking ${changeIds.length} changes as processed:`, changeIds);
  
  const modifiedCount = await db.local_changes
    .where('id')
    .anyOf(changeIds)
    .modify({ processedSync: 1 });
    
  console.log(`[Dexie Change Tracking] Successfully marked ${modifiedCount} changes as processed`);
  
  // Debug: Check if changes were actually marked
  const stillPending = await db.local_changes
    .where('id')
    .anyOf(changeIds)
    .and(change => change.processedSync === 0)
    .count();
    
  if (stillPending > 0) {
    console.warn(`[Dexie Change Tracking] Warning: ${stillPending} changes were not marked as processed`);
  }
}

/**
 * Clear old processed changes (housekeeping)
 */
export async function clearProcessedChanges(olderThanMs = 24 * 60 * 60 * 1000): Promise<void> {
  const cutoffTime = new Date(Date.now() - olderThanMs);
  
  await db.local_changes
    .where('processedSync')
    .equals(1)
    .and(change => change.updatedAt < cutoffTime)
    .delete();
}

/**
 * Get change count for monitoring
 */
export async function getPendingChangeCount(): Promise<number> {
  return await db.local_changes
    .where('processedSync')
    .equals(0)
    .count();
}

/**
 * Debug: Get all changes for inspection
 */
export async function getAllChanges(): Promise<LocalChanges[]> {
  return await db.local_changes.toArray();
}

/**
 * Disable change tracking (used during initial and catchup sync)
 */
export function disableChangeTracking(): void {
  console.log('[Dexie Change Tracking] Disabling change tracking');
  isTrackingEnabled = false;
}

/**
 * Enable change tracking (used after sync completes)
 */
export function enableChangeTracking(): void {
  console.log('[Dexie Change Tracking] Enabling change tracking');
  isTrackingEnabled = true;
}

/**
 * Apply sync changes without triggering change tracking
 * This should be used by IncomingChangeService for server data
 */
export async function applySyncChanges(operation: () => Promise<void>): Promise<void> {
  const { db } = await import('@repo/dataforge/dexie-schema');
  
  // Run the operation in a transaction marked as sync
  await db.transaction('rw', db.tasks, db.projects, db.users, db.comments, 
    db.status_definitions, db.status_sets, db.tags, db.tag_sets, async (trans) => {
    // Mark this transaction as a sync operation
    (trans as any)[SYNC_TRANSACTION] = true;
    
    // Execute the operation within the marked transaction
    await operation();
  });
}