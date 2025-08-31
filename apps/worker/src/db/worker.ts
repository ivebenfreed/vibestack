/**
 * PGlite Worker Implementation
 * 
 * This file provides the worker implementation for PGlite.
 */

import { PGlite } from '@electric-sql/pglite';
import { worker } from '@electric-sql/pglite/worker';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { live } from '@electric-sql/pglite/live';
import { IdbFs } from '@electric-sql/pglite';
import { dataLog } from '@/logger';
const log = dataLog('db/worker.ts');

// Database name for storage
// IMPORTANT: Must be kept in sync with DB_NAME in db.ts
const DB_NAME = 'vibestack-db';

// Configure the database with IndexedDB filesystem
// We're using IndexedDB for persistence across sessions
const config = {
  fs: new IdbFs(DB_NAME),
  extensions: { 
    uuid_ossp,
    // Register the live extension
    live
  },
  // 🔥 PERFORMANCE FIX: Optimize for better query performance
  relaxedDurability: true, // Re-enable for better performance, but handle errors gracefully
  // Increase cache size for better performance
  cacheSize: 8000,
  // Optimize shared memory and buffer settings
  sharedMemorySize: 4000000, // 4MB shared memory
  // Add better WAL configuration
  walMode: true,
  // Reduce fsync frequency to improve performance
  fsyncInterval: 10000 // Sync every 10 seconds instead of immediately
};

// Worker initialization
worker({
  async init() {
    log.info('🔄 Initializing PGlite worker with IndexedDB storage...');
    
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        // Create/open database with configuration
        log.info('🔄 Creating/opening database...');
        const db = await PGlite.create(config);
        
        // Create the uuid-ossp extension if needed
        log.info('🔄 Creating uuid-ossp extension...')
        await db.exec('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
        
        // Initialize live extension
        log.info('🔄 Initializing live extension...');
        if (db.live) {
          log.info('✅ Live extension initialized successfully');
        } else {
          log.warn('⚠️ Live extension not available');
        }
        
        log.info('✅ Database initialized successfully');
        return db;
        
      } catch (err: any) {
        retries++;
        log.error(`❌ Database initialization attempt ${retries} failed:`, err);
        
        // Handle specific PGlite/IndexedDB errors
        if (err.errno === 44 || err.name === 'ErrnoError') {
          log.warn(`⚠️ IndexedDB busy error (errno ${err.errno}), retrying in ${retries * 1000}ms...`);
          await new Promise(resolve => setTimeout(resolve, retries * 1000));
          continue;
        }
        
        // If we've exhausted retries or hit a different error, throw
        if (retries >= maxRetries) {
          log.error('❌ Failed to initialize database after max retries');
          throw err;
        }
      }
    }
    
    throw new Error('Database initialization failed after all retries');
  },
}); 