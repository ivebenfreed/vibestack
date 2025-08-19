/**
 * Dexie Storage Utilities
 * 
 * This file provides Dexie-based utility functions for database operations,
 * replacing the PGLite-based storage utilities with Dexie equivalents.
 */

import { db, CLIENT_DOMAIN_TABLES, ENTITY_TABLES, JUNCTION_TABLES, SYSTEM_TABLES } from './dexie-schema';
import type { Table } from 'dexie';

/**
 * Get database statistics for all domain tables
 */
export async function getDatabaseStats(): Promise<Record<string, number>> {
  try {
    const stats: Record<string, number> = {};
    let total = 0;
    
    // Count records in each domain table (CLIENT_DOMAIN_TABLES are the camelCase Dexie table names)
    for (const tableName of CLIENT_DOMAIN_TABLES) {
      const table = db[tableName] as Table;
      if (table) {
        const count = await table.count();
        stats[tableName] = count;
        total += count;
      }
    }
    
    stats.total = total;
    return stats;
  } catch (error) {
    console.error('Error getting database stats:', error);
    // Return zero stats for all tables
    const emptyStats: Record<string, number> = { total: 0 };
    for (const tableName of CLIENT_DOMAIN_TABLES) {
      emptyStats[tableName] = 0;
    }
    return emptyStats;
  }
}

/**
 * Clear only domain data tables, preserving system tables and sync metadata
 * This is the preferred method for integrity resets to maintain sync state
 */
export async function clearDomainDataOnly(): Promise<boolean> {
  try {
    console.log('[Dexie Storage] Clearing domain data only (preserving system tables)...');
    
    // Clear junction tables first (due to foreign key relationships)
    console.log('[Dexie Storage] Clearing junction tables:', JUNCTION_TABLES);
    for (const tableName of JUNCTION_TABLES) {
      const table = db[tableName] as Table;
      if (table) {
        await table.clear();
        console.log(`[Dexie Storage] Cleared junction table: ${tableName}`);
      }
    }
    
    // Then clear domain tables (CLIENT_DOMAIN_TABLES excludes system tables)
    console.log('[Dexie Storage] Clearing domain tables:', CLIENT_DOMAIN_TABLES);
    for (const tableName of CLIENT_DOMAIN_TABLES) {
      const table = db[tableName] as Table;
      if (table) {
        await table.clear();
        console.log(`[Dexie Storage] Cleared domain table: ${tableName}`);
      }
    }
    
    // System tables are preserved (dynamically from dataforge)
    console.log('[Dexie Storage] System tables preserved:', SYSTEM_TABLES);
    console.log('[Dexie Storage] Domain data cleared successfully while preserving system tables');
    return true;
  } catch (error) {
    console.error('[Dexie Storage] Error clearing domain data:', error);
    return false;
  }
}

/**
 * Clear all data from the database (including system tables)
 */
export async function clearAllData(): Promise<boolean> {
  try {
    console.log('[Dexie Storage] Clearing all data...');
    
    // Clear all tables including system tables
    // ENTITY_TABLES includes all tables (domain + system)
    const allTables = [...JUNCTION_TABLES, ...ENTITY_TABLES];
    
    for (const tableName of allTables) {
      const table = db[tableName] as Table;
      if (table) {
        await table.clear();
        console.log(`[Dexie Storage] Cleared table: ${tableName}`);
      }
    }
    
    console.log('[Dexie Storage] All data cleared successfully');
    return true;
  } catch (error) {
    console.error('[Dexie Storage] Error clearing all data:', error);
    return false;
  }
}

/**
 * Reset the database by clearing all data and reinitializing
 */
export async function resetDatabase(): Promise<boolean> {
  try {
    console.log('[Dexie Storage] Resetting database...');
    
    // Delete the entire database
    await db.delete();
    
    // Reopen the database (will reinitialize with schema)
    await db.open();
    
    console.log('[Dexie Storage] Database reset successfully');
    return true;
  } catch (error) {
    console.error('[Dexie Storage] Error resetting database:', error);
    return false;
  }
}

/**
 * Get count of records in a specific table
 */
export async function getTableCount(tableName: string): Promise<number> {
  try {
    const table = db[tableName] as Table;
    if (!table) {
      console.warn(`[Dexie Storage] Table not found: ${tableName}`);
      return 0;
    }
    return await table.count();
  } catch (error) {
    console.error(`[Dexie Storage] Error getting count for ${tableName}:`, error);
    return 0;
  }
}

/**
 * Check if database is empty (no domain data)
 */
export async function isDatabaseEmpty(): Promise<boolean> {
  try {
    for (const tableName of CLIENT_DOMAIN_TABLES) {
      const table = db[tableName] as Table;
      if (table) {
        const count = await table.count();
        if (count > 0) {
          return false;
        }
      }
    }
    return true;
  } catch (error) {
    console.error('[Dexie Storage] Error checking if database is empty:', error);
    return false;
  }
}

/**
 * Get detailed table statistics including system tables
 */
export async function getDetailedDatabaseStats(): Promise<{
  domain: Record<string, number>;
  system: Record<string, number>;
  junction: Record<string, number>;
  total: number;
}> {
  try {
    const stats = {
      domain: {} as Record<string, number>,
      system: {} as Record<string, number>,
      junction: {} as Record<string, number>,
      total: 0
    };
    
    // System tables from dataforge generation
    const systemTables = SYSTEM_TABLES;
    
    // Count domain tables
    for (const tableName of CLIENT_DOMAIN_TABLES) {
      const table = db[tableName] as Table;
      if (table) {
        const count = await table.count();
        stats.domain[tableName] = count;
        stats.total += count;
      }
    }
    
    // Count system tables
    for (const tableName of systemTables) {
      const table = db[tableName] as Table;
      if (table) {
        const count = await table.count();
        stats.system[tableName] = count;
        stats.total += count;
      }
    }
    
    // Count junction tables
    for (const tableName of JUNCTION_TABLES) {
      const table = db[tableName] as Table;
      if (table) {
        const count = await table.count();
        stats.junction[tableName] = count;
        stats.total += count;
      }
    }
    
    return stats;
  } catch (error) {
    console.error('[Dexie Storage] Error getting detailed database stats:', error);
    return {
      domain: {},
      system: {},
      junction: {},
      total: 0
    };
  }
}