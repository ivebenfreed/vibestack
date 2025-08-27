#!/usr/bin/env tsx
/**
 * Script to sync Better Auth local database to legacy schema remote Neon database
 * Maps between different table schemas and column names
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

async function syncBetterAuthAccounts(localClient: Client, remoteClient: Client) {
  console.log(`\n📊 Syncing accounts (Better Auth -> Legacy)...`);
  
  // Get all records from local Better Auth account table
  const localResult = await localClient.query(`SELECT * FROM account`);
  console.log(`  Found ${localResult.rows.length} local account records`);
  
  // Get existing IDs from remote accounts table
  const remoteIds = await remoteClient.query(`SELECT id FROM accounts`);
  const existingIds = new Set(remoteIds.rows.map(r => r.id));
  console.log(`  Found ${existingIds.size} remote account records`);
  
  let syncedCount = 0;
  
  // Insert unique records with schema mapping
  for (const record of localResult.rows) {
    if (existingIds.has(record.id)) continue;
    
    try {
      await remoteClient.query(
        `INSERT INTO accounts (
          id, user_id, provider_id, provider_account_id,
          access_token, refresh_token, id_token, 
          expires_at, token_type, scope, session_state,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
        ON CONFLICT (id) DO NOTHING`,
        [
          record.id,
          record.userId,
          record.providerId,
          record.accountId, // Better Auth accountId -> Legacy provider_account_id
          record.accessToken,
          record.refreshToken,
          record.idToken,
          record.accessTokenExpiresAt ? Math.floor(new Date(record.accessTokenExpiresAt).getTime() / 1000) : null,
          'Bearer', // Default token type
          record.scope,
          null, // session_state not used in Better Auth
          record.createdAt,
          record.updatedAt
        ]
      );
      syncedCount++;
    } catch (error: any) {
      console.error(`  ❌ Error inserting account:`, error.message);
      console.error(`     Record ID: ${record.id}`);
    }
  }
  
  console.log(`  ✅ Synced ${syncedCount} account records`);
  return syncedCount;
}

async function syncBetterAuthUsers(localClient: Client, remoteClient: Client) {
  console.log(`\n📊 Syncing users (Better Auth -> Legacy)...`);
  
  // Get all records from local Better Auth user table
  const localResult = await localClient.query(`SELECT * FROM "user"`);
  console.log(`  Found ${localResult.rows.length} local user records`);
  
  // Get existing IDs from remote users table
  const remoteIds = await remoteClient.query(`SELECT id FROM users`);
  const existingIds = new Set(remoteIds.rows.map(r => r.id));
  console.log(`  Found ${existingIds.size} remote user records`);
  
  let syncedCount = 0;
  
  // Insert unique records with schema mapping
  for (const record of localResult.rows) {
    if (existingIds.has(record.id)) continue;
    
    try {
      await remoteClient.query(
        `INSERT INTO users (
          id, name, email, email_verified, image, 
          is_super_admin, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        ON CONFLICT (id) DO NOTHING`,
        [
          record.id,
          record.name,
          record.email,
          record.emailVerified,
          record.image,
          record.role === 'admin' || record.role === 'super_admin', // Map role to is_super_admin
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

async function syncOrganizations(localClient: Client, remoteClient: Client) {
  console.log(`\n📊 Syncing organizations...`);
  
  const localResult = await localClient.query(`SELECT * FROM organizations`);
  console.log(`  Found ${localResult.rows.length} local organization records`);
  
  const remoteIds = await remoteClient.query(`SELECT id FROM organizations`);
  const existingIds = new Set(remoteIds.rows.map(r => r.id));
  console.log(`  Found ${existingIds.size} remote organization records`);
  
  let syncedCount = 0;
  
  for (const record of localResult.rows) {
    if (existingIds.has(record.id)) continue;
    
    try {
      await remoteClient.query(
        `INSERT INTO organizations (
          id, name, slug, plan, status, settings, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        ON CONFLICT (id) DO NOTHING`,
        [
          record.id,
          record.name,
          record.slug,
          record.plan || 'free',
          record.status || 'active',
          record.settings || '{}',
          record.created_at,
          record.updated_at
        ]
      );
      syncedCount++;
    } catch (error: any) {
      console.error(`  ❌ Error inserting organization:`, error.message);
      console.error(`     Record ID: ${record.id}`);
    }
  }
  
  console.log(`  ✅ Synced ${syncedCount} organization records`);
  return syncedCount;
}

async function syncOrganizationMembers(localClient: Client, remoteClient: Client) {
  console.log(`\n📊 Syncing organization members...`);
  
  const localResult = await localClient.query(`SELECT * FROM organization_members`);
  console.log(`  Found ${localResult.rows.length} local organization member records`);
  
  const remoteIds = await remoteClient.query(`SELECT id FROM organization_members`);
  const existingIds = new Set(remoteIds.rows.map(r => r.id));
  console.log(`  Found ${existingIds.size} remote organization member records`);
  
  let syncedCount = 0;
  
  for (const record of localResult.rows) {
    if (existingIds.has(record.id)) continue;
    
    try {
      await remoteClient.query(
        `INSERT INTO organization_members (
          id, organization_id, user_id, role, status, 
          joined_at, invited_by, invited_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
        ON CONFLICT (id) DO NOTHING`,
        [
          record.id,
          record.organization_id,
          record.user_id,
          record.role,
          record.status || 'active',
          record.joined_at,
          record.invited_by,
          record.invited_at,
          record.created_at,
          record.updated_at
        ]
      );
      syncedCount++;
    } catch (error: any) {
      console.error(`  ❌ Error inserting organization member:`, error.message);
      console.error(`     Record ID: ${record.id}`);
    }
  }
  
  console.log(`  ✅ Synced ${syncedCount} organization member records`);
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
    
    // Sync core auth tables with schema mapping
    await syncBetterAuthUsers(localClient, remoteClient);
    await syncBetterAuthAccounts(localClient, remoteClient);
    await syncOrganizations(localClient, remoteClient);
    await syncOrganizationMembers(localClient, remoteClient);
    
    console.log('\n✨ Better Auth to Legacy sync complete!');
    
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