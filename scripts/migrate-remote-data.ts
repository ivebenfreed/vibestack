#!/usr/bin/env tsx

/**
 * Graceful Data Migration Script
 * 
 * Migrates data from remote Neon database to local PostgreSQL,
 * handling schema mismatches by:
 * - Mapping column names (user_id -> account_id, etc.)
 * - Skipping non-existent tables
 * - Omitting non-existent fields
 * - Converting data types where needed
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { neon, neonConfig } from '@neondatabase/serverless';
import pkg from 'pg';
const { Client } = pkg;

// Load environment variables from the correct staging configuration
config({ path: resolve(process.cwd(), 'apps/server/.env.example') });

// Explicitly use the remote Neon database URL (overrides local env vars)
const REMOTE_DATABASE_URL = 'postgresql://neondb_owner:npg_N2CLXIVGK9Ra@ep-tight-forest-a4hnhb61-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

interface TableMapping {
  remoteTable: string;
  localTable: string;
  columnMappings: Record<string, string>;
  skipColumns?: string[];
  requiredColumns?: string[];
}

interface MigrationStats {
  tablesProcessed: number;
  tablesSkipped: number;
  totalRecords: number;
  errors: string[];
}

// Define table mappings between remote and local schemas
const TABLE_MAPPINGS: TableMapping[] = [
  {
    remoteTable: 'accounts',
    localTable: 'account',
    columnMappings: {
      'id': 'id',
      'user_id': 'user_id', // Keep as user_id, not account_id
      'provider_id': 'provider_id',
      'provider_account_id': 'provider_account_id',
      'access_token': 'access_token',
      'refresh_token': 'refresh_token',
      'expires_at': 'expires_at',
      'token_type': 'token_type',
      'scope': 'scope',
      'id_token': 'id_token',
      'session_state': 'session_state',
      'created_at': 'created_at',
      'updated_at': 'updated_at'
    },
    requiredColumns: ['id', 'provider_id', 'provider_account_id']
  },
  {
    remoteTable: 'sessions',
    localTable: 'session', 
    columnMappings: {
      'user_id': 'account_id', // Map to account_id since our sessions link to accounts
      'session_token': 'session_token',
      'expires_at': 'expires_at',
      'created_at': 'created_at',
      'updated_at': 'updated_at'
    },
    requiredColumns: ['id', 'session_token', 'expires_at']
  },
  {
    remoteTable: 'users',
    localTable: 'user',
    columnMappings: {
      'id': 'id',
      'name': 'name',
      'email': 'email', 
      'email_verified': 'email_verified',
      'image': 'image',
      'is_super_admin': 'is_super_admin',
      'created_at': 'created_at',
      'updated_at': 'updated_at'
    },
    requiredColumns: ['id', 'name']
  },
  {
    remoteTable: 'verifications',
    localTable: 'verification',
    columnMappings: {
      'id': 'id',
      'identifier': 'identifier',
      'value': 'value',
      'expires_at': 'expires_at',
      'created_at': 'created_at',
      'updated_at': 'updated_at'
    },
    requiredColumns: ['id', 'identifier', 'value', 'expires_at']
  },
  {
    remoteTable: 'projects',
    localTable: 'project',
    columnMappings: {
      'id': 'id',
      'name': 'name',
      'description': 'description',
      'status': 'status',
      'owner_id': 'owner_id',
      'created_at': 'created_at',
      'updated_at': 'updated_at',
      'client_id': 'client_id'
    },
    requiredColumns: ['id', 'name']
  },
  {
    remoteTable: 'tasks',
    localTable: 'task',
    columnMappings: {
      'id': 'id',
      'title': 'title',
      'description': 'description',
      'priority': 'priority',
      'due_date': 'due_date',
      'start_date': 'start_date',
      'completed_at': 'completed_at',
      'project_id': 'project_id',
      'assignee_id': 'assignee_id',
      'created_at': 'created_at',
      'updated_at': 'updated_at',
      'client_id': 'client_id'
    },
    requiredColumns: ['id', 'title']
  }
];

class DataMigrator {
  private remoteDb: any;
  private localClient: any;
  private stats: MigrationStats;

  constructor() {
    // Initialize remote connection (Neon)
    console.log('🔗 Connecting to remote Neon database...');
    
    // Configure Neon for external connection (reset any local development overrides)
    neonConfig.fetchEndpoint = undefined;
    
    this.remoteDb = neon(REMOTE_DATABASE_URL);

    // Initialize local connection (PostgreSQL)
    this.localClient = new Client({
      host: 'localhost',
      port: 5432,
      database: 'vibestack_dev',
      user: 'postgres',
      password: 'postgres',
    });

    this.stats = {
      tablesProcessed: 0,
      tablesSkipped: 0,
      totalRecords: 0,
      errors: []
    };
  }

  async connect(): Promise<void> {
    await this.localClient.connect();
    console.log('✅ Connected to local database');
  }

  async disconnect(): Promise<void> {
    await this.localClient.end();
    console.log('✅ Disconnected from databases');
  }

  async getLocalTableInfo(tableName: string): Promise<{ exists: boolean; columns: string[] }> {
    try {
      // Check if table exists
      const tableCheck = await this.localClient.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [tableName]);

      if (!tableCheck.rows[0].exists) {
        return { exists: false, columns: [] };
      }

      // Get column names
      const columnQuery = await this.localClient.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 
        AND table_schema = 'public'
        ORDER BY ordinal_position;
      `, [tableName]);

      const columns = columnQuery.rows.map(row => row.column_name);
      return { exists: true, columns };

    } catch (error) {
      console.error(`❌ Error checking local table ${tableName}:`, error);
      return { exists: false, columns: [] };
    }
  }

  async getRemoteTableData(tableName: string): Promise<any[]> {
    try {
      console.log(`🔍 Querying remote table: ${tableName}`);
      
      // For Neon v1.0+, we need to use the tagged template or sql.query()
      // Since table names can't be parameterized, we'll build the query as a template literal
      let result: any[];
      
      switch (tableName) {
        case 'accounts':
          result = await this.remoteDb`SELECT * FROM accounts ORDER BY created_at ASC`;
          break;
        case 'sessions':  
          result = await this.remoteDb`SELECT * FROM sessions ORDER BY created_at ASC`;
          break;
        case 'users':
          result = await this.remoteDb`SELECT * FROM users ORDER BY created_at ASC`;
          break;
        case 'verifications':
          result = await this.remoteDb`SELECT * FROM verifications ORDER BY created_at ASC`;
          break;
        case 'projects':
          result = await this.remoteDb`SELECT * FROM projects ORDER BY created_at ASC`;
          break;
        case 'tasks':
          result = await this.remoteDb`SELECT * FROM tasks ORDER BY created_at ASC`;
          break;
        default:
          console.log(`⏭️  Unsupported table: ${tableName}`);
          return [];
      }
      
      console.log(`📊 Found ${result.length} records in remote ${tableName}`);
      return result;
    } catch (error) {
      console.error(`❌ Error querying remote table ${tableName}:`, error);
      this.stats.errors.push(`Failed to query remote table ${tableName}: ${error.message}`);
      return [];
    }
  }

  mapRecord(record: any, mapping: TableMapping, localColumns: string[]): any {
    const mappedRecord: any = {};
    
    // Map each field according to our column mappings
    for (const [remoteCol, localCol] of Object.entries(mapping.columnMappings)) {
      // Skip if local column doesn't exist
      if (!localColumns.includes(localCol)) {
        continue;
      }

      // Skip if remote record doesn't have this field
      if (!(remoteCol in record)) {
        continue;
      }

      let value = record[remoteCol];

      // Handle special data type conversions
      if (value !== null && value !== undefined) {
        // Convert boolean strings to actual booleans
        if (typeof value === 'string' && (value === 'true' || value === 'false')) {
          value = value === 'true';
        }
        
        // Handle date fields
        if (localCol.includes('_at') && typeof value === 'string') {
          try {
            value = new Date(value);
          } catch (e) {
            console.warn(`⚠️  Invalid date format for ${localCol}: ${value}`);
          }
        }

        // Handle numeric fields
        if (localCol === 'expires_at' && typeof value === 'string') {
          // Could be a timestamp number as string
          if (/^\d+$/.test(value)) {
            value = parseInt(value, 10);
          }
        }
      }

      mappedRecord[localCol] = value;
    }

    // Ensure required columns have values (use defaults if needed)
    for (const requiredCol of mapping.requiredColumns || []) {
      if (!(requiredCol in mappedRecord) || mappedRecord[requiredCol] === null) {
        if (requiredCol === 'id') {
          // Generate new UUID for missing IDs
          mappedRecord[requiredCol] = 'gen_random_uuid()'; // Will be handled as SQL function
        }
      }
    }

    return mappedRecord;
  }

  async migrateTable(mapping: TableMapping): Promise<void> {
    console.log(`\n🚀 Migrating: ${mapping.remoteTable} → ${mapping.localTable}`);

    // Check if local table exists
    const localTableInfo = await this.getLocalTableInfo(mapping.localTable);
    if (!localTableInfo.exists) {
      console.log(`⏭️  Skipping ${mapping.localTable} - table doesn't exist locally`);
      this.stats.tablesSkipped++;
      return;
    }

    console.log(`✅ Local table ${mapping.localTable} exists with columns:`, localTableInfo.columns.join(', '));

    // Get remote data
    const remoteRecords = await this.getRemoteTableData(mapping.remoteTable);
    if (remoteRecords.length === 0) {
      console.log(`⏭️  No data in remote ${mapping.remoteTable}`);
      this.stats.tablesProcessed++;
      return;
    }

    // Clear existing data (optional - could be made configurable)
    await this.localClient.query(`TRUNCATE TABLE "${mapping.localTable}" CASCADE`);
    console.log(`🗑️  Cleared existing data from ${mapping.localTable}`);

    // Migrate records in batches
    const BATCH_SIZE = 100;
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < remoteRecords.length; i += BATCH_SIZE) {
      const batch = remoteRecords.slice(i, i + BATCH_SIZE);
      
      for (const record of batch) {
        try {
          const mappedRecord = this.mapRecord(record, mapping, localTableInfo.columns);
          
          // Build INSERT query
          const columns = Object.keys(mappedRecord);
          const placeholders = columns.map((_, idx) => `$${idx + 1}`);
          const values = columns.map(col => {
            // Handle special SQL functions
            if (mappedRecord[col] === 'gen_random_uuid()') {
              return 'gen_random_uuid()';
            }
            return mappedRecord[col];
          });

          const query = `
            INSERT INTO "${mapping.localTable}" (${columns.map(col => `"${col}"`).join(', ')})
            VALUES (${placeholders.join(', ')})
            ON CONFLICT (id) DO NOTHING
          `;

          await this.localClient.query(query, values.filter(v => v !== 'gen_random_uuid()'));
          successful++;

        } catch (error) {
          failed++;
          console.error(`❌ Failed to insert record:`, error.message);
          this.stats.errors.push(`${mapping.localTable}: ${error.message}`);
        }
      }
    }

    console.log(`✅ Completed ${mapping.localTable}: ${successful} inserted, ${failed} failed`);
    this.stats.tablesProcessed++;
    this.stats.totalRecords += successful;
  }

  async migrate(): Promise<void> {
    console.log('🚀 Starting graceful data migration...\n');

    try {
      await this.connect();

      // Migrate each table according to our mappings
      for (const mapping of TABLE_MAPPINGS) {
        await this.migrateTable(mapping);
      }

      // Print final statistics
      console.log('\n📊 Migration Statistics:');
      console.log(`   Tables processed: ${this.stats.tablesProcessed}`);
      console.log(`   Tables skipped: ${this.stats.tablesSkipped}`);
      console.log(`   Total records migrated: ${this.stats.totalRecords}`);
      
      if (this.stats.errors.length > 0) {
        console.log(`   Errors encountered: ${this.stats.errors.length}`);
        console.log('\n❌ Errors:');
        this.stats.errors.forEach(error => console.log(`   - ${error}`));
      }

      console.log('\n✅ Migration completed!');

    } catch (error) {
      console.error('💥 Migration failed:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const migrator = new DataMigrator();
  migrator.migrate().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

export { DataMigrator };