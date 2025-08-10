#!/usr/bin/env tsx
/**
 * Sync change_history table from remote database to local
 * This allows us to test catchup sync with real change history data
 */

import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { neon } from '@neondatabase/serverless';
import pg from 'pg';
import { change_history } from '../packages/dataforge/src/generated/drizzle-schema.js';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../apps/server/.dev.vars') });

const REMOTE_DB_URL = process.env.DATABASE_URL;
const LOCAL_DB_URL = process.env.DIRECT_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/vibestack_dev';

if (!REMOTE_DB_URL) {
  console.error('❌ DATABASE_URL not found in environment');
  process.exit(1);
}

async function syncChangeHistory() {
  console.log('🔄 Syncing change_history from remote to local...\n');
  
  try {
    // Connect to remote database (Neon)
    console.log('📡 Connecting to remote database...');
    const remoteClient = neon(REMOTE_DB_URL);
    const remoteDb = drizzleNeon(remoteClient);
    
    // Connect to local database
    console.log('💾 Connecting to local database...');
    const { Client } = pg;
    const localClient = new Client({
      connectionString: LOCAL_DB_URL
    });
    await localClient.connect();
    const localDb = drizzlePg(localClient);
    
    // Get count from remote
    const remoteCountResult = await remoteDb.select({ count: sql`count(*)::int` })
      .from(change_history);
    const remoteCount = remoteCountResult[0]?.count || 0;
    console.log(`📊 Remote change_history has ${remoteCount} records`);
    
    // Get count from local
    const localCountResult = await localDb.select({ count: sql`count(*)::int` })
      .from(change_history);
    const localCount = localCountResult[0]?.count || 0;
    console.log(`📊 Local change_history has ${localCount} records`);
    
    if (remoteCount === 0) {
      console.log('ℹ️  No records to sync');
      await localClient.end();
      return;
    }
    
    // Clear local change_history
    console.log('\n🗑️  Clearing local change_history...');
    await localDb.delete(change_history);
    
    // Fetch all records from remote in batches
    const BATCH_SIZE = 1000;
    let offset = 0;
    let totalSynced = 0;
    
    console.log('\n📥 Fetching and inserting records...');
    
    while (offset < remoteCount) {
      // Fetch batch from remote
      const records = await remoteDb.select()
        .from(change_history)
        .orderBy(change_history.lsn)
        .limit(BATCH_SIZE)
        .offset(offset);
      
      if (records.length === 0) break;
      
      // Insert batch into local
      await localDb.insert(change_history).values(records);
      
      totalSynced += records.length;
      console.log(`  ✓ Synced ${totalSynced}/${remoteCount} records`);
      
      offset += BATCH_SIZE;
    }
    
    // Verify final count
    const finalCountResult = await localDb.select({ count: sql`count(*)::int` })
      .from(change_history);
    const finalCount = finalCountResult[0]?.count || 0;
    
    console.log(`\n✅ Successfully synced ${finalCount} records to local change_history`);
    
    // Show LSN range
    const lsnRangeResult = await localDb.select({
      minLsn: sql`min(lsn)`,
      maxLsn: sql`max(lsn)`
    }).from(change_history);
    
    if (lsnRangeResult[0]) {
      console.log(`📍 LSN range: ${lsnRangeResult[0].minLsn} to ${lsnRangeResult[0].maxLsn}`);
    }
    
    await localClient.end();
    
  } catch (error) {
    console.error('❌ Error syncing change_history:', error);
    process.exit(1);
  }
}

// Run the sync
syncChangeHistory();