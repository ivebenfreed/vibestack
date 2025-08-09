#!/usr/bin/env tsx
/**
 * Script to sync entity_dependencies from local to remote with column mapping
 */

import { Client } from 'pg';

const localConfig = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'vibestack_dev'
};

const remoteConfig = {
  connectionString: 'postgresql://neondb_owner:npg_N2CLXIVGK9Ra@ep-tight-forest-a4hnhb61-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: true
};

async function main() {
  const localClient = new Client(localConfig);
  const remoteClient = new Client(remoteConfig);
  
  try {
    console.log('🔌 Connecting to databases...');
    await localClient.connect();
    await remoteClient.connect();
    
    // Get entity_dependencies from local
    const localDeps = await localClient.query(`
      SELECT 
        id, 
        created_at, 
        updated_at,
        entity_type,
        predecessor_id,
        successor_id,
        dependency_type,
        metadata
      FROM entity_dependencies
    `);
    
    console.log(`📊 Found ${localDeps.rows.length} local entity_dependencies`);
    
    // Check existing in remote
    const remoteIds = await remoteClient.query('SELECT id FROM entity_dependencies');
    const existingIds = new Set(remoteIds.rows.map(r => r.id));
    console.log(`📊 Found ${existingIds.size} remote entity_dependencies`);
    
    let inserted = 0;
    for (const dep of localDeps.rows) {
      if (existingIds.has(dep.id)) continue;
      
      try {
        // Map columns: 
        // entity_type -> from_table/to_table (lowercase)
        // predecessor_id -> from_id
        // successor_id -> to_id
        const tableName = dep.entity_type ? dep.entity_type.toLowerCase() + 's' : 'tasks';
        
        await remoteClient.query(`
          INSERT INTO entity_dependencies (
            id, created_at, updated_at,
            from_table, from_id,
            to_table, to_id,
            dependency_type, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO NOTHING
        `, [
          dep.id,
          dep.created_at,
          dep.updated_at,
          tableName,  // from_table
          dep.predecessor_id,  // from_id
          tableName,  // to_table (same entity type)
          dep.successor_id,  // to_id
          dep.dependency_type,
          dep.metadata || {}
        ]);
        inserted++;
      } catch (error: any) {
        console.error(`❌ Error inserting dependency ${dep.id}:`, error.message);
      }
    }
    
    console.log(`✅ Synced ${inserted} entity_dependencies`);
    
    // Also check if there are any task_dependencies table records
    try {
      const taskDeps = await localClient.query('SELECT COUNT(*) as count FROM task_dependencies');
      if (taskDeps.rows[0].count > 0) {
        console.log(`📊 Found ${taskDeps.rows[0].count} task_dependencies records`);
        
        // Check if remote has this table
        const remoteTables = await remoteClient.query(`
          SELECT table_name FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'task_dependencies'
        `);
        
        if (remoteTables.rows.length > 0) {
          // Sync task_dependencies too
          const localTaskDeps = await localClient.query('SELECT * FROM task_dependencies');
          let taskDepInserted = 0;
          
          for (const td of localTaskDeps.rows) {
            try {
              await remoteClient.query(`
                INSERT INTO task_dependencies 
                SELECT * FROM (VALUES ($1::uuid, $2::uuid, $3::varchar, $4::int, $5::int)) 
                AS v(predecessor_id, successor_id, dependency_type, lag_time, lag_days)
                ON CONFLICT DO NOTHING
              `, [td.predecessor_id, td.successor_id, td.dependency_type, td.lag_time, td.lag_days]);
              taskDepInserted++;
            } catch (error: any) {
              console.error(`❌ Error inserting task_dependency:`, error.message);
            }
          }
          console.log(`✅ Synced ${taskDepInserted} task_dependencies`);
        }
      }
    } catch (error) {
      console.log('ℹ️ No task_dependencies table found in local database');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await localClient.end();
    await remoteClient.end();
  }
}

main().catch(console.error);