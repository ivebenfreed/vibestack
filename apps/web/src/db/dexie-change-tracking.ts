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

// Callback for when changes are tracked
let onChangeTrackedCallback: (() => void) | null = null;

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
 * IMPORTANT: This function is now DISABLED. 
 * We use manual tracking in the domain layer instead of hooks.
 * Hooks should only be used for UI reactivity, not sync tracking.
 * 
 * @param clientId - The client ID for this session
 * @param userId - The current user ID
 */
export function initializeDexieChangeTracking(clientId: string, userId: string) {
  console.log('[Dexie Change Tracking] DISABLED - Using manual tracking in domain layer instead');
  
  // Update global client and user IDs (still needed for manual tracking)
  currentClientId = clientId;
  currentUserId = userId;
  
  // DO NOT INITIALIZE HOOKS - we track changes manually in the domain layer
  return;
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
  const changeKey = `${table}:${operation}:${data.id || JSON.stringify(data)}`;
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
    
    // Notify that a change was tracked
    if (onChangeTrackedCallback) {
      onChangeTrackedCallback();
    }
  } catch (error) {
    console.error('[Dexie Change Tracking] Failed to track change:', error);
  }
}

/**
 * Apply sync changes without triggering change tracking
 * This should be used by IncomingChangeService for server data
 * 
 * Note: With manual tracking, this is now just a regular Dexie operation
 * since hooks are disabled. Kept for compatibility.
 */
export async function applySyncChanges(operation: () => Promise<void>): Promise<void> {
  // Just run the operation directly since hooks are disabled
  await operation();
}

/**
 * Set callback to be notified when changes are tracked
 */
export function setOnChangeTrackedCallback(callback: (() => void) | null): void {
  onChangeTrackedCallback = callback;
}