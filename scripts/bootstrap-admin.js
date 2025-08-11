#!/usr/bin/env node

/**
 * Bootstrap admin user directly in database
 * Use this to create the first user on a fresh system
 */

const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const crypto = require('crypto');

// Configuration
const DB_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/vibestack_dev';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@vibestack.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.DEFAULT_ADMIN_PASSWORD || generateSecurePassword();
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin User';

function generateSecurePassword() {
  // Generate a secure random password if none provided
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  console.log('⚠️  No ADMIN_PASSWORD provided, generated:', password);
  return password;
}

async function createAdminUser() {
  const client = new Client({
    connectionString: DB_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id, email FROM users WHERE email = $1',
      [ADMIN_EMAIL]
    );

    if (existingUser.rows.length > 0) {
      console.log(`⚠️  User ${ADMIN_EMAIL} already exists`);
      return;
    }

    // Generate password hash
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    console.log('🔐 Password hash generated');

    // Generate UUIDs
    const userId = crypto.randomUUID();
    const accountId = crypto.randomUUID();

    // Start transaction
    await client.query('BEGIN');

    // Create user
    const userResult = await client.query(
      `INSERT INTO users (
        id, email, name, email_verified, role, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, NOW(), NOW()
      ) RETURNING id, email, name, role`,
      [userId, ADMIN_EMAIL, ADMIN_NAME, true, 'super_admin']
    );

    console.log('✅ User created:', userResult.rows[0]);

    // Create account (for credential provider)
    await client.query(
      `INSERT INTO accounts (
        id, user_id, account_id, provider_id, password, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, NOW(), NOW()
      )`,
      [accountId, userId, userId, 'credential', passwordHash]
    );

    console.log('✅ Account created for credential provider');

    // Commit transaction
    await client.query('COMMIT');

    console.log(`
========================================
✨ Admin user created successfully!
========================================
Email:    ${ADMIN_EMAIL}
Password: ${ADMIN_PASSWORD}
Role:     super_admin
========================================

You can now log in with these credentials.
    `);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  createAdminUser().catch(console.error);
}

module.exports = { createAdminUser };