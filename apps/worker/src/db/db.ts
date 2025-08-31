/**
 * PGlite Database Implementation
 * 
 * This file provides the main database functionality for the application,
 * including database initialization, connection management, and core operations.
 */

import { PGlite } from '@electric-sql/pglite';
// Import PGliteWorker from the worker submodule again
// @ts-ignore - Ignore potential type definition issue
import { PGliteWorker } from '@electric-sql/pglite/worker';
// Import the worker script using Vite's ?worker syntax
import VibestackWorker from './worker.ts?worker';
import { resetEntireDatabase } from './storage';
// Import the live extension to pass to the worker constructor
import { live } from '@electric-sql/pglite/live';
// Remove unused/incorrect import
// import { VibestackWorker as VibestackWorkerImport } from './worker';
// Remove import for non-existent file
// import { validateDatabaseSchema } from './schema-validator';
import { checkAndApplyMigrations } from './migration-manager';
import { dataLog } from '@/logger';
const log = dataLog('db/db.ts');

// Export the database name as a constant for use in other modules
// IMPORTANT: Must match the value in worker.ts exactly 
export const DB_NAME = 'vibestack-db';

// Properly type PGlite results
// Based on PGlite's typical result structure
export interface Results<T = any> {
  rows: T[];
  // Include other potential properties if known, e.g., command, rowCount
  command?: string;
  rowCount?: number;
  // Add other fields as needed based on PGlite documentation or usage
}

// Export types (PGliteWithLive might need re-evaluation if direct access is removed)
// For now, we'll keep it, but interaction will primarily be via PGliteWorker
export interface PGliteWithLive extends PGlite {
  live: {
    query: (sql: string, params?: any[]) => Promise<{ 
      results: any[]; 
      unsubscribe: () => void 
    }>;
  };
}

// Event bus for database events
type EventCallback = (data: any) => void;
type EventsMap = Record<string, Set<EventCallback>>;

// Simple event bus for database events
export class DbMessageBus {
  private events: EventsMap = {};

  subscribe(event: string, callback: EventCallback): () => void {
    if (!this.events[event]) {
      this.events[event] = new Set();
    }
    this.events[event].add(callback);
    
    return () => this.unsubscribe(event, callback);
  }

  unsubscribe(event: string, callback: EventCallback): void {
    if (this.events[event]) {
      this.events[event].delete(callback);
    }
  }

  publish(event: string, data: any = {}): void {
    if (this.events[event]) {
      this.events[event].forEach(callback => callback(data));
    }
  }
}

// Create and export a single instance of the message bus
export const dbMessageBus = new DbMessageBus();

// Global database instances
let pgliteWorkerInstance: PGliteWorker | null = null;
let workerInstance: Worker | null = null; // Store the raw worker too
let isInitializing = false;
let initPromise: Promise<PGliteWorker> | null = null;

// HMR Persistence
// Store instances during HMR dispose
if (import.meta.hot) {
  import.meta.hot.dispose(async (data) => {
    log.info("🔥 [DB] HMR Dispose: Cleaning up database connections");
    log.info("🔥 [DB] pgliteWorkerInstance exists:", !!pgliteWorkerInstance);
    log.info("🔥 [DB] workerInstance exists:", !!workerInstance);
    log.info("🔥 [DB] isInitializing:", isInitializing);
    
    // 🔥 HMR FIX: Properly terminate worker to prevent IndexedDB conflicts
    if (workerInstance) {
      try {
        log.info("🔥 [DB] HMR: Terminating worker instance...");
        workerInstance.terminate();
        log.info("🔥 [DB] HMR: Worker terminated successfully");
      } catch (error) {
        log.warn("🔥 [DB] HMR: Error terminating worker:", error);
      }
    }
    
    if (pgliteWorkerInstance) {
      try {
        log.info("🔥 [DB] HMR: Closing PGlite worker connection...");
        // Close any open connections
        if (typeof pgliteWorkerInstance.close === 'function') {
          await pgliteWorkerInstance.close();
        }
        log.info("🔥 [DB] HMR: PGlite worker closed successfully");
      } catch (error) {
        log.warn("🔥 [DB] HMR: Error closing PGlite worker:", error);
      }
    }
    
    // Reset module state for clean restart
    pgliteWorkerInstance = null;
    workerInstance = null;
    isInitializing = false;
    initPromise = null;
    
    // Store cleanup timestamp
    data.timestamp = Date.now();
    data.cleanedUp = true;
    
    log.info("🔥 [DB] HMR: Database cleanup completed");
  });

  // Accept hot updates for this module
  import.meta.hot.accept();
}

/**
 * Get the database instance (PGliteWorker), creating it if necessary
 */
export async function getDatabase(): Promise<PGliteWorker> {
  if (pgliteWorkerInstance) {
    return pgliteWorkerInstance;
  }
  
  // If initialization is in progress, wait for it
  if (isInitializing && initPromise) {
    return initPromise;
  }

  // Start initialization if not already started
  return initializeDatabase();
}

/**
 * Short alias for the database instance (might be less useful now)
 */
export const db = pgliteWorkerInstance;

/**
 * Initialize the database using PGliteWorker
 */
export async function initializeDatabase(): Promise<PGliteWorker> {
  // 🔥 HMR CHANGE: No longer restore instances - always create fresh after cleanup
  if (import.meta.hot?.data.cleanedUp) {
    log.info("🔥 [DB] HMR: Previous instance was properly cleaned up, creating fresh instance");
  }

  if (pgliteWorkerInstance) {
    return pgliteWorkerInstance;
  }
  
  if (isInitializing) {
    log.info('PGliteWorker already initializing, waiting for completion');
    return initPromise!;
  }
  
  isInitializing = true;
  
  log.info('🔄 Initializing PGliteWorker...');
  
  initPromise = (async () => {
    try {
      // Create the worker instance using Vite's import
      const worker = new VibestackWorker();
      
      // Instantiate PGliteWorker, connecting it to the actual worker
      // Cast to any to bypass incorrect type definition
      const PGliteWorkerConstructor = PGliteWorker as any;
      const pgliteWorker = new PGliteWorkerConstructor(
        worker,
        { // Pass options to expose live extension
          extensions: {
            live,
          },
        }
      );
      
      // Optional: Add listener for debugging worker messages
      worker.addEventListener('message', (event: MessageEvent) => {
        // Avoid logging internal PGliteWorker protocol messages if too noisy
        if (!event.data?.type?.startsWith('pglite:')) {
           log.debug('PGlite worker message:', event.data);
        }
      });

      // Worker connection ready - no test needed
      
      // Live queries are configured and will be available when needed

      // Store both instances
      pgliteWorkerInstance = pgliteWorker;
      workerInstance = worker;
      
      // Remove database reset code that was only for debugging
      // await resetEntireDatabase();
      
      // ** Remove call to validateDatabaseSchema **
      // await validateDatabaseSchema(pgliteWorkerInstance);
      
      // Check and apply migrations
      log.info('🔍 [DB] Starting migration check...');
      await checkAndApplyMigrations();
      log.info('✅ [DB] Migration check complete');
      
      log.info('✅ PGliteWorker initialized successfully');
      dbMessageBus.publish('initialized', { success: true });
      
      return pgliteWorkerInstance;
    } catch (error) {
      log.error('❌ Error initializing PGliteWorker:', error);
      dbMessageBus.publish('error', { error });
      throw error;
    } finally {
      isInitializing = false;
    }
  })();
  
  return initPromise;
}

/**
 * Clear database storage (needs adaptation for worker)
 */
export async function clearDatabaseStorage(): Promise<boolean> {
  try {
    log.info('🗑️ Clearing PGlite database storage...');
    
    // Terminate current worker connection first
    if (pgliteWorkerInstance) {
      await terminateDatabase();
    }
    
    // Clearing IndexedDB remains the same as it's a browser API
    await clearIndexedDBStorage();
    
    log.info('✅ PGlite database storage cleared');
    return true;
  } catch (error) {
    log.error('❌ Error clearing PGlite database storage:', error);
    return false;
  }
}

/**
 * Helper to clear IndexedDB storage
 */
async function clearIndexedDBStorage(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Use the exported DB_NAME constant
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => {
        log.info(`Successfully deleted ${DB_NAME} database from IndexedDB`);
        resolve();
      };
      req.onerror = (event) => {
        log.error(`Error deleting ${DB_NAME} database:`, event);
        reject(new Error(`Failed to delete ${DB_NAME} database`));
      };
      req.onblocked = () => {
        log.warn(`Deletion of ${DB_NAME} database is blocked. Close other tabs/connections.`);
        // Potentially reject or wait, depending on desired behavior
        reject(new Error(`Deletion of ${DB_NAME} database is blocked`));
      }
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Terminate the database connection (now terminates the worker)
 */
export async function terminateDatabase(): Promise<void> {
  if (workerInstance) { // Check raw worker instance
    try {
      log.info('🛑 Terminating PGliteWorker connection...');
      workerInstance.terminate(); // Terminate the raw worker
      pgliteWorkerInstance = null;
      workerInstance = null; // Clear raw worker instance
      initPromise = null;
      isInitializing = false; // Reset initialization state
    } catch (error) {
      log.error('❌ Error terminating PGliteWorker:', error);
    }
  }
}

/**
 * Validate and create database schema if needed (adapted for PGliteWorker)
 * --- KEEP THIS FUNCTION DEFINITION EVEN IF UNUSED FOR NOW --- 
 */
export async function validateDatabaseSchema(dbWorker: PGliteWorker): Promise<void> {
  try {
    // Check if the schema version table exists using the worker
    const schemaVersionExists = await checkTableExists(dbWorker, 'schema_version');
    
    if (!schemaVersionExists) {
      log.info('Creating initial database schema via worker...');
      await createInitialSchema(dbWorker);
    } else {
      log.info('Database schema already exists (checked via worker)');
    }
  } catch (error) {
    log.error('Error validating database schema via worker:', error);
    throw error;
  }
}

/**
 * Check if a table exists in the database (adapted for PGliteWorker)
 */
async function checkTableExists(dbWorker: PGliteWorker, tableName: string): Promise<boolean> {
  try {
    // Use the worker's query method
    // Use PostgreSQL's information_schema instead of sqlite_master
    const result = await dbWorker.query<any[]>(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = $1
    `, [tableName]);
    
    return result.length > 0;
  } catch (error) {
    log.error('Error checking table existence:', error);
    return false;
  }
}

// --- KEEP createInitialSchema --- 
async function createInitialSchema(dbWorker: PGliteWorker): Promise<void> {
  // Implementation of createInitialSchema function
}

// ... (rest of file: getDatabaseStatus, assertDatabaseIsWorker, types, and final initializeDatabase() call) ...

// REMOVED: Module-level initialization call
// initializeDatabase().catch(error => {
//   log.error('Failed to initialize database at startup:', error);
// }); 