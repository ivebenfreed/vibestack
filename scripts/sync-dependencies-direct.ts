#!/usr/bin/env tsx
/**
 * Direct sync using matching column names
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
        client_id,
        created_at, 
        updated_at,
        entity_type,
        predecessor_id,
        successor_id,
        dependency_type,
        lag_time,
        lag_days,
        metadata,
        description
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
        // Also populate the new columns for compatibility
        const tableName = dep.entity_type ? dep.entity_type.toLowerCase() + 's' : 'tasks';
        
        await remoteClient.query(`
          INSERT INTO entity_dependencies (
            id, client_id, created_at, updated_at,
            entity_type, predecessor_id, successor_id,
            dependency_type, lag_time, lag_days, metadata, description,
            from_table, from_id, to_table, to_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (id) DO NOTHING
        `, [
          dep.id,
          dep.client_id,
          dep.created_at,
          dep.updated_at,
          dep.entity_type,
          dep.predecessor_id,
          dep.successor_id,
          dep.dependency_type,
          dep.lag_time,
          dep.lag_days,
          dep.metadata,
          dep.description,
          tableName,  // from_table
          dep.predecessor_id,  // from_id
          tableName,  // to_table
          dep.successor_id  // to_id
        ]);
        inserted++;
        console.log(`✅ Inserted dependency ${dep.id}`);
      } catch (error: any) {
        console.error(`❌ Error inserting dependency ${dep.id}:`, error.message);
      }
    }
    
    console.log(`\n✅ Successfully synced ${inserted} entity_dependencies`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await localClient.end();
    await remoteClient.end();
  }
}

main().catch(console.error);