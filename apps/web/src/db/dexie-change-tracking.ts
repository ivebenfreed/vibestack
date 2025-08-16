/**
 * Dexie Change Tracking Hooks
 * 
 * Automatically tracks all changes made to Dexie tables in the local_changes table
 * for outgoing sync. Uses Dexie's database hooks (not React hooks) to intercept
 * create, update, and delete operations.
 */

import { db } from './dexie-schema';
import { nanoid } from 'nanoid';
import type { LocalChanges } from './client-entities';

let currentClientId = 'default-client';
let currentUserId = 'default-user';
let isTrackingEnabled = true; // Flag to control change tracking during sync

// Direct processor for when changes are tracked
let changeProcessor: (() => void) | null = null;

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
    // Skip change tracking for sync operation
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
      
      // Trigger change processor to handle the new change
      if (changeProcessor) {
        changeProcessor();
      }
    } catch (error) {
      console.error('[Dexie Change Tracking] Failed to log change:', error);
    }
  }, 0);
}

// Tables to track for sync (exclude system tables and tables that don't exist)
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
 * Initialize Dexie change tracking hooks with automatic transaction context detection
 * 
 * This replaces manual tracking with automatic hooks that detect sync transactions
 * and only track user-initiated changes. Uses Dexie's transaction context to avoid
 * race conditions and ensures thread-safe operation.
 * 
 * @param clientId - The client ID for this session
 * @param userId - The current user ID
 */
export function initializeDexieChangeTracking(clientId: string, userId: string) {
  // Initialize automatic change tracking
  
  // Update global client and user IDs
  currentClientId = clientId;
  currentUserId = userId;
  
  // Skip if already initialized to prevent duplicate hooks
  if (hooksInitialized) {
    console.log('[Dexie Change Tracking] Hooks already initialized, skipping');
    return;
  }
  
  // Try to initialize hooks safely
  try {
    // db is already imported at the top of this file
    if (!db) {
      console.warn('[Dexie Change Tracking] Database not available, skipping hook initialization');
      return;
    }
    
    // Initialize hooks for all tracked tables
    TRACKED_TABLES.forEach(tableName => {
      const table = (db as any)[tableName];
      if (!table) {
        console.warn(`[Dexie Change Tracking] Table ${tableName} not found in db, skipping hooks`);
        return;
      }
      
      try {
        // Hook: Track creates
        table.hook('creating', function (primKey: string, obj: any, trans: any) {
          // Use transaction context instead of global flag
          const isSyncTransaction = trans && trans[SYNC_TRANSACTION];
          
          // DEBUG: Log all hook calls to identify sync loop
          console.log(`[Dexie Hook Debug] Creating ${tableName}:`, {
            hasTrans: !!trans,
            hasFlag: !!trans?.[SYNC_TRANSACTION],
            isSyncTransaction,
            isTrackingEnabled,
            willTrack: !isSyncTransaction && isTrackingEnabled,
            entityId: obj?.id?.substring(0, 8) || 'unknown'
          });
          
          if (!isSyncTransaction && isTrackingEnabled) {
            console.log(`[Dexie Hook Debug] 🚨 TRACKING SYNC CHANGE! This should not happen!`);
            logChange({
              table: tableName,
              operation: 'insert',
              data: obj,
              lsn: '',
              clientSequence: generateClientSequence(),
              clientId: currentClientId,
              updatedAt: new Date(),
              processedSync: 0
            }, trans);
          } else if (isSyncTransaction) {
            console.log(`[Dexie Hook Debug] ✅ Correctly skipping sync change for ${tableName}`);
          }
        });
        
        // Hook: Track updates  
        table.hook('updating', function (modifications: any, primKey: string, obj: any, trans: any) {
          const isSyncTransaction = trans && trans[SYNC_TRANSACTION];
          
          // DEBUG: Log all hook calls to identify sync loop
          console.log(`[Dexie Hook Debug] Updating ${tableName}:`, {
            hasTrans: !!trans,
            hasFlag: !!trans?.[SYNC_TRANSACTION],
            isSyncTransaction,
            isTrackingEnabled,
            willTrack: !isSyncTransaction && isTrackingEnabled,
            entityId: obj?.id?.substring(0, 8) || 'unknown'
          });
          
          if (!isSyncTransaction && isTrackingEnabled) {
            console.log(`[Dexie Hook Debug] 🚨 TRACKING SYNC UPDATE! This should not happen!`);
            // Merge current object with modifications to get full updated object
            const updatedObj = { ...obj, ...modifications };
            logChange({
              table: tableName,
              operation: 'update', 
              data: updatedObj,
              lsn: '',
              clientSequence: generateClientSequence(),
              clientId: currentClientId,
              updatedAt: new Date(),
              processedSync: 0
            }, trans);
          } else if (isSyncTransaction) {
            console.log(`[Dexie Hook Debug] ✅ Correctly skipping sync update for ${tableName}`);
          }
        });
        
        // Hook: Track deletes
        table.hook('deleting', function (primKey: string, obj: any, trans: any) {
          const isSyncTransaction = trans && trans[SYNC_TRANSACTION];
          if (!isSyncTransaction && isTrackingEnabled) {
            logChange({
              table: tableName,
              operation: 'delete',
              data: obj || { id: primKey }, // Ensure we have at least the ID
              lsn: '',
              clientSequence: generateClientSequence(),
              clientId: currentClientId,
              updatedAt: new Date(),
              processedSync: 0
            }, trans);
          }
        });
        
        console.log(`[Dexie Change Tracking] Initialized hooks for table: ${tableName}`);
      } catch (hookError) {
        console.error(`[Dexie Change Tracking] Failed to initialize hooks for ${tableName}:`, hookError);
      }
    });
  } catch (importError) {
    console.error('[Dexie Change Tracking] Failed to import database, hooks not initialized:', importError);
    return;
  }
  
  // Mark as initialized
  hooksInitialized = true;
  
  // Successfully initialized automatic tracking
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
  // Disable change tracking during sync
  isTrackingEnabled = false;
}

/**
 * Enable change tracking (used after sync completes)
 */
export function enableChangeTracking(): void {
  // Re-enable change tracking after sync
  isTrackingEnabled = true;
}

/**
 * Manually track a change for outgoing sync
 * This replaces the automatic hook-based tracking
 * 
 * @param table - The table name
 * @param operation - The operation type
 * @param data - The entity data
 */
export async function trackOutgoingChange(
  table: string,
  operation: 'insert' | 'update' | 'delete',
  data: any
): Promise<void> {
  // Skip if tracking is disabled (e.g., during initial/catchup sync)
  if (!isTrackingEnabled) {
    console.log(`[Dexie Change Tracking] Tracking disabled, skipping ${operation} for ${table}`);
    return;
  }
  
  // Create a unique key for duplicate detection
  // Use entity ID for updates/deletes, full data hash for inserts
  const changeKey = operation === 'insert' 
    ? `${table}:${operation}:${JSON.stringify(data)}`
    : `${table}:${operation}:${data.id}`;
  const now = Date.now();
  
  // Check for recent duplicate
  const lastChangeTime = recentChanges.get(changeKey);
  if (lastChangeTime && (now - lastChangeTime) < DUPLICATE_WINDOW_MS) {
    console.error(`[Dexie Change Tracking] DUPLICATE DETECTED - Skipping manual tracking for ${table}:${data.id}`, {
      timeSinceLastChange: now - lastChangeTime,
      duplicateWindow: DUPLICATE_WINDOW_MS,
      stack: new Error().stack
    });
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
  
  const changeRecord: LocalChanges = {
    id: nanoid(),
    table,
    operation,
    data,
    lsn: '', // Keep empty - LSN is only for server->client
    clientSequence: generateClientSequence(), // Use new field for client ordering
    clientId: currentClientId,
    updatedAt: new Date(),
    processedSync: 0
  };
  
  try {
    await db.local_changes.add(changeRecord);
    console.log(`[Dexie Change Tracking] Manually tracked ${operation} for ${table}:`, changeRecord.id, {
      entityId: data.id,
      stack: new Error().stack?.split('\n').slice(2, 5).join('\n')
    });
    
    // Process changes immediately after tracking
    if (changeProcessor) {
      changeProcessor();
    }
  } catch (error) {
    console.error('[Dexie Change Tracking] Failed to track change:', error);
  }
}

/**
 * Apply sync changes without triggering change tracking
 * This marks the transaction as a sync transaction so hooks don't track changes
 * 
 * @param operation - Database operation to run as a sync transaction
 */
export async function applySyncChanges(operation: () => Promise<void>): Promise<void> {
  // Import db from domain index to match app structure
  const { db } = await import('/src/domain/index.js');
  
  // If we can't get all tables, just run the operation without transaction
  // The hooks will handle the SYNC_TRANSACTION check
  try {
    await db.transaction('rw', Object.values(db.tables || {}), async (trans) => {
      // Mark this transaction as a sync transaction
      (trans as any)[SYNC_TRANSACTION] = true;
      
      // Run the operation
      await operation();
    });
  } catch (error) {
    console.warn('[Dexie Change Tracking] Failed to run sync transaction, running operation directly:', error);
    await operation();
  }
}

/**
 * Set the change processor function
 */
export function setChangeProcessor(processor: (() => void) | null): void {
  changeProcessor = processor;
}