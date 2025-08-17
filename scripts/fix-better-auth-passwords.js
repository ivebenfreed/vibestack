#!/usr/bin/env node

/**
 * Fix Better Auth Password Hashing
 * 
 * The issue: Our bcrypt hashing script failed because Better Auth expects
 * a different password storage format. This script uses Better Auth's 
 * own methods to properly set passwords.
 */

const { betterAuth } = require("better-auth");
const { NeonHTTPDialect } = require('kysely-neon-http');

// Better Auth configuration matching our server setup
const auth = betterAuth({
  database: {
    dialect: new NeonHTTPDialect({ 
      connectionString: 'postgres://postgres:postgres@localhost:5432/vibestack_dev' 
    }),
    type: "postgres"
  },
  secret: process.env.BETTER_AUTH_SECRET || "fallback-secret-for-dev",
  baseURL: "http://localhost:5173/api/auth",
  emailAndPassword: { 
    enabled: true,
    requireEmailVerification: false, // Disable for easier testing
    password: {
      minLength: 8,
      maxLength: 128
    }
  }
});

// Wide Corp users with their desired passwords
const wideCorpUsers = [
  {
    email: 'ceo@widecorp.com',
    name: 'Alice CEO',
    password: 'WideCorp2024!CEO',
    role: 'owner'
  },
  {
    email: 'cto@widecorp.com',
    name: 'Bob CTO',
    password: 'WideCorp2024!CTO',
    role: 'admin'
  },
  {
    email: 'pm1@widecorp.com',
    name: 'Carol PM',
    password: 'WideCorp2024!PM1',
    role: 'manager'
  },
  {
    email: 'pm2@widecorp.com',
    name: 'David PM',
    password: 'WideCorp2024!PM2',
    role: 'manager'
  },
  {
    email: 'dev1@widecorp.com',
    name: 'Eve Developer',
    password: 'WideCorp2024!DEV1',
    role: 'member'
  },
  {
    email: 'dev2@widecorp.com',
    name: 'Frank Developer',
    password: 'WideCorp2024!DEV2',
    role: 'member'
  },
  {
    email: 'designer@widecorp.com',
    name: 'Grace Designer',
    password: 'WideCorp2024!DESIGN',
    role: 'contributor'
  },
  {
    email: 'intern@widecorp.com',
    name: 'Henry Intern',
    password: 'WideCorp2024!INTERN',
    role: 'viewer'
  }
];

async function fixBetterAuthPasswords() {
  console.log('🔐 Better Auth Password Fix Tool');
  console.log('================================');
  console.log('');
  console.log('🎯 Goal: Use Better Auth methods to properly set passwords');
  console.log('');

  let successCount = 0;
  const results = [];

  for (const user of wideCorpUsers) {
    console.log(`\n🔧 Processing ${user.role.toUpperCase()}: ${user.name} (${user.email})...`);
    
    try {
      // Method 1: Try to create user with Better Auth signUp
      console.log('   Method 1: Attempting Better Auth signUp...');
      
      const signUpResult = await auth.api.signUpEmail({
        body: {
          email: user.email,
          password: user.password,
          name: user.name
        }
      });

      if (signUpResult) {
        console.log('   ✅ User created successfully via Better Auth signUp');
        results.push({ ...user, success: true, method: 'signUp' });
        successCount++;
        continue;
      }

    } catch (signUpError) {
      console.log(`   ❌ SignUp failed: ${signUpError.message}`);
      
      // Method 2: User might already exist, try to update password
      console.log('   Method 2: User exists, attempting password reset...');
      
      try {
        // Use Better Auth's internal password hashing
        const hashedPassword = await auth.crypto.hash(user.password);
        console.log('   🔑 Password hashed using Better Auth crypto');
        
        // Update the account table directly with Better Auth format
        await auth.db.query(`
          UPDATE account 
          SET password = $1, "updatedAt" = NOW() 
          WHERE "userId" = (SELECT id FROM "user" WHERE email = $2) 
          AND "providerId" = 'credential'
        `, [hashedPassword, user.email]);
        
        console.log('   ✅ Password updated in account table with Better Auth hash');
        results.push({ ...user, success: true, method: 'passwordUpdate' });
        successCount++;
        
      } catch (updateError) {
        console.log(`   ❌ Password update failed: ${updateError.message}`);
        
        // Method 3: Try to delete and recreate
        console.log('   Method 3: Attempting delete and recreate...');
        
        try {
          // Clean up existing user completely
          await auth.db.query('DELETE FROM account WHERE "userId" = (SELECT id FROM "user" WHERE email = $1)', [user.email]);
          await auth.db.query('DELETE FROM "user" WHERE email = $1', [user.email]);
          
          console.log('   🗑️ Existing user data cleaned up');
          
          // Create fresh user
          const createResult = await auth.api.signUpEmail({
            body: {
              email: user.email,
              password: user.password,
              name: user.name
            }
          });
          
          if (createResult) {
            console.log('   ✅ User recreated successfully');
            results.push({ ...user, success: true, method: 'recreate' });
            successCount++;
          }
          
        } catch (recreateError) {
          console.log(`   ❌ Recreate failed: ${recreateError.message}`);
          results.push({ ...user, success: false, error: recreateError.message });
        }
      }
    }
  }

  console.log(`\n📊 Better Auth Password Fix Complete: ${successCount}/${wideCorpUsers.length} successful`);
  
  if (successCount > 0) {
    console.log('\n✅ WORKING CREDENTIALS:');
    console.log('=======================');
    
    results.filter(r => r.success).forEach(user => {
      console.log(`\n📧 ${user.email}`);
      console.log(`   Password: ${user.password}`);
      console.log(`   Method: ${user.method}`);
      console.log(`   Role: ${user.role}`);
    });

    console.log('\n🧪 TESTING:');
    console.log('===========');
    console.log('1. Try logging in at: http://localhost:5173/sign-in');
    console.log('2. Use any of the credentials above');
    console.log('3. Navigate to: http://localhost:5173/debug/livestore-test');
    console.log('');
    console.log('🎉 Better Auth passwords are now properly formatted!');
  }

  return results;
}

// Run the fix
fixBetterAuthPasswords().catch(error => {
  console.error('❌ Better Auth password fix failed:', error);
  process.exit(1);
});