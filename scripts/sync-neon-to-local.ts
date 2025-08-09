#!/usr/bin/env tsx

/**
 * Sync data from remote Neon database to local PostgreSQL
 * This script copies all data from domain tables to fix data loss issues
 */

import { config } from 'dotenv';
import { Pool as PgPool } from 'pg';
import { neon } from '@neondatabase/serverless';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.join(__dirname, '../packages/dataforge/.env') });

// Tables to sync in order (respecting foreign key constraints)
const TABLES_TO_SYNC = [
  // Users and auth first
  'users',
  'accounts',
  'sessions',
  'verifications',
  'jwks',
  
  // Core entities
  'projects',
  'status_sets',
  'status_definitions',
  'tag_sets', 
  'tags',
  'tasks',
  'comments',
  'entity_dependencies',
  
  // Junction tables
  'project_members',
  'project_status_sets',
  'project_tag_sets',
  'task_tags',
  'task_dependencies',
  
  // System tables (optional)
  // 'change_history',
  // 'local_changes',
  // 'sync_metadata'
];

async function syncNeonToLocal() {
  console.log('🚀 Starting Neon to Local PostgreSQL sync...\n');
  
  // Get database URLs
  const neonUrl = process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;
  const localUrl = 'postgresql://postgres:postgres@localhost:5432/vibestack_dev';
  
  if (!neonUrl) {
    console.error('❌ No Neon database URL found in environment variables');
    process.exit(1);
  }
  
  console.log('📍 Remote Neon URL:', neonUrl.substring(0, 30) + '...');
  console.log('📍 Local PostgreSQL URL:', localUrl.substring(0, 30) + '...\n');
  
  // Create connections
  const neonSql = neon(neonUrl);
  const localPool = new PgPool({ connectionString: localUrl });
  
  try {
    // Test connections
    console.log('🔌 Testing connections...');
    await neonSql`SELECT 1`;
    await localPool.query('SELECT 1');
    console.log('✅ Both databases connected successfully\n');
    
    // Get record counts from Neon
    console.log('📊 Checking Neon database records...');
    const existingTables = [];
    for (const table of TABLES_TO_SYNC) {
      try {
        // Use unsafe() for table names which are trusted values
        const result = await neonSql`SELECT COUNT(*) as count FROM ${neonSql.unsafe(table)}`;
        const count = result[0]?.count || 0;
        if (count > 0) {
          console.log(`  ${table}: ${count} records`);
          existingTables.push(table);
        } else {
          existingTables.push(table); // Include empty tables too
        }
      } catch (error: any) {
        if (error.code === '42P01') {
          console.log(`  ⚠️  ${table}: table does not exist in remote`);
        } else {
          throw error;
        }
      }
    }
    console.log();
    
    // Sync each table
    for (const table of TABLES_TO_SYNC) {
      console.log(`📋 Syncing table: ${table}`);
      
      try {
        // Get data from Neon (use unsafe() for trusted table names)
        const neonData = await neonSql`SELECT * FROM ${neonSql.unsafe(table)}`;
        
        if (neonData.length === 0) {
          console.log(`  ⏭️  No data to sync\n`);
          continue;
        }
        
        // Begin transaction in local DB
        const client = await localPool.connect();
        
        try {
          await client.query('BEGIN');
          
          // Disable triggers temporarily to avoid conflicts
          await client.query(`ALTER TABLE ${table} DISABLE TRIGGER ALL`);
          
          // Clear existing data
          await client.query(`TRUNCATE TABLE ${table} CASCADE`);
          console.log(`  🗑️  Cleared existing data`);
          
          // Insert new data
          if (neonData.length > 0) {
            // Get column names from first row
            const columns = Object.keys(neonData[0]);
            const columnNames = columns.join(', ');
            const valuePlaceholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            
            const insertQuery = `INSERT INTO ${table} (${columnNames}) VALUES (${valuePlaceholders})`;
            
            // Insert each row
            let inserted = 0;
            for (const row of neonData) {
              const values = columns.map(col => {
                const value = row[col];
                // Handle special types
                if (value instanceof Date) {
                  return value.toISOString();
                }
                if (typeof value === 'object' && value !== null) {
                  return JSON.stringify(value);
                }
                return value;
              });
              
              await client.query(insertQuery, values);
              inserted++;
            }
            
            console.log(`  ✅ Inserted ${inserted} records`);
          }
          
          // Re-enable triggers
          await client.query(`ALTER TABLE ${table} ENABLE TRIGGER ALL`);
          
          // Commit transaction
          await client.query('COMMIT');
          console.log(`  ✅ Sync completed\n`);
          
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
        
      } catch (error) {
        console.error(`  ❌ Error syncing ${table}:`, error.message);
        // Continue with next table
      }
    }
    
    // Update sequences for auto-increment fields
    console.log('🔧 Updating sequences...');
    const sequenceQueries = [
      `SELECT setval('entity_dependencies_id_seq', (SELECT MAX(id) FROM entity_dependencies), true)`,
      // Add more sequences as needed
    ];
    
    for (const query of sequenceQueries) {
      try {
        await localPool.query(query);
      } catch (e) {
        // Ignore if sequence doesn't exist
      }
    }
    
    // Final verification
    console.log('\n📊 Final record counts in local database:');
    for (const table of TABLES_TO_SYNC) {
      const result = await localPool.query(`SELECT COUNT(*) as count FROM ${table}`);
      const count = result.rows[0]?.count || 0;
      if (count > 0) {
        console.log(`  ${table}: ${count} records`);
      }
    }
    
    console.log('\n✅ Sync completed successfully!');
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  } finally {
    await localPool.end();
  }
}

// Run the sync
syncNeonToLocal().catch(console.error);