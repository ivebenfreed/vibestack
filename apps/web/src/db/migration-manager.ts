/**
 * Migration Manager
 * 
 * This module provides functionality to check and apply database migrations
 * during application initialization. It compares server migrations with local
 * schema_version table and applies any missing migrations.
 */

// Remove static import
// import { getDatabase } from './db'; 
// @ts-ignore - Ignore potential type definition issue
import { PGliteWorker } from '@electric-sql/pglite/worker';
// Remove static import
// import { dbMessageBus } from './db'; 
import { getApiBaseUrl } from '@/sync/config';
import { dataLog } from '@/logger';
const log = dataLog('db/migration-manager.ts');

// Define migration interface to match server response
export interface Migration {
  migration_name: string;
  timestamp: string;
  schema_version?: string;
  up_queries: string[];
  down_queries: string[];
  client_applied?: boolean;
  created_at?: string;
}

/**
 * Check if the schema_version table exists
 * @param db Database instance
 * @returns Promise that resolves to true if the table exists
 */
export const checkMigrationTableExists = async (db: PGliteWorker): Promise<boolean> => {
  try {
    // Use PostgreSQL's information_schema instead of sqlite_master
    const result = await db.query(`
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'schema_version'
    `);
    
    // Correctly check the rows property of the PGliteWorker query result
    return result.rows.length > 0;
  } catch (error) {
    log.error('Error checking if migration table exists:', error);
    return false;
  }
};

/**
 * Get all applied migration names from the client database
 * @param db Database instance
 * @returns Promise that resolves to an array of migration names
 */
export const getAllAppliedMigrationNames = async (db: PGliteWorker): Promise<string[]> => {
  try {
    const result = await db.query<{ migration_name: string }>(`
      SELECT migration_name
      FROM schema_version
    `);
    return result.rows.map((row: { migration_name: string }) => row.migration_name);
  } catch (error) {
    // If the table doesn't exist yet, return empty array
    if (error instanceof Error && error.message.includes('relation "schema_version" does not exist')) {
      return [];
    }
    log.error('Error getting applied migration names:', error);
    // Re-throw other errors
    throw error; 
  }
};

/**
 * Fetch migrations from the server
 * @returns Promise that resolves to an array of migrations or null if fetch fails
 */
export const fetchMigrationsFromServer = async (): Promise<Migration[] | null> => {
  try {
    log.info('Fetching migrations from server...');
    
    // Get the API base URL
    const baseUrl = getApiBaseUrl();
    log.info(`API base URL: ${baseUrl}`);
    
    // Use a relative URL instead of a fully qualified URL
    // This lets the browser and Vite handle the proper URL construction
    const apiUrl = `/api/migrations`;
    
    log.info(`Fetching migrations using relative path: ${apiUrl}`);
    log.info(`Document location: ${window.location.href}`);
    log.info(`Cookie available: ${!!document.cookie}`);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      credentials: 'include',
      // Add a timeout to prevent hanging
      signal: AbortSignal.timeout(10000),
    });
    
    log.info(`Response status: ${response.status}`);
    log.info(`Response headers:`, Object.fromEntries([...response.headers.entries()]));
    
    if (!response.ok) {
      const errorText = await response.text();
      log.error(`Error response body:`, errorText);
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Handle different response formats
    let migrations: Migration[];
    
    if (data.success && Array.isArray(data.data)) {
      migrations = data.data;
    } else if (data.ok === true && Array.isArray(data.data)) {
      migrations = data.data;
    } else if (data.success && data.data && Array.isArray(data.data.migrations)) {
      migrations = data.data.migrations;
    } else if (Array.isArray(data.migrations)) {
      migrations = data.migrations;
    } else {
      throw new Error('Invalid migrations data format');
    }
    
    log.info(`Fetched ${migrations.length} migrations from server`);
    return migrations;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      log.warn('Migration fetch timed out');
    } else {
      log.error('Error fetching migrations from server:', error);
    }
    return null;
  }
};

/**
 * Apply migrations to the database
 * @param db Database instance
 * @param migrations Migrations to apply
 * @returns Promise that resolves to true if all migrations were applied successfully
 */
export const applyMigrations = async (db: PGliteWorker, migrations: Migration[]): Promise<boolean> => {
  if (migrations.length === 0) {
    log.info('No migrations to apply');
    return true;
  }
  
  log.info(`Applying ${migrations.length} total migrations checked against local state...`);
  
  try {
    // Ensure schema_version table exists first
    const hasTable = await checkMigrationTableExists(db);
    if (!hasTable) {
      log.info('Creating schema_version table...');
      // Use migration_name as PK
      await db.query(`
        CREATE TABLE schema_version (
          migration_name TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    // Get the names of already applied migrations
    const appliedNames = await getAllAppliedMigrationNames(db);
    const appliedSet = new Set(appliedNames);

    // Filter migrations that haven't been applied yet and sort them by timestamp
    const pendingMigrations = migrations
      .filter(m => !appliedSet.has(m.migration_name))
      .sort((a, b) => parseInt(a.timestamp, 10) - parseInt(b.timestamp, 10)); // Sort numerically
    
    if (pendingMigrations.length === 0) {
      log.info('All migrations already applied');
      return true;
    }
    
    log.info(`Applying ${pendingMigrations.length} pending migrations...`);
        
    // Apply each migration in order
    for (const migration of pendingMigrations) {
      log.info(`Applying migration: ${migration.migration_name}`);
      
      // Apply each query in the migration
      for (const sql of migration.up_queries) {
        try {
          await db.query(sql);
        } catch (error) {
          // Handle the case where a table already exists more gracefully
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          // Check if this is a "relation already exists" error or if dropping a constraint that doesn't exist
          if (errorMessage.includes('already exists')) {
            // Table or type already exists, log it but don't fail the migration
            log.warn(`Warning: Object already exists, continuing migration: ${sql.substring(0, 60)}...`);
            
            // If this is a CREATE TABLE statement, we can consider it "successful" and continue
            if (sql.toUpperCase().includes('CREATE TABLE') || sql.toUpperCase().includes('CREATE TYPE')) {
              log.info('CREATE statement skipped as object already exists');
              continue; // Skip to the next SQL statement
            }
          } 
          // Handle non-existent constraint or index errors
          else if (
            (errorMessage.includes('constraint') && errorMessage.includes('does not exist')) ||
            (errorMessage.includes('relation') && errorMessage.includes('does not exist')) ||
            (errorMessage.includes('index') && errorMessage.includes('does not exist'))
          ) {
            log.warn(`Warning: Constraint, relation, or index doesn't exist, continuing: ${sql.substring(0, 60)}...`);
            continue; // Skip to the next SQL statement
          }
          else {
            // For other errors, log and return false to indicate migration failure
            log.error(`Error executing migration query: ${sql}`, error);
            return false;
          }
        }
      }
      
      // Record the migration in schema_version using its name
      await db.query(
        `INSERT INTO schema_version (migration_name) VALUES ($1)`,
        [migration.migration_name] // Use migration_name
      );
      
      log.info(`Migration applied: ${migration.migration_name}`);
    }
    
    log.info('All migrations applied successfully');
    
    // Emit event for migration completion
    // Dynamically import dbMessageBus to avoid circular dependency
    const { dbMessageBus } = await import('./db.ts'); 

    dbMessageBus.publish('migrations:applied', { 
      count: pendingMigrations.length,
      lastMigration: pendingMigrations[pendingMigrations.length - 1].migration_name
    });
    
    return true;
  } catch (error) {
    log.error('Error applying migrations:', error);
    return false;
  }
};

/**
 * Check and apply migrations from the server
 * @returns Promise that resolves to true if migrations were checked and applied successfully
 */
export const checkAndApplyMigrations = async (): Promise<boolean> => {
  try {
    log.info('Checking for database migrations...');
    
    // Get database instance dynamically to avoid circular dependency
    const { getDatabase } = await import('./db.ts'); 
    const db = await getDatabase();
    
    // Fetch migrations from server
    const migrations = await fetchMigrationsFromServer();
    if (!migrations) {
      log.warn('Could not fetch migrations, skipping migration check');
      return false;
    }
    
    // Apply migrations
    const result = await applyMigrations(db, migrations);
    
    return result;
  } catch (error) {
    log.error('Error checking and applying migrations:', error);
    return false;
  }
}; 