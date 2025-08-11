#!/usr/bin/env node

/**
 * Create multiple test users for development
 */

const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const crypto = require('crypto');

const DB_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/vibestack_dev';

// Use environment variable or generate random passwords
const DEFAULT_TEST_PASSWORD = process.env.TEST_USER_PASSWORD || process.env.DEFAULT_TEST_PASSWORD || generateTestPassword();

function generateTestPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

const TEST_USERS = [
  { email: 'alice@example.com', password: DEFAULT_TEST_PASSWORD, name: 'Alice Johnson', role: 'member' },
  { email: 'bob@example.com', password: DEFAULT_TEST_PASSWORD, name: 'Bob Smith', role: 'member' },
  { email: 'charlie@example.com', password: DEFAULT_TEST_PASSWORD, name: 'Charlie Brown', role: 'viewer' },
  { email: 'demo@vibestack.com', password: DEFAULT_TEST_PASSWORD, name: 'Demo User', role: 'member' },
  { email: 'playwright@test.com', password: DEFAULT_TEST_PASSWORD, name: 'Playwright Test', role: 'member' },
];

async function createUser(client, userData) {
  try {
    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id, email FROM users WHERE email = $1',
      [userData.email]
    );

    if (existingUser.rows.length > 0) {
      console.log(`⚠️  User ${userData.email} already exists`);
      return false;
    }

    // Generate password hash
    const passwordHash = await bcrypt.hash(userData.password, 10);

    // Generate UUIDs
    const userId = crypto.randomUUID();
    const accountId = crypto.randomUUID();

    // Start transaction
    await client.query('BEGIN');

    // Create user
    await client.query(
      `INSERT INTO users (
        id, email, name, email_verified, role, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, NOW(), NOW()
      )`,
      [userId, userData.email, userData.name, true, userData.role]
    );

    // Create account (for credential provider)
    await client.query(
      `INSERT INTO accounts (
        id, user_id, account_id, provider_id, password, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, NOW(), NOW()
      )`,
      [accountId, userId, userId, 'credential', passwordHash]
    );

    // Commit transaction
    await client.query('COMMIT');

    console.log(`✅ Created user: ${userData.email} (${userData.name})`);
    return true;

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Error creating user ${userData.email}:`, error.message);
    return false;
  }
}

async function createTestUsers() {
  const client = new Client({
    connectionString: DB_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');
    console.log('');
    console.log('Creating test users...');
    console.log('======================');

    let created = 0;
    for (const userData of TEST_USERS) {
      if (await createUser(client, userData)) {
        created++;
      }
    }

    console.log('');
    console.log('======================');
    console.log(`✨ Created ${created} test users`);
    console.log('');
    console.log('Test credentials:');
    console.log('-----------------');
    TEST_USERS.forEach(user => {
      console.log(`${user.email} / ${user.password}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  createTestUsers().catch(console.error);
}

module.exports = { createTestUsers };