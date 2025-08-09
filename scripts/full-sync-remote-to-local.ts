#!/usr/bin/env tsx
/**
 * Full sync from remote Neon database to local
 * This is the opposite of full-sync-local-to-remote.ts
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Read the Neon URL from .dev.vars
const devVarsPath = path.join(__dirname, '../apps/server/.dev.vars');
let remoteUrl = process.env.REMOTE_DATABASE_URL;

if (!remoteUrl && fs.existsSync(devVarsPath)) {
  const devVars = fs.readFileSync(devVarsPath, 'utf-8');
  const match = devVars.match(/^DATABASE_URL=(.+)$/m);
  if (match) {
    remoteUrl = match[1];
  }
}

if (!remoteUrl) {
  console.error('❌ Could not find DATABASE_URL in .dev.vars or REMOTE_DATABASE_URL env var');
  process.exit(1);
}

const remoteConfig = {
  connectionString: remoteUrl,
  ssl: true
};

const localConfig = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'vibestack_dev'
};

interface SyncResult {
  table: string;
  remoteCount: number;
  localCount: number;
  synced: number;
  errors: number;
}

async function syncTable(
  remoteClient: Client,
  localClient: Client,
  tableName: string,
  columns: string[],
  uniqueKey: string = 'id',
  skipConflicts: boolean = true
): Promise<SyncResult> {
  const result: SyncResult = {
    table: tableName,
    remoteCount: 0,
    localCount: 0,
    synced: 0,
    errors: 0
  };

  try {
    // Get all records from remote
    const remoteResult = await remoteClient.query(`SELECT * FROM ${tableName}`);
    result.remoteCount = remoteResult.rows.length;
    
    // Get existing IDs from local
    const localIds = await localClient.query(`SELECT ${uniqueKey} FROM ${tableName}`);
    const existingIds = new Set(localIds.rows.map(r => r[uniqueKey]));
    result.localCount = existingIds.size;
    
    // Filter unique records
    const uniqueRecords = remoteResult.rows.filter(r => !existingIds.has(r[uniqueKey]));
    
    if (uniqueRecords.length === 0) {
      console.log(`✅ ${tableName}: Already in sync (${result.remoteCount} records)`);
      return result;
    }
    
    console.log(`📊 ${tableName}: Syncing ${uniqueRecords.length} new records...`);
    
    // Insert unique records
    for (const record of uniqueRecords) {
      const values = columns.map(col => record[col]);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const columnList = columns.join(', ');
      
      try {
        const conflictClause = skipConflicts ? `ON CONFLICT (${uniqueKey}) DO NOTHING` : '';
        await localClient.query(
          `INSERT INTO ${tableName} (${columnList}) VALUES (${placeholders}) ${conflictClause}`,
          values
        );
        result.synced++;
      } catch (error: any) {
        result.errors++;
        console.error(`  ❌ Error in ${tableName} for ID ${record[uniqueKey]}: ${error.message}`);
      }
    }
    
    console.log(`✅ ${tableName}: Synced ${result.synced} records (${result.errors} errors)`);
  } catch (error: any) {
    console.error(`❌ Failed to sync ${tableName}: ${error.message}`);
  }
  
  return result;
}

async function main() {
  const remoteClient = new Client(remoteConfig);
  const localClient = new Client(localConfig);
  const results: SyncResult[] = [];
  
  try {
    console.log('🔌 Connecting to databases...');
    await remoteClient.connect();
    await localClient.connect();
    console.log('✅ Connected to both databases\n');
    
    // PHASE 1: Base entities (no foreign keys)
    console.log('📦 PHASE 1: Syncing base entities...\n');
    
    results.push(await syncTable(remoteClient, localClient, 'accounts', [
      'id', 'created_at', 'updated_at', 'provider_id', 'provider_account_id',
      'refresh_token', 'access_token', 'expires_at', 'token_type', 'scope',
      'id_token', 'session_state', 'user_id', 'password', 'account_id',
      'access_token_expires_at', 'refresh_token_expires_at'
    ]));
    
    results.push(await syncTable(remoteClient, localClient, 'verifications', [
      'id', 'created_at', 'updated_at', 'identifier', 'value', 'expires_at'
    ]));
    
    // PHASE 2: Users
    console.log('\n📦 PHASE 2: Syncing users...\n');
    
    results.push(await syncTable(remoteClient, localClient, 'users', [
      'id', 'created_at', 'updated_at', 'name', 'email', 'email_verified',
      'image', 'is_super_admin'
    ]));
    
    // PHASE 3: Configuration entities
    console.log('\n📦 PHASE 3: Syncing configuration entities...\n');
    
    results.push(await syncTable(remoteClient, localClient, 'tag_sets', [
      'id', 'client_id', 'created_at', 'updated_at', 'name', 'description',
      'category', 'is_system', 'is_active', 'default_color', 'display_order',
      'is_exclusive', 'max_tags', 'metadata'
    ]));
    
    results.push(await syncTable(remoteClient, localClient, 'status_sets', [
      'id', 'client_id', 'created_at', 'updated_at', 'name', 'description',
      'entity_type', 'is_default', 'is_active', 'is_system', 'workflow', 
      'metadata', 'display_order', 'default_color'
    ]));
    
    // PHASE 4: Dependent configuration
    console.log('\n📦 PHASE 4: Syncing dependent configuration...\n');
    
    results.push(await syncTable(remoteClient, localClient, 'tags', [
      'id', 'client_id', 'created_at', 'updated_at', 'name', 'slug', 'color',
      'icon', 'variant', 'sort_order', 'is_active', 'usage_count', 'last_used_at',
      'metadata', 'tag_set_id', 'parent_id'
    ]));
    
    results.push(await syncTable(remoteClient, localClient, 'status_definitions', [
      'id', 'client_id', 'created_at', 'updated_at', 'name', 'label', 'color',
      'icon', 'variant', 'sort_order', 'is_default', 'is_final', 'is_active',
      'allowed_transitions', 'auto_transition_days', 'metadata', 'status_set_id'
    ]));
    
    // PHASE 5: Projects
    console.log('\n📦 PHASE 5: Syncing projects...\n');
    
    results.push(await syncTable(remoteClient, localClient, 'projects', [
      'id', 'client_id', 'created_at', 'updated_at', 'name', 'description',
      'status', 'owner_id'
    ]));
    
    // PHASE 6: Tasks
    console.log('\n📦 PHASE 6: Syncing tasks...\n');
    
    results.push(await syncTable(remoteClient, localClient, 'tasks', [
      'id', 'client_id', 'created_at', 'updated_at', 'title', 'description',
      'legacy_status', 'priority', 'due_date', 'start_date', 'completed_at',
      'time_range', 'estimated_duration', 'legacy_tags', 'project_id', 'assignee_id'
    ]));
    
    // PHASE 7: Comments and Sessions
    console.log('\n📦 PHASE 7: Syncing comments and sessions...\n');
    
    results.push(await syncTable(remoteClient, localClient, 'comments', [
      'id', 'client_id', 'created_at', 'updated_at', 'content', 'task_id', 'author_id'
    ]));
    
    results.push(await syncTable(remoteClient, localClient, 'sessions', [
      'id', 'created_at', 'updated_at', 'session_token', 'expires_at', 'user_id'
    ]));
    
    // PHASE 8: Entity dependencies
    console.log('\n📦 PHASE 8: Syncing entity dependencies...\n');
    
    results.push(await syncTable(remoteClient, localClient, 'entity_dependencies', [
      'id', 'client_id', 'created_at', 'updated_at', 'entity_type',
      'predecessor_id', 'successor_id', 'dependency_type', 'lag_time',
      'lag_days', 'metadata', 'description', 'from_table', 'from_id',
      'to_table', 'to_id'
    ]));
    
    // PHASE 9: Join tables
    console.log('\n📦 PHASE 9: Syncing join tables...\n');
    
    // Task tags
    const taskTagsRemote = await remoteClient.query('SELECT * FROM task_tags');
    const taskTagsLocal = await localClient.query('SELECT task_id, tag_id FROM task_tags');
    const existingTaskTags = new Set(taskTagsLocal.rows.map(r => `${r.task_id}-${r.tag_id}`));
    
    let taskTagsSynced = 0;
    for (const tt of taskTagsRemote.rows) {
      const key = `${tt.task_id}-${tt.tag_id}`;
      if (!existingTaskTags.has(key)) {
        try {
          await localClient.query(
            'INSERT INTO task_tags (task_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [tt.task_id, tt.tag_id]
          );
          taskTagsSynced++;
        } catch (error: any) {
          console.error(`  ❌ Error syncing task_tag: ${error.message}`);
        }
      }
    }
    console.log(`✅ task_tags: Synced ${taskTagsSynced} records`);
    
    // PHASE 10: Final verification
    console.log('\n📊 FINAL VERIFICATION:\n');
    console.log('Table                 | Remote | Local  | Synced | Errors');
    console.log('---------------------|--------|--------|--------|-------');
    
    for (const result of results) {
      const padded = result.table.padEnd(20);
      const remote = result.remoteCount.toString().padEnd(6);
      const local = (result.localCount + result.synced).toString().padEnd(6);
      const synced = result.synced.toString().padEnd(6);
      const errors = result.errors.toString().padEnd(6);
      console.log(`${padded} | ${remote} | ${local} | ${synced} | ${errors}`);
    }
    
    console.log('\n✨ Sync complete!');
    
  } catch (error) {
    console.error('❌ Fatal error during sync:', error);
    throw error;
  } finally {
    await remoteClient.end();
    await localClient.end();
  }
}

// Run the sync
main().catch(console.error);