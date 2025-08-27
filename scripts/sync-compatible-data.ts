#!/usr/bin/env tsx
/**
 * Script to sync compatible data from local database to remote Neon database
 * Only syncs tables and fields that exist and are compatible between schemas
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

async function syncUsers(localClient: Client, remoteClient: Client) {
  console.log(`\n📊 Syncing users...`);
  
  // Get all records from local user table
  const localResult = await localClient.query(`
    SELECT id, name, email, "emailVerified", image, "createdAt", "updatedAt"
    FROM "user"
  `);
  console.log(`  Found ${localResult.rows.length} local user records`);
  
  // Get existing IDs from remote users table
  const remoteIds = await remoteClient.query(`SELECT id FROM users`);
  const existingIds = new Set(remoteIds.rows.map(r => r.id));
  console.log(`  Found ${existingIds.size} remote user records`);
  
  let syncedCount = 0;
  
  // Insert unique records
  for (const record of localResult.rows) {
    if (existingIds.has(record.id)) continue;
    
    try {
      await remoteClient.query(
        `INSERT INTO users (
          id, name, email, email_verified, image, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
        ON CONFLICT (id) DO NOTHING`,
        [
          record.id,
          record.name,
          record.email,
          record.emailVerified || false,
          record.image,
          record.createdAt,
          record.updatedAt
        ]
      );
      syncedCount++;
    } catch (error: any) {
      console.error(`  ❌ Error inserting user:`, error.message);
      console.error(`     Record ID: ${record.id}`);
    }
  }
  
  console.log(`  ✅ Synced ${syncedCount} user records`);
  return syncedCount;
}

async function syncSessions(localClient: Client, remoteClient: Client) {
  console.log(`\n📊 Syncing sessions...`);
  
  // Get all records from local session table
  const localResult = await localClient.query(`
    SELECT id, "userId", token, "expiresAt", "createdAt", "updatedAt"
    FROM session
  `);
  console.log(`  Found ${localResult.rows.length} local session records`);
  
  // Get existing IDs from remote sessions table
  const remoteIds = await remoteClient.query(`SELECT id FROM sessions`);
  const existingIds = new Set(remoteIds.rows.map(r => r.id));
  console.log(`  Found ${existingIds.size} remote session records`);
  
  let syncedCount = 0;
  
  // Insert unique records
  for (const record of localResult.rows) {
    if (existingIds.has(record.id)) continue;
    
    try {
      await remoteClient.query(
        `INSERT INTO sessions (
          id, user_id, session_token, expires_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6) 
        ON CONFLICT (id) DO NOTHING`,
        [
          record.id,
          record.userId,
          record.token, // Use token from local, map to session_token in remote
          record.expiresAt,
          record.createdAt,
          record.updatedAt
        ]
      );
      syncedCount++;
    } catch (error: any) {
      console.error(`  ❌ Error inserting session:`, error.message);
      console.error(`     Record ID: ${record.id}`);
    }
  }
  
  console.log(`  ✅ Synced ${syncedCount} session records`);
  return syncedCount;
}

async function main() {
  const localClient = new Client(localConfig);
  const remoteClient = new Client(remoteConfig);
  
  try {
    console.log('🔌 Connecting to databases...');
    await localClient.connect();
    await remoteClient.connect();
    console.log('✅ Connected to both databases');
    
    // Create UUIDv7 function if it doesn't exist
    await remoteClient.query(`
      CREATE OR REPLACE FUNCTION public.generate_uuidv7() 
      RETURNS uuid LANGUAGE sql AS $function$ 
      SELECT gen_random_uuid(); 
      $function$;
    `);
    
    // Sync only compatible tables
    await syncUsers(localClient, remoteClient);
    await syncSessions(localClient, remoteClient);
    
    console.log('\n✨ Compatible data sync complete!');
    console.log('\n📝 Note: Only user and session data was synced due to schema differences.');
    console.log('   Account and organization data requires schema migration or manual mapping.');
    
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