#!/usr/bin/env tsx
/**
 * Script to sync unique data from local database to remote Neon database
 * Respects foreign key relationships and merges only unique records
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

async function syncTable(
  localClient: Client, 
  remoteClient: Client, 
  tableName: string,
  columns: string[],
  uniqueKey: string = 'id'
) {
  console.log(`\n📊 Syncing ${tableName}...`);
  
  // Get all records from local
  const localResult = await localClient.query(`SELECT * FROM ${tableName}`);
  console.log(`  Found ${localResult.rows.length} local records`);
  
  // Get existing IDs from remote
  const remoteIds = await remoteClient.query(`SELECT ${uniqueKey} FROM ${tableName}`);
  const existingIds = new Set(remoteIds.rows.map(r => r[uniqueKey]));
  console.log(`  Found ${existingIds.size} remote records`);
  
  // Filter unique records
  const uniqueRecords = localResult.rows.filter(r => !existingIds.has(r[uniqueKey]));
  console.log(`  ${uniqueRecords.length} unique records to sync`);
  
  if (uniqueRecords.length === 0) return 0;
  
  // Insert unique records
  for (const record of uniqueRecords) {
    const values = columns.map(col => record[col]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const columnList = columns.join(', ');
    
    try {
      await remoteClient.query(
        `INSERT INTO ${tableName} (${columnList}) VALUES (${placeholders}) ON CONFLICT (${uniqueKey}) DO NOTHING`,
        values
      );
    } catch (error: any) {
      console.error(`  ❌ Error inserting into ${tableName}:`, error.message);
      console.error(`     Record ID: ${record[uniqueKey]}`);
    }
  }
  
  console.log(`  ✅ Synced ${uniqueRecords.length} records`);
  return uniqueRecords.length;
}

async function main() {
  const localClient = new Client(localConfig);
  const remoteClient = new Client(remoteConfig);
  
  try {
    console.log('🔌 Connecting to databases...');
    await localClient.connect();
    await remoteClient.connect();
    console.log('✅ Connected to both databases');
    
    // Order matters due to foreign key constraints!
    // 1. First sync entities without dependencies
    
    // Accounts (no deps)
    await syncTable(localClient, remoteClient, 'accounts', [
      'id', 'created_at', 'updated_at', 'provider_id', 'provider_account_id',
      'refresh_token', 'access_token', 'expires_at', 'token_type', 'scope',
      'id_token', 'session_state'
    ]);
    
    // Users (depends on accounts)
    await syncTable(localClient, remoteClient, 'users', [
      'id', 'created_at', 'updated_at', 'name', 'email', 'email_verified',
      'image', 'is_super_admin', 'accounts_id'
    ]);
    
    // Tag sets (no deps)
    await syncTable(localClient, remoteClient, 'tag_sets', [
      'id', 'client_id', 'created_at', 'updated_at', 'name', 'description',
      'category', 'is_system', 'is_active', 'default_color', 'display_order',
      'is_exclusive', 'max_tags', 'metadata'
    ]);
    
    // Status sets (no deps)
    await syncTable(localClient, remoteClient, 'status_sets', [
      'id', 'client_id', 'created_at', 'updated_at', 'name', 'description',
      'entity_type', 'is_default', 'is_active', 'is_system', 'workflow', 'metadata'
    ]);
    
    // Projects (depends on users)
    await syncTable(localClient, remoteClient, 'projects', [
      'id', 'client_id', 'created_at', 'updated_at', 'name', 'description',
      'status', 'owner_id'
    ]);
    
    // Tags (depends on tag_sets)
    await syncTable(localClient, remoteClient, 'tags', [
      'id', 'client_id', 'created_at', 'updated_at', 'name', 'slug', 'color',
      'icon', 'variant', 'sort_order', 'is_active', 'usage_count', 'last_used_at',
      'metadata', 'tag_set_id', 'parent_id'
    ]);
    
    // Status definitions (depends on status_sets)
    await syncTable(localClient, remoteClient, 'status_definitions', [
      'id', 'client_id', 'created_at', 'updated_at', 'name', 'label', 'color',
      'icon', 'variant', 'sort_order', 'is_default', 'is_final', 'is_active',
      'allowed_transitions', 'auto_transition_days', 'metadata', 'status_set_id'
    ]);
    
    // Tasks (depends on projects and users)
    await syncTable(localClient, remoteClient, 'tasks', [
      'id', 'client_id', 'created_at', 'updated_at', 'title', 'description',
      'legacy_status', 'priority', 'due_date', 'start_date', 'completed_at',
      'time_range', 'estimated_duration', 'legacy_tags', 'project_id', 'assignee_id'
    ]);
    
    // Comments (depends on tasks and users)
    await syncTable(localClient, remoteClient, 'comments', [
      'id', 'client_id', 'created_at', 'updated_at', 'content', 'task_id', 'author_id'
    ]);
    
    // Sessions (depends on accounts)
    await syncTable(localClient, remoteClient, 'sessions', [
      'id', 'created_at', 'updated_at', 'session_token', 'expires_at', 'user_id'
    ]);
    
    // Join tables (many-to-many relationships)
    await syncTable(localClient, remoteClient, 'task_tags', [
      'task_id', 'tag_id'
    ], 'task_id');
    
    await syncTable(localClient, remoteClient, 'project_tag_sets', [
      'project_id', 'tag_set_id'
    ], 'project_id');
    
    await syncTable(localClient, remoteClient, 'project_status_sets', [
      'project_id', 'status_set_id'
    ], 'project_id');
    
    // Sync metadata tables
    await syncTable(localClient, remoteClient, 'sync_metadata', [
      'id', 'created_at', 'updated_at', 'table_name', 'last_synced_version', 'last_synced_at'
    ]);
    
    await syncTable(localClient, remoteClient, 'entity_dependencies', [
      'id', 'created_at', 'updated_at', 'from_table', 'from_id', 'to_table',
      'to_id', 'dependency_type', 'metadata'
    ]);
    
    await syncTable(localClient, remoteClient, 'local_changes', [
      'id', 'created_at', 'updated_at', 'table_name', 'record_id', 'operation_type',
      'data', 'client_sequence', 'loop_protection'
    ]);
    
    await syncTable(localClient, remoteClient, 'change_history', [
      'id', 'created_at', 'updated_at', 'lsn', 'table_name', 'operation', 'data', 'timestamp'
    ]);
    
    console.log('\n✨ Sync complete!');
    
  } catch (error) {
    console.error('❌ Error during sync:', error);
    throw error;
  } finally {
    await localClient.end();
    await remoteClient.end();
  }
}

// Run the sync
main().catch(console.error);