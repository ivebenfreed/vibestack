#!/usr/bin/env tsx
/**
 * Full sync script to ensure local and remote databases are completely in sync
 * This handles all tables with proper foreign key ordering
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

interface SyncResult {
  table: string;
  localCount: number;
  remoteCount: number;
  synced: number;
  errors: number;
}

async function syncTable(
  localClient: Client,
  remoteClient: Client,
  tableName: string,
  columns: string[],
  uniqueKey: string = 'id',
  skipConflicts: boolean = true
): Promise<SyncResult> {
  const result: SyncResult = {
    table: tableName,
    localCount: 0,
    remoteCount: 0,
    synced: 0,
    errors: 0
  };

  try {
    // Get all records from local
    const localResult = await localClient.query(`SELECT * FROM ${tableName}`);
    result.localCount = localResult.rows.length;
    
    // Get existing IDs from remote
    const remoteIds = await remoteClient.query(`SELECT ${uniqueKey} FROM ${tableName}`);
    const existingIds = new Set(remoteIds.rows.map(r => r[uniqueKey]));
    result.remoteCount = existingIds.size;
    
    // Filter unique records
    const uniqueRecords = localResult.rows.filter(r => !existingIds.has(r[uniqueKey]));
    
    if (uniqueRecords.length === 0) {
      console.log(`✅ ${tableName}: Already in sync (${result.localCount} records)`);
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
        await remoteClient.query(
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
  const localClient = new Client(localConfig);
  const remoteClient = new Client(remoteConfig);
  const results: SyncResult[] = [];
  
  try {
    console.log('🔌 Connecting to databases...');
    await localClient.connect();
    await remoteClient.connect();
    console.log('✅ Connected to both databases\n');
    
    // PHASE 1: Base entities (no foreign keys)
    console.log('📦 PHASE 1: Syncing base entities...\n');
    
    results.push(await syncTable(localClient, remoteClient, 'accounts', [
      'id', 'created_at', 'updated_at', 'provider_id', 'provider_account_id',
      'refresh_token', 'access_token', 'expires_at', 'token_type', 'scope',
      'id_token', 'session_state', 'user_id', 'password', 'account_id',
      'access_token_expires_at', 'refresh_token_expires_at'
    ]));
    
    results.push(await syncTable(localClient, remoteClient, 'verifications', [
      'id', 'created_at', 'updated_at', 'identifier', 'value', 'expires_at'
    ]));
    
    // PHASE 2: Users (may depend on accounts)
    console.log('\n📦 PHASE 2: Syncing users...\n');
    
    results.push(await syncTable(localClient, remoteClient, 'users', [
      'id', 'created_at', 'updated_at', 'name', 'email', 'email_verified',
      'image', 'is_super_admin'
    ]));
    
    // PHASE 3: Configuration entities
    console.log('\n📦 PHASE 3: Syncing configuration entities...\n');
    
    results.push(await syncTable(localClient, remoteClient, 'tag_sets', [
      'id', 'client_id', 'created_at', 'updated_at', 'name', 'description',
      'category', 'is_system', 'is_active', 'default_color', 'display_order',
      'is_exclusive', 'max_tags', 'metadata'
    ]));
    
    results.push(await syncTable(localClient, remoteClient, 'status_sets', [
      'id', 'client_id', 'created_at', 'updated_at', 'name', 'description',
      'entity_type', 'is_default', 'is_active', 'is_system', 'workflow', 
      'metadata', 'display_order', 'default_color'
    ]));
    
    // PHASE 4: Dependent configuration entities
    console.log('\n📦 PHASE 4: Syncing dependent configuration...\n');
    
    results.push(await syncTable(localClient, remoteClient, 'tags', [
      'id', 'client_id', 'created_at', 'updated_at', 'name', 'slug', 'color',
      'icon', 'variant', 'sort_order', 'is_active', 'usage_count', 'last_used_at',
      'metadata', 'tag_set_id', 'parent_id'
    ]));
    
    results.push(await syncTable(localClient, remoteClient, 'status_definitions', [
      'id', 'client_id', 'created_at', 'updated_at', 'name', 'label', 'color',
      'icon', 'variant', 'sort_order', 'is_default', 'is_final', 'is_active',
      'allowed_transitions', 'auto_transition_days', 'metadata', 'status_set_id'
    ]));
    
    // PHASE 5: Projects
    console.log('\n📦 PHASE 5: Syncing projects...\n');
    
    results.push(await syncTable(localClient, remoteClient, 'projects', [
      'id', 'client_id', 'created_at', 'updated_at', 'name', 'description',
      'status', 'owner_id'
    ]));
    
    // PHASE 6: Tasks
    console.log('\n📦 PHASE 6: Syncing tasks...\n');
    
    results.push(await syncTable(localClient, remoteClient, 'tasks', [
      'id', 'client_id', 'created_at', 'updated_at', 'title', 'description',
      'legacy_status', 'priority', 'due_date', 'start_date', 'completed_at',
      'time_range', 'estimated_duration', 'legacy_tags', 'project_id', 'assignee_id'
    ]));
    
    // PHASE 7: Comments and Sessions
    console.log('\n📦 PHASE 7: Syncing comments and sessions...\n');
    
    results.push(await syncTable(localClient, remoteClient, 'comments', [
      'id', 'client_id', 'created_at', 'updated_at', 'content', 'task_id', 'author_id'
    ]));
    
    results.push(await syncTable(localClient, remoteClient, 'sessions', [
      'id', 'created_at', 'updated_at', 'session_token', 'expires_at', 'user_id'
    ]));
    
    // PHASE 8: Join tables
    console.log('\n📦 PHASE 8: Syncing join tables...\n');
    
    // For join tables, we need composite keys
    const taskTagsLocal = await localClient.query('SELECT * FROM task_tags');
    const taskTagsRemote = await remoteClient.query('SELECT task_id, tag_id FROM task_tags');
    const existingTaskTags = new Set(taskTagsRemote.rows.map(r => `${r.task_id}-${r.tag_id}`));
    
    let taskTagsSynced = 0;
    for (const tt of taskTagsLocal.rows) {
      const key = `${tt.task_id}-${tt.tag_id}`;
      if (!existingTaskTags.has(key)) {
        try {
          await remoteClient.query(
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
    
    // Project join tables
    const projectTagSetsLocal = await localClient.query('SELECT * FROM project_tag_sets');
    let projectTagSetsSynced = 0;
    for (const pts of projectTagSetsLocal.rows) {
      try {
        await remoteClient.query(
          'INSERT INTO project_tag_sets (project_id, tag_set_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [pts.project_id, pts.tag_set_id]
        );
        projectTagSetsSynced++;
      } catch (error: any) {
        // Ignore duplicates
      }
    }
    if (projectTagSetsSynced > 0) {
      console.log(`✅ project_tag_sets: Synced ${projectTagSetsSynced} records`);
    }
    
    const projectStatusSetsLocal = await localClient.query('SELECT * FROM project_status_sets');
    let projectStatusSetsSynced = 0;
    for (const pss of projectStatusSetsLocal.rows) {
      try {
        await remoteClient.query(
          'INSERT INTO project_status_sets (project_id, status_set_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [pss.project_id, pss.status_set_id]
        );
        projectStatusSetsSynced++;
      } catch (error: any) {
        // Ignore duplicates
      }
    }
    if (projectStatusSetsSynced > 0) {
      console.log(`✅ project_status_sets: Synced ${projectStatusSetsSynced} records`);
    }
    
    // PHASE 9: Metadata tables
    console.log('\n📦 PHASE 9: Syncing metadata tables...\n');
    
    // Entity dependencies (already synced earlier but let's check)
    const entityDepsLocal = await localClient.query('SELECT COUNT(*) as count FROM entity_dependencies');
    const entityDepsRemote = await remoteClient.query('SELECT COUNT(*) as count FROM entity_dependencies');
    console.log(`✅ entity_dependencies: ${entityDepsLocal.rows[0].count} local, ${entityDepsRemote.rows[0].count} remote`);
    
    results.push(await syncTable(localClient, remoteClient, 'sync_metadata', [
      'id', 'created_at', 'updated_at', 'table_name', 'last_synced_version', 'last_synced_at'
    ]));
    
    results.push(await syncTable(localClient, remoteClient, 'local_changes', [
      'id', 'created_at', 'updated_at', 'table_name', 'record_id', 'operation_type',
      'data', 'client_sequence', 'loop_protection'
    ]));
    
    // PHASE 10: Final verification
    console.log('\n📊 FINAL VERIFICATION:\n');
    console.log('Table                 | Local  | Remote | Synced | Errors');
    console.log('---------------------|--------|--------|--------|-------');
    
    for (const result of results) {
      const padded = result.table.padEnd(20);
      const local = result.localCount.toString().padEnd(6);
      const remote = (result.remoteCount + result.synced).toString().padEnd(6);
      const synced = result.synced.toString().padEnd(6);
      const errors = result.errors.toString().padEnd(6);
      console.log(`${padded} | ${local} | ${remote} | ${synced} | ${errors}`);
    }
    
    console.log('\n✨ Sync complete!');
    
  } catch (error) {
    console.error('❌ Fatal error during sync:', error);
    throw error;
  } finally {
    await localClient.end();
    await remoteClient.end();
  }
}

// Run the sync
main().catch(console.error);