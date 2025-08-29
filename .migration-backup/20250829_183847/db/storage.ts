/**
 * Database Storage Utilities
 * 
 * This file provides utility functions for database operations.
 */

import { getDatabase, clearDatabaseStorage, Results } from './db';
import { CLIENT_DOMAIN_TABLES, CLIENT_DOMAIN_TABLE_HIERARCHY, CLIENT_JUNCTION_TABLES } from './client-entities';

/**
 * Entity configuration for database operations
 * This centralizes entity definitions and can be easily extended
 */
const ENTITY_CONFIG = {
  // Core entities from centralized dataforge configuration (without quotes)
  get entities() {
    return CLIENT_DOMAIN_TABLES.map(table => table.replace(/"/g, ''));
  },
  
  // System tables that should be handled separately
  systemTables: ['local_changes'] as const,
  
  // Junction/relationship tables from centralized dataforge configuration (without quotes)
  get junctionTables() {
    return CLIENT_JUNCTION_TABLES.map(table => table.replace(/"/g, ''));
  },
  
  // Known enum types
  enumTypes: [
    'tasks_status_enum', 
    'tasks_priority_enum',
    'users_role_enum',
    'projects_status_enum'
  ] as const,
  
  // Deletion order (reverse dependency order using centralized hierarchy)
  get deletionOrder() {
    // Sort entities by hierarchy level (highest level first for deletion)
    const sortedEntities = this.entities.sort((a, b) => {
      const levelA = CLIENT_DOMAIN_TABLE_HIERARCHY[`"${a}"` as keyof typeof CLIENT_DOMAIN_TABLE_HIERARCHY] || 0;
      const levelB = CLIENT_DOMAIN_TABLE_HIERARCHY[`"${b}"` as keyof typeof CLIENT_DOMAIN_TABLE_HIERARCHY] || 0;
      return levelB - levelA; // Sort descending (highest level first)
    });
    
    return [...this.junctionTables, ...sortedEntities, ...this.systemTables];
  },
  
  // All known tables
  get allTables() {
    return [...this.entities, ...this.systemTables, ...this.junctionTables];
  }
} as const;

type EntityName = string;

/**
 * Reset the database by clearing all data
 */
export async function resetDatabase(): Promise<boolean> {
  try {
    console.log('Resetting database...');
    const result = await clearDatabaseStorage();
    console.log('Database reset result:', result);
    return result;
  } catch (error) {
    console.error('Error resetting database:', error);
    return false;
  }
}

/**
 * Alternative name for resetDatabase
 */
export const resetDB = resetDatabase;

/**
 * Get database statistics for all configured entities
 */
export async function getDatabaseStats(): Promise<Record<string, number>> {
  try {
    const db = await getDatabase();
    
    // Get table counts for all entities
    const stats: Record<string, number> = {};
    let total = 0;
    
    for (const entityName of ENTITY_CONFIG.entities) {
      const count = await getTableCount(db, entityName);
      stats[entityName] = count;
      total += count;
    }
    
    stats.total = total;
    return stats;
  } catch (error) {
    console.error('Error getting database stats:', error);
    // Return zero stats for all entities
    const emptyStats: Record<string, number> = { total: 0 };
    for (const entityName of ENTITY_CONFIG.entities) {
      emptyStats[entityName] = 0;
    }
    return emptyStats;
  }
}

/**
 * Helper to get count of records in a table
 */
async function getTableCount(db: any, tableName: string): Promise<number> {
  try {
    const result = await db.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    // Handle PGlite results type properly
    const resultArray = result as unknown as Array<{count: number}>;
    return resultArray[0]?.count || 0;
  } catch (error) {
    console.error(`Error getting count for ${tableName}:`, error);
    return 0;
  }
}

/**
 * Load data from server
 */
export async function loadServerData(endpoint: string): Promise<any> {
  try {
    console.log(`Loading data from server: ${endpoint}`);
    const response = await fetch(`/api/${endpoint}`, {
      credentials: 'include' // Include session cookies for authentication
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error loading server data:', error);
    throw error;
  }
}

/**
 * Clear all data from the database
 */
export async function clearAllData(): Promise<boolean> {
  try {
    console.log('Clearing all data...');
    
    // Option 1: Full database storage reset (more reliable, prevents stale data issues)
    // This is a more thorough approach that will prevent sleep-related issues
    const success = await clearDatabaseStorage();
    
    // After clearing storage, the database will be reinitialized on next access
    // This ensures we have a clean slate
    
    console.log('All data cleared successfully through complete storage reset');
    return success;
  } catch (error) {
    console.error('Error clearing data:', error);
    return false;
  }
}

/**
 * Alternative method that only clears table data but keeps schema
 * This is less reliable after system sleep but preserves table structure
 */
export async function clearAllDataKeepSchema(): Promise<boolean> {
  try {
    console.log('Clearing all data but keeping schema...');
    const db = await getDatabase();
    
    // Delete all data from tables in proper deletion order
    for (const tableName of ENTITY_CONFIG.deletionOrder) {
      try {
        await db.query(`DELETE FROM ${tableName}`);
        console.log(`Cleared data from ${tableName}`);
      } catch (error) {
        console.warn(`Warning: Could not clear ${tableName}:`, error);
      }
    }
    
    // Force commit changes to IndexedDB to avoid sleep-related issues
    try {
      await db.query('COMMIT;');
    } catch (commitError) {
      console.warn('Explicit commit failed (this may be normal):', commitError);
    }
    
    console.log('All data cleared successfully while preserving schema');
    return true;
  } catch (error) {
    console.error('Error clearing data:', error);
    return false;
  }
}

/**
 * Clear only domain data tables, preserving system tables and sync metadata
 * This is the preferred method for integrity resets to maintain sync state
 */
export async function clearDomainDataOnly(): Promise<boolean> {
  try {
    console.log('Clearing domain data only (preserving system tables)...');
    const db = await getDatabase();
    
    // Get domain deletion order (entities + junction tables, but NOT system tables)
    const domainTables = [...ENTITY_CONFIG.junctionTables, ...ENTITY_CONFIG.entities];
    
    // Sort domain entities by hierarchy for proper deletion order
    const sortedDomainEntities = ENTITY_CONFIG.entities.sort((a, b) => {
      const levelA = CLIENT_DOMAIN_TABLE_HIERARCHY[`"${a}"` as keyof typeof CLIENT_DOMAIN_TABLE_HIERARCHY] || 0;
      const levelB = CLIENT_DOMAIN_TABLE_HIERARCHY[`"${b}"` as keyof typeof CLIENT_DOMAIN_TABLE_HIERARCHY] || 0;
      return levelB - levelA; // Sort descending (highest level first)
    });
    
    const domainDeletionOrder = [...ENTITY_CONFIG.junctionTables, ...sortedDomainEntities];
    
    console.log('Domain tables to clear:', domainDeletionOrder);
    console.log('System tables preserved:', ENTITY_CONFIG.systemTables);
    
    // Delete data from domain tables only
    for (const tableName of domainDeletionOrder) {
      try {
        await db.query(`DELETE FROM ${tableName}`);
        console.log(`Cleared domain data from ${tableName}`);
      } catch (error) {
        console.warn(`Warning: Could not clear domain table ${tableName}:`, error);
      }
    }
    
    // Force commit changes to IndexedDB to avoid sleep-related issues
    try {
      await db.query('COMMIT;');
    } catch (commitError) {
      console.warn('Explicit commit failed (this may be normal):', commitError);
    }
    
    console.log('Domain data cleared successfully while preserving system tables');
    return true;
  } catch (error) {
    console.error('Error clearing domain data:', error);
    return false;
  }
}

/**
 * Drop all tables and types for a clean database state
 */
export async function dropAllTables(): Promise<boolean> {
  try {
    console.log('Dropping all tables and types with CASCADE...');
    const db = await getDatabase();

    // First, try to get all tables from the database dynamically
    try {
      console.log('Fetching all existing tables...');
      const tableResult = await db.query<{tablename: string}>(`
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public'
      `);
      
      if (tableResult.rows.length > 0) {
        console.log(`Found ${tableResult.rows.length} tables to drop`);
        
        // Drop all tables found in the database
        for (const row of tableResult.rows) {
          try {
            await db.query(`DROP TABLE IF EXISTS "${row.tablename}" CASCADE`);
            console.log(`Dropped table: ${row.tablename}`);
          } catch (dropError) {
            console.warn(`Warning: Could not drop table ${row.tablename}:`, dropError);
          }
        }
      }
    } catch (tableError) {
      console.warn('Error fetching tables dynamically:', tableError);
    }

    // Then, try to get all custom types from the database dynamically
    try {
      console.log('Fetching all existing enum types...');
      const typeResult = await db.query<{typname: string}>(`
        SELECT typname FROM pg_type 
        JOIN pg_catalog.pg_namespace ON pg_namespace.oid = pg_type.typnamespace
        WHERE typtype = 'e' AND nspname = 'public'
      `);
      
      if (typeResult.rows.length > 0) {
        console.log(`Found ${typeResult.rows.length} enum types to drop`);
        
        // Drop all types found in the database
        for (const row of typeResult.rows) {
          try {
            await db.query(`DROP TYPE IF EXISTS "public"."${row.typname}" CASCADE`);
            console.log(`Dropped enum type: ${row.typname}`);
          } catch (dropError) {
            console.warn(`Warning: Could not drop type ${row.typname}:`, dropError);
          }
        }
      }
    } catch (typeError) {
      console.warn('Error fetching enum types dynamically:', typeError);
    }

    // As a fallback, manually drop known tables using configuration
    console.log('Dropping known tables as fallback...');
    for (const table of ENTITY_CONFIG.allTables) {
      try {
        await db.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
      } catch (error) {
        console.warn(`Warning: Could not drop table ${table}:`, error);
      }
    }

    // As a fallback, manually drop known types using configuration
    console.log('Dropping known enum types as fallback...');
    for (const type of ENTITY_CONFIG.enumTypes) {
      try {
        await db.query(`DROP TYPE IF EXISTS "public"."${type}" CASCADE`);
      } catch (error) {
        console.warn(`Warning: Could not drop type ${type}:`, error);
      }
    }

    console.log('All tables and custom types dropped successfully');
    return true;
  } catch (error) {
    console.error('Error in dropAllTables():', error);
    return false;
  }
}

/**
 * Reset the entire database schema and data
 * This is a more complete reset than just dropping tables
 */
export async function resetEntireDatabase(): Promise<boolean> {
  try {
    console.log('Performing complete database reset...');
    const db = await getDatabase();
    
    // First drop all tables and types
    const dropResult = await dropAllTables();
    if (!dropResult) {
      console.error('Failed to drop tables, continuing with reset attempt...');
    }
    
    // For a truly clean slate, also truncate migration tracking tables
    try {
      // Ensure these tables don't exist or are empty
      await db.query('DROP TABLE IF EXISTS schema_version CASCADE');
      await db.query('DROP TABLE IF EXISTS client_migration_status CASCADE');
    } catch (truncateError) {
      console.warn('Error clearing migration tables:', truncateError);
    }
    
    console.log('Database schema completely reset, migrations will run from scratch');
    return true;
  } catch (error) {
    console.error('Error resetting entire database:', error);
    return false;
  }
}

/**
 * Get the list of configured entity names
 */
export function getConfiguredEntities(): readonly EntityName[] {
  return ENTITY_CONFIG.entities;
}

/**
 * Check if a table name is a configured entity
 */
export function isConfiguredEntity(tableName: string): tableName is EntityName {
  return ENTITY_CONFIG.entities.includes(tableName as EntityName);
} 