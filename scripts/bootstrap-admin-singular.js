#!/usr/bin/env node

/**
 * Bootstrap admin user directly in database with singular table names
 */

const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const crypto = require('crypto');

// Configuration
const DB_URL = process.env.LOCAL_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/vibestack_dev';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@vibestack.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin User';

async function createAdminUser() {
  const client = new Client({
    connectionString: DB_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id, email FROM "user" WHERE email = $1',
      [ADMIN_EMAIL]
    );

    if (existingUser.rows.length > 0) {
      console.log(`⚠️  User ${ADMIN_EMAIL} already exists`);
      return;
    }

    // Generate password hash
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const userId = crypto.randomUUID();
    const accountId = crypto.randomUUID();

    // Create user
    await client.query(
      `INSERT INTO "user" (id, email, name, email_verified, is_super_admin, created_at, updated_at)
       VALUES ($1, $2, $3, true, true, NOW(), NOW())`,
      [userId, ADMIN_EMAIL, ADMIN_NAME]
    );
    console.log(`✅ Created user: ${ADMIN_EMAIL}`);

    // Create account for authentication
    await client.query(
      `INSERT INTO account (id, provider_id, provider_account_id, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [accountId, 'credential', ADMIN_EMAIL]
    );
    console.log(`✅ Created account for user`);

    // Link user to account
    await client.query(
      `UPDATE "user" SET account_id = $1 WHERE id = $2`,
      [accountId, userId]
    );

    console.log(`
✅ Admin user created successfully!
   Email: ${ADMIN_EMAIL}
   Password: ${ADMIN_PASSWORD}
   
   You can now login with these credentials.
    `);

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createAdminUser();