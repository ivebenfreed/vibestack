/**
 * Dexie Database Initialization
 * 
 * Simple initialization for Dexie database that replaces PGLite.
 * Dexie opens automatically on first use, but we ensure it's ready
 * and dispatch events for the app-init-machine.
 */

import { db } from '@repo/dataforge/dexie-schema';

/**
 * Initialize Dexie database
 * Dispatches events for XState app-init-machine coordination
 */
export async function initializeDexieDatabase(): Promise<void> {
  try {
    console.log('[Dexie Init] Starting database initialization...');
    const startTime = performance.now();
    
    // Dexie opens automatically on first use, but we can force it
    await db.open();
    
    // Verify database is ready
    const version = db.verno;
    console.log(`[Dexie Init] Database opened successfully. Version: ${version}`);
    
    // Quick health check - count some tables
    const [taskCount, userCount] = await Promise.all([
      db.tasks.count(),
      db.users.count()
    ]);
    
    const endTime = performance.now();
    console.log(`[Dexie Init] Database ready in ${endTime - startTime}ms`);
    console.log(`[Dexie Init] Current data: ${taskCount} tasks, ${userCount} users`);
    
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