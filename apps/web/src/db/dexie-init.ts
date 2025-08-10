/**
 * Dexie Database Initialization
 * 
 * Simple initialization for Dexie database that replaces PGLite.
 * Dexie opens automatically on first use, but we ensure it's ready
 * and dispatch events for the app-init-machine.
 */

import { db } from '@repo/dataforge/dexie-schema';
import Dexie from 'dexie';

/**
 * Initialize Dexie database
 * Dispatches events for XState app-init-machine coordination
 */
export async function initializeDexieDatabase(): Promise<void> {
  try {
    console.log('[Dexie Init] Starting database initialization...');
    const startTime = performance.now();
    
    // Try to open the database, handle schema conflicts
    try {
      await db.open();
    } catch (error) {
      // Check if it's an UpgradeError (schema conflict)
      if (error instanceof Dexie.UpgradeError || error?.name === 'UpgradeError') {
        console.warn('[Dexie Init] Schema upgrade error detected, resetting database...', error.message);
        
        // Delete the entire database
        await db.delete();
        console.log('[Dexie Init] Database deleted');
        
        // Try to open again with fresh schema
        await db.open();
        console.log('[Dexie Init] Database recreated with new schema');
      } else {
        // Re-throw other errors
        throw error;
      }
    }
    
    // Verify database is ready
    const version = db.verno;
    console.log(`[Dexie Init] Database opened successfully. Version: ${version}`);
    
    // Initialize change tracking hooks
    // The clientId doesn't matter here - it will be overridden by DexieOutgoingChangeService
    // which gets the correct clientId from the sync machine context
    const clientId = 'dexie-client-temp';
    const userId = 'current-user';
    
    const { initializeDexieChangeTracking } = await import('./dexie-change-tracking');
    initializeDexieChangeTracking(clientId, userId);
    console.log('[Dexie Init] Change tracking hooks initialized');
    
    // Quick health check - count some tables
    const [taskCount, userCount] = await Promise.all([
      db.tasks.count(),
      db.users.count()
    ]);
    
    const endTime = performance.now();
    console.log(`[Dexie Init] Database ready in ${endTime - startTime}ms`);
    console.log(`[Dexie Init] Current data: ${taskCount} tasks, ${userCount} users`);
    
    // Expose database to window for testing
    if (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test') {
      (window as any).db = db;
      console.log('[Dexie Init] Database exposed to window.db for testing');
    }
    
    // Dispatch success event for XState
    window.dispatchEvent(new CustomEvent('database:ready', { 
      detail: { 
        success: true, 
        initTime: endTime - startTime,
        version,
        counts: { tasks: taskCount, users: userCount }
      } 
    }));
    
  } catch (error) {
    console.error('[Dexie Init] Database initialization failed:', error);
    
    // Special handling for SchemaError (e.g., KeyPath not indexed)
    if (error instanceof Dexie.SchemaError || error?.name === 'SchemaError') {
      console.warn('[Dexie Init] Schema error detected, attempting database reset...', error.message);
      
      try {
        // Delete and recreate database for schema errors
        await db.delete();
        await db.open();
        console.log('[Dexie Init] Database reset successful after schema error');
        
        // Expose database to window for testing after recovery
        if (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test') {
          (window as any).db = db;
          console.log('[Dexie Init] Database exposed to window.db for testing (after recovery)');
        }
        
        // Dispatch success after recovery
        window.dispatchEvent(new CustomEvent('database:ready', { 
          detail: { 
            success: true, 
            recovered: true,
            version: db.verno
          } 
        }));
        return;
      } catch (resetError) {
        console.error('[Dexie Init] Failed to reset database:', resetError);
      }
    }
    
    // Dispatch error event for XState
    window.dispatchEvent(new CustomEvent('database:error', { 
      detail: { 
        error: error instanceof Error ? error.message : 'Database initialization failed'
      } 
    }));
    
    throw error;
  }
}

/**
 * Handle database check events from XState
 * This is called when app-init-machine wants to check if DB is already ready
 */
export function setupDexieDatabaseListeners(): void {
  const handleDatabaseCheck = async () => {
    if (db.isOpen()) {
      console.log('[Dexie Init] Database check - already open, notifying');
      window.dispatchEvent(new CustomEvent('database:ready', { 
        detail: { 
          success: true, 
          alreadyReady: true,
          version: db.verno
        } 
      }));
    } else {
      console.log('[Dexie Init] Database check - not yet open');
    }
  };
  
  window.addEventListener('database:check', handleDatabaseCheck);
  
  // Cleanup function
  return () => {
    window.removeEventListener('database:check', handleDatabaseCheck);
  };
}

/**
 * Close database (for cleanup/testing)
 */
export async function closeDexieDatabase(): Promise<void> {
  if (db.isOpen()) {
    await db.close();
    console.log('[Dexie Init] Database closed');
  }
}

/**
 * Clear all data (for testing/reset)
 */
export async function clearAllDexieData(): Promise<void> {
  console.log('[Dexie Init] Clearing all data...');
  
  // Clear all tables
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map(table => table.clear()));
  });
  
  console.log('[Dexie Init] All data cleared');
}

/**
 * Force reset database (delete and recreate)
 * This is useful when encountering persistent schema issues
 */
export async function forceResetDatabase(): Promise<void> {
  console.log('[Dexie Init] Force resetting database...');
  
  try {
    // Close if open
    if (db.isOpen()) {
      db.close();
    }
    
    // Delete the entire database
    await db.delete();
    console.log('[Dexie Init] Database deleted');
    
    // Reopen with fresh schema
    await db.open();
    console.log('[Dexie Init] Database recreated successfully');
    
    // Re-initialize change tracking
    const clientId = 'dexie-client-temp';
    const userId = 'current-user';
    const { initializeDexieChangeTracking } = await import('./dexie-change-tracking');
    initializeDexieChangeTracking(clientId, userId);
    
    // Expose database to window for testing after force reset
    if (import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test') {
      (window as any).db = db;
      console.log('[Dexie Init] Database exposed to window.db for testing (after force reset)');
    }
    
    // Dispatch ready event
    window.dispatchEvent(new CustomEvent('database:ready', { 
      detail: { 
        success: true, 
        reset: true,
        version: db.verno
      } 
    }));
    
    return;
  } catch (error) {
    console.error('[Dexie Init] Force reset failed:', error);
    throw error;
  }
}

/**
 * Get database status
 */
export function getDexieStatus() {
  return {
    isOpen: db.isOpen(),
    version: db.verno,
    name: db.name,
    tables: db.tables.map(t => t.name)
  };
}