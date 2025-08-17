#!/usr/bin/env node

/**
 * Complete Wide Corp Password Setting Script
 * 
 * Sets passwords for ALL Wide Corp users across ALL role types:
 * - Owner (CEO)
 * - Admin (CTO) 
 * - Manager (2 PMs)
 * - Member (2 Developers)
 * - Contributor (Designer)
 * - Viewer (Intern)
 */

const { Client } = require('pg');
const bcrypt = require('bcryptjs');

// Database connection
const client = new Client({
  connectionString: 'postgres://postgres:postgres@localhost:5432/vibestack_dev'
});

// ALL Wide Corp users with role-specific passwords
const wideCorpUsers = [
  {
    email: 'ceo@widecorp.com',
    name: 'Alice CEO',
    role: 'owner',
    password: 'WideCorp2024!CEO',
    department: 'Executive'
  },
  {
    email: 'cto@widecorp.com',
    name: 'Bob CTO',
    role: 'admin', 
    password: 'WideCorp2024!CTO',
    department: 'Engineering'
  },
  {
    email: 'pm1@widecorp.com',
    name: 'Carol PM',
    role: 'manager',
    password: 'WideCorp2024!PM1',
    department: 'Project Management'
  },
  {
    email: 'pm2@widecorp.com',
    name: 'David PM',
    role: 'manager',
    password: 'WideCorp2024!PM2', 
    department: 'Project Management'
  },
  {
    email: 'dev1@widecorp.com',
    name: 'Eve Developer',
    role: 'member',
    password: 'WideCorp2024!DEV1',
    department: 'Engineering'
  },
  {
    email: 'dev2@widecorp.com',
    name: 'Frank Developer', 
    role: 'member',
    password: 'WideCorp2024!DEV2',
    department: 'Engineering'
  },
  {
    email: 'designer@widecorp.com',
    name: 'Grace Designer',
    role: 'contributor',
    password: 'WideCorp2024!DESIGN',
    department: 'Design'
  },
  {
    email: 'intern@widecorp.com',
    name: 'Henry Intern',
    role: 'viewer',
    password: 'WideCorp2024!INTERN',
    department: 'Various'
  }
];

async function hashPassword(password) {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

async function getUserByEmail(email) {
  const result = await client.query('SELECT id, email, name, password FROM "user" WHERE email = $1', [email]);
  return result.rows[0] || null;
}

async function setUserPassword(userId, hashedPassword) {
  await client.query('UPDATE "user" SET password = $1, "updatedAt" = NOW() WHERE id = $2', [hashedPassword, userId]);
}

async function createOrUpdateAccountRecord(userId, hashedPassword) {
  const existingAccount = await client.query('SELECT id FROM account WHERE "userId" = $1 AND "providerId" = $2', [userId, 'credential']);
  
  if (existingAccount.rows.length === 0) {
    const accountId = `account_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await client.query(`
      INSERT INTO account (id, "userId", "accountId", "providerId", "accessToken", "refreshToken", password, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    `, [accountId, userId, userId, 'credential', null, null, hashedPassword]);
    
    console.log(`    Created account record`);
  } else {
    await client.query('UPDATE account SET password = $1, "updatedAt" = NOW() WHERE "userId" = $2 AND "providerId" = $3', [hashedPassword, userId, 'credential']);
    console.log(`    Updated account record`);
  }
}

async function verifyOrgMembership(userId) {
  const result = await client.query(`
    SELECT o.name as org_name, om.role 
    FROM organizations o 
    JOIN organization_members om ON o.id = om.organization_id 
    WHERE om.user_id = $1 AND o.name = 'Wide Corp Solutions'
  `, [userId]);
  
  return result.rows[0] || null;
}

async function main() {
  console.log('🔐 Complete Wide Corp Password Setting Script');
  console.log('=============================================');
  console.log('');
  console.log('Setting passwords for ALL Wide Corp users across ALL roles:');
  
  wideCorpUsers.forEach(user => {
    console.log(`  • ${user.role.toUpperCase()}: ${user.name} (${user.email})`);
  });
  
  console.log('');
  
  try {
    await client.connect();
    console.log('✅ Connected to database');

    let successCount = 0;
    const results = [];

    for (const userInfo of wideCorpUsers) {
      console.log(`\n🔐 Setting password for ${userInfo.role.toUpperCase()}: ${userInfo.name}...`);
      
      try {
        // Get user from database
        const user = await getUserByEmail(userInfo.email);
        if (!user) {
          console.log(`❌ User not found: ${userInfo.email}`);
          results.push({ ...userInfo, success: false, error: 'User not found' });
          continue;
        }

        console.log(`  Found user: ${user.name} (${user.id})`);

        // Verify org membership and role
        const membership = await verifyOrgMembership(user.id);
        if (!membership) {
          console.log(`❌ User not in Wide Corp Solutions: ${userInfo.email}`);
          results.push({ ...userInfo, success: false, error: 'Not in Wide Corp' });
          continue;
        }

        console.log(`  Verified: ${membership.role} role in ${membership.org_name}`);

        // Hash the password
        const hashedPassword = await hashPassword(userInfo.password);
        console.log(`  Password hashed successfully`);

        // Set password in user table
        await setUserPassword(user.id, hashedPassword);
        console.log(`  Password updated in user table`);

        // Create/update account record
        await createOrUpdateAccountRecord(user.id, hashedPassword);

        console.log(`✅ Password set successfully for ${userInfo.role}: ${userInfo.name}`);
        results.push({ ...userInfo, success: true, userId: user.id, actualRole: membership.role });
        successCount++;

      } catch (error) {
        console.log(`❌ Failed to set password for ${userInfo.email}:`, error.message);
        results.push({ ...userInfo, success: false, error: error.message });
      }
    }

    console.log(`\n📊 Password Setting Complete: ${successCount}/${wideCorpUsers.length} successful`);
    
    if (successCount > 0) {
      console.log('\n🔐 Complete Wide Corp Credentials by Role:');
      console.log('==========================================');
      
      // Group by role for better presentation
      const roleOrder = ['owner', 'admin', 'manager', 'member', 'contributor', 'viewer'];
      
      roleOrder.forEach(roleType => {
        const roleUsers = results.filter(r => r.success && r.role === roleType);
        if (roleUsers.length > 0) {
          console.log(`\n📋 ${roleType.toUpperCase()} ROLE:`);
          roleUsers.forEach(user => {
            console.log(`   Email: ${user.email}`);
            console.log(`   Name: ${user.name}`);
            console.log(`   Password: ${user.password}`);
            console.log(`   Department: ${user.department}`);
            console.log('');
          });
        }
      });

      console.log('\n🎯 Permission Testing Matrix:');
      console.log('=============================');
      console.log('Owner (CEO): Full org management, billing, user management');
      console.log('Admin (CTO): Technical admin, user management, no billing');
      console.log('Manager (PMs): Project management, team oversight, limited admin');
      console.log('Member (Devs): Project work, task management, no admin access');
      console.log('Contributor (Designer): Limited project access, specific contributions');
      console.log('Viewer (Intern): Read-only access, minimal permissions');

      console.log('\n🧪 Testing URLs:');
      console.log('================');
      console.log('Login: http://localhost:5173/sign-in');
      console.log('Admin Debug: http://localhost:5173/debug/livestore-test');
      console.log('Simple Debug: http://localhost:5173/debug/livestore-test-simple');
    }

    console.log('\n✅ All Wide Corp users now have working credentials!');
    console.log('🚀 Ready for comprehensive role-based permission testing!');

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