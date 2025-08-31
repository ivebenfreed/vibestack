#!/usr/bin/env node

/**
 * Test script to verify postgres.js connection to local database
 * This will test the connection before we integrate with Kysely
 */

import postgres from 'postgres';

const connectionString = 'postgres://postgres:postgres@localhost:5432/vibestack_dev';

async function testPostgresConnection() {
  console.log('🔌 Testing postgres.js connection...');
  console.log('📍 Connection string:', connectionString.replace(/password:[^@]+/, 'password:***'));
  
  const sql = postgres(connectionString, {
    max: 5, // Connection pool limit for Cloudflare Workers
    fetch_types: false, // Reduce latency
    prepare: true, // Enable prepared statements
    idle_timeout: 0,
    connect_timeout: 10,
  });

  try {
    // Test basic connection
    console.log('\n🔍 Testing basic connection...');
    const result = await sql`SELECT NOW() as current_time, version() as pg_version`;
    console.log('✅ Connection successful!');
    console.log('⏰ Database time:', result[0].current_time);
    console.log('🗄️  PostgreSQL version:', result[0].pg_version.split(' ')[0]);

    // Test table access
    console.log('\n🏗️  Testing table access...');
    const tables = await sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
      LIMIT 10
    `;
    console.log(`📋 Found ${tables.length} tables:`, tables.map(t => t.tablename).join(', '));

    // Test user table specifically (common in vibestack)
    console.log('\n👥 Testing user table access...');
    try {
      const userCount = await sql`SELECT COUNT(*) as count FROM "user"`;
      console.log(`📊 User table has ${userCount[0].count} records`);
    } catch (error) {
      console.log('⚠️  User table access:', error.message);
    }

    // Test prepared statement performance
    console.log('\n⚡ Testing prepared statement performance...');
    const start = Date.now();
    for (let i = 0; i < 5; i++) {
      await sql`SELECT ${i} as test_value`;
    }
    const duration = Date.now() - start;
    console.log(`🚀 5 prepared statements took ${duration}ms (avg: ${(duration/5).toFixed(1)}ms)`);

    // Test transaction
    console.log('\n🔄 Testing transaction support...');
    await sql.begin(async sql => {
      const result = await sql`SELECT 'transaction_test' as message`;
      console.log('✅ Transaction test:', result[0].message);
    });

    console.log('\n🎉 All tests passed! postgres.js is working correctly.');
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    console.error('🔧 Check that PostgreSQL is running on localhost:5432');
    console.error('🔧 Check that database "vibestack_dev" exists');
    console.error('🔧 Check that user "postgres" has access');
    process.exit(1);
  } finally {
    await sql.end();
    console.log('🔌 Connection closed');
  }
}

// Run the test
testPostgresConnection().catch(console.error);