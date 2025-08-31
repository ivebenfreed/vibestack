#!/usr/bin/env tsx

import { readFileSync } from 'fs';
import { Client } from '@neondatabase/serverless';

async function runMigration() {
  const databaseUrl = "postgres://postgres:postgres@db.localtest.me:4444/vibestack_dev";
  console.log('🔍 Using DATABASE_URL:', databaseUrl);
  
  const client = new Client({ connectionString: databaseUrl });
  
  try {
    await client.connect();
    console.log('🔗 Connected to database');
    
    // Read migration file
    const migrationSQL = readFileSync('./src/migrations/server/006_wal_rls_integration.sql', 'utf8');
    console.log('📄 Migration file loaded (' + migrationSQL.length + ' characters)');
    
    // Run migration
    console.log('🚀 Running WAL RLS integration migration...');
    const result = await client.query(migrationSQL);
    console.log('✅ Migration completed successfully');
    
  } catch (error) {
    console.error('❌ Migration failed:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();