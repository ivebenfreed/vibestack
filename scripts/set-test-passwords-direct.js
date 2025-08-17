#!/usr/bin/env node

/**
 * Direct Database Password Setting Script
 * 
 * Since test accounts have no passwords, this script will:
 * 1. Hash passwords using the same method as Better Auth
 * 2. Insert password records directly into the database
 * 3. Provide immediate access without email flows
 */

const { Client } = require('pg');
const bcrypt = require('bcryptjs');

// Database connection
const client = new Client({
  connectionString: 'postgres://postgres:postgres@localhost:5432/vibestack_dev'
});

// Test accounts to set passwords for
const testAccounts = [
  {
    email: 'ceo@widecorp.com',
    name: 'Alice CEO',
    password: 'WideCorp2024!CEO',
    org: 'Wide Corp Solutions'
  },
  {
    email: 'cto@widecorp.com',
    name: 'Bob CTO', 
    password: 'WideCorp2024!CTO',
    org: 'Wide Corp Solutions'
  },
  {
    email: 'admin@techflow.solutions',
    name: 'TechFlow Admin',
    password: 'TechFlow2024!Admin',
    org: 'TechFlow Solutions'
  }
];

async function hashPassword(password) {
  // Use bcrypt with salt rounds (Better Auth typically uses 10-12 rounds)
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

async function getUserByEmail(email) {
  const result = await client.query('SELECT id, email, name, password FROM "user" WHERE email = $1', [email]);
  return result.rows[0] || null;
}

async function setUserPassword(userId, hashedPassword) {
  // Update the user's password field
  await client.query('UPDATE "user" SET password = $1, "updatedAt" = NOW() WHERE id = $2', [hashedPassword, userId]);
}

async function createAccountRecord(userId, hashedPassword) {
  // Check if account record exists
  const existingAccount = await client.query('SELECT id FROM account WHERE "userId" = $1 AND "providerId" = $2', [userId, 'credential']);
  
  if (existingAccount.rows.length === 0) {
    // Create account record for credential provider
    const accountId = `account_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await client.query(`
      INSERT INTO account (id, "userId", "accountId", "providerId", "accessToken", "refreshToken", password, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    `, [accountId, userId, userId, 'credential', null, null, hashedPassword]);
    
    console.log(`  Created account record for user ${userId}`);
  } else {
    // Update existing account record
    await client.query('UPDATE account SET password = $1, "updatedAt" = NOW() WHERE "userId" = $2 AND "providerId" = $3', [hashedPassword, userId, 'credential']);
    console.log(`  Updated account record for user ${userId}`);
  }
}

async function testCredentials(email, password) {
  console.log(`\n🧪 Testing credentials for ${email}...`);
  
  try {
    const response = await fetch('http://localhost:8787/api/auth/sign-in', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ Login successful for ${email}`);
      return true;
    } else {
      console.log(`❌ Login failed for ${email}:`, result);
      return false;
    }
  } catch (error) {
    console.log(`❌ Login test error for ${email}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🔐 Direct Database Password Setting Script');
  console.log('==========================================');
  console.log('');
  
  try {
    await client.connect();
    console.log('✅ Connected to database');

    let successCount = 0;
    const results = [];

    for (const account of testAccounts) {
      console.log(`\n🔐 Setting password for ${account.email} (${account.name})...`);
      
      try {
        // Get user from database
        const user = await getUserByEmail(account.email);
        if (!user) {
          console.log(`❌ User not found: ${account.email}`);
          results.push({ ...account, success: false, error: 'User not found' });
          continue;
        }

        console.log(`  Found user: ${user.name} (${user.id})`);

        // Hash the password
        const hashedPassword = await hashPassword(account.password);
        console.log(`  Password hashed successfully`);

        // Set password in user table
        await setUserPassword(user.id, hashedPassword);
        console.log(`  Password updated in user table`);

        // Create/update account record
        await createAccountRecord(user.id, hashedPassword);

        console.log(`✅ Password set successfully for ${account.email}`);
        results.push({ ...account, success: true, userId: user.id });
        successCount++;

      } catch (error) {
        console.log(`❌ Failed to set password for ${account.email}:`, error.message);
        results.push({ ...account, success: false, error: error.message });
      }
    }

    console.log(`\n📊 Password Setting Complete: ${successCount}/${testAccounts.length} successful`);
    
    if (successCount > 0) {
      console.log('\n🔐 New Test Credentials:');
      console.log('=======================');
      
      results.filter(r => r.success).forEach(result => {
        console.log(`\n✅ ${result.name} (${result.org})`);
        console.log(`   Email: ${result.email}`);
        console.log(`   Password: ${result.password}`);
      });

      console.log('\n🧪 Testing login credentials...');
      
      // Test each successful account
      for (const result of results.filter(r => r.success)) {
        await testCredentials(result.email, result.password);
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n✅ All done! You can now login with the new credentials.');

  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('📪 Database connection closed');
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

// Run the script
main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});