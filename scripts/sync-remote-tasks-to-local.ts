#!/usr/bin/env tsx
/**
 * Sync tasks from remote to local database
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
    
    // Get current counts
    const localCount = await localClient.query('SELECT COUNT(*) as count FROM tasks');
    const remoteCount = await remoteClient.query('SELECT COUNT(*) as count FROM tasks');
    
    console.log(`📊 Current status:`);
    console.log(`   Local tasks: ${localCount.rows[0].count}`);
    console.log(`   Remote tasks: ${remoteCount.rows[0].count}\n`);
    
    // Get all remote tasks
    const remoteTasks = await remoteClient.query('SELECT * FROM tasks');
    console.log(`📥 Fetched ${remoteTasks.rows.length} tasks from remote\n`);
    
    // Get existing local task IDs
    const localTaskIds = await localClient.query('SELECT id FROM tasks');
    const existingIds = new Set(localTaskIds.rows.map(r => r.id));
    
    // Filter for unique remote tasks
    const uniqueRemoteTasks = remoteTasks.rows.filter(t => !existingIds.has(t.id));
    console.log(`🔍 Found ${uniqueRemoteTasks.length} unique tasks to sync\n`);
    
    if (uniqueRemoteTasks.length === 0) {
      console.log('✅ All remote tasks already exist locally!');
      return;
    }
    
    // Insert unique tasks
    let synced = 0;
    let errors = 0;
    
    for (const task of uniqueRemoteTasks) {
      try {
        await localClient.query(`
          INSERT INTO tasks (
            id, client_id, created_at, updated_at,
            title, description, legacy_status, priority,
            due_date, start_date, completed_at, time_range,
            estimated_duration, legacy_tags, project_id, assignee_id
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
          ) ON CONFLICT (id) DO NOTHING
        `, [
          task.id,
          task.client_id,
          task.created_at,
          task.updated_at,
          task.title,
          task.description,
          task.legacy_status,
          task.priority,
          task.due_date,
          task.start_date,
          task.completed_at,
          task.time_range,
          task.estimated_duration,
          task.legacy_tags,
          task.project_id,
          task.assignee_id
        ]);
        synced++;
        
        if (synced % 10 === 0) {
          console.log(`   ✅ Synced ${synced} tasks...`);
        }
      } catch (error: any) {
        errors++;
        console.error(`   ❌ Error syncing task ${task.id}: ${error.message}`);
      }
    }
    
    // Final verification
    const newLocalCount = await localClient.query('SELECT COUNT(*) as count FROM tasks');
    
    console.log(`\n✨ Sync complete!`);
    console.log(`   Tasks synced: ${synced}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Local tasks now: ${newLocalCount.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await localClient.end();
    await remoteClient.end();
  }
}

main().catch(console.error);