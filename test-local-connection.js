#!/usr/bin/env node

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testLocalNeonProxy() {
  console.log('Testing local Neon HTTP proxy connection...\n');

  try {
    // Test the proxy endpoint
    const response = await fetch('http://db.localtest.me:4444/sql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'SELECT version(), current_database(), current_user',
        params: []
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Successfully connected to local Neon proxy!');
    console.log('\nQuery results:');
    console.log(JSON.stringify(data, null, 2));

    // Test another query to check tables
    const tablesResponse = await fetch('http://db.localtest.me:4444/sql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename LIMIT 10",
        params: []
      })
    });

    const tablesData = await tablesResponse.json();
    console.log('\n📋 Tables in database:');
    if (tablesData.rows) {
      tablesData.rows.forEach(row => {
        console.log(`  - ${row.tablename}`);
      });
    }

  } catch (error) {
    console.error('❌ Error connecting to local Neon proxy:', error.message);
    console.error('\nMake sure:');
    console.error('1. Docker containers are running (docker compose ps)');
    console.error('2. Neon proxy is accessible on port 4444');
    console.error('3. PostgreSQL is running on port 5432');
  }
}

testLocalNeonProxy();