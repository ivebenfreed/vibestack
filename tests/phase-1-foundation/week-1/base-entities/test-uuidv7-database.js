#!/usr/bin/env node

/**
 * Standalone test for UUIDv7 database function
 * Tests the generate_uuidv7() function directly in PostgreSQL
 */

import pg from 'pg';

const { Client } = pg;

async function testUUIDv7Generation() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/vibestack_dev'
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');

    // Test 1: Generate multiple UUIDs and check format
    console.log('\n🧪 Test 1: Generate UUIDs and validate format');
    const result = await client.query(`
      SELECT 
        generate_uuidv7() as uuid1,
        generate_uuidv7() as uuid2,
        generate_uuidv7() as uuid3,
        generate_uuidv7() as uuid4,
        generate_uuidv7() as uuid5
    `);

    const uuids = Object.values(result.rows[0]);
    console.log('Generated UUIDs:', uuids);

    // Validate UUID format (version 7)
    const uuidv7Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    let allValid = true;
    for (const uuid of uuids) {
      const isValid = uuidv7Regex.test(uuid);
      console.log(`  ${uuid}: ${isValid ? '✅ Valid UUIDv7' : '❌ Invalid format'}`);
      if (!isValid) allValid = false;
    }

    if (allValid) {
      console.log('✅ All UUIDs have valid UUIDv7 format');
    } else {
      console.log('❌ Some UUIDs have invalid format');
      process.exit(1);
    }

    // Test 2: Check timestamp ordering
    console.log('\n🧪 Test 2: Validate timestamp ordering');
    const timestamps = uuids.map(uuid => {
      // Extract timestamp from first 12 hex characters (48 bits)
      const hex = uuid.replace(/-/g, '').substring(0, 12);
      return parseInt(hex, 16);
    });

    console.log('Extracted timestamps:', timestamps);

    let isOrdered = true;
    for (let i = 1; i < timestamps.length; i++) {
      if (timestamps[i] < timestamps[i - 1]) {
        isOrdered = false;
        break;
      }
    }

    if (isOrdered) {
      console.log('✅ UUIDs are timestamp-ordered');
    } else {
      console.log('❌ UUIDs are not properly timestamp-ordered');
      process.exit(1);
    }

    // Test 3: Test integration with existing User table
    console.log('\n🧪 Test 3: Test with User table (using gen_random_uuid for now)');
    
    // First check current default
    const userTableInfo = await client.query(`
      SELECT column_default 
      FROM information_schema.columns 
      WHERE table_name = 'user' AND column_name = 'id'
    `);
    
    console.log('Current User.id default:', userTableInfo.rows[0]?.column_default);

    // Create a test user to see current UUID generation
    const testUser = await client.query(`
      INSERT INTO "user" (name, email, "emailVerified", role)
      VALUES ('Test User', 'test-${Date.now()}@example.com', false, 'member')
      RETURNING id, "createdAt"
    `);

    console.log('Created test user:', testUser.rows[0]);
    console.log('✅ User creation works with current UUID generation');

    // Test 4: Verify UUIDv7 function performance
    console.log('\n🧪 Test 4: Performance test');
    const startTime = Date.now();
    
    await client.query(`
      SELECT generate_uuidv7() FROM generate_series(1, 1000)
    `);
    
    const endTime = Date.now();
    console.log(`✅ Generated 1000 UUIDs in ${endTime - startTime}ms`);

    console.log('\n🎉 All UUIDv7 tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the test
testUUIDv7Generation();