#!/usr/bin/env node

/**
 * Efficient Test Password Reset Script
 * 
 * Since test accounts have no passwords set, this script will:
 * 1. Use Better Auth API to set passwords for test accounts
 * 2. Provide clean, known passwords for migration testing
 * 3. Avoid email reset links by using direct API calls
 */

const readline = require('readline');

// Test accounts to reset
const testAccounts = [
  {
    email: 'ceo@widecorp.com',
    name: 'Alice CEO (Wide Corp Owner)',
    org: 'Wide Corp Solutions',
    newPassword: 'WideCorp2024!CEO'
  },
  {
    email: 'cto@widecorp.com', 
    name: 'Bob CTO (Wide Corp Admin)',
    org: 'Wide Corp Solutions',
    newPassword: 'WideCorp2024!CTO'
  },
  {
    email: 'admin@techflow.solutions',
    name: 'TechFlow Admin',
    org: 'TechFlow Solutions',
    newPassword: 'TechFlow2024!Admin'
  }
];

const API_BASE = 'http://localhost:8787/api/auth';

async function makeAuthRequest(endpoint, data) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    return { success: response.ok, data: result, status: response.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function setPasswordDirectly(email, password) {
  console.log(`\n🔐 Setting password for ${email}...`);
  
  // For accounts with no existing password, we need to use a different approach
  // Let's try the sign-up flow to set the initial password
  const signupResult = await makeAuthRequest('/sign-up', {
    email: email,
    password: password,
    name: testAccounts.find(acc => acc.email === email)?.name.split(' (')[0] || 'Test User'
  });

  if (signupResult.success) {
    console.log(`✅ Password set successfully for ${email}`);
    return true;
  } else if (signupResult.data?.code === 'USER_EXISTS') {
    console.log(`ℹ️  User ${email} already exists, trying password reset...`);
    
    // Try password reset flow
    const resetResult = await makeAuthRequest('/forget-password', {
      email: email
    });
    
    if (resetResult.success) {
      console.log(`📧 Password reset initiated for ${email}`);
      console.log(`   You'll need to check logs for the reset token/URL`);
      return true;
    } else {
      console.log(`❌ Password reset failed for ${email}:`, resetResult.data);
      return false;
    }
  } else {
    console.log(`❌ Failed to set password for ${email}:`, signupResult.data);
    return false;
  }
}

async function testLogin(email, password) {
  console.log(`\n🧪 Testing login for ${email}...`);
  
  const loginResult = await makeAuthRequest('/sign-in', {
    email: email,
    password: password
  });

  if (loginResult.success) {
    console.log(`✅ Login successful for ${email}`);
    return true;
  } else {
    console.log(`❌ Login failed for ${email}:`, loginResult.data);
    return false;
  }
}

async function main() {
  console.log('🔑 VibeStack Test Password Reset Script');
  console.log('=====================================');
  console.log('');
  console.log('This script will set known passwords for test accounts:');
  testAccounts.forEach(acc => {
    console.log(`  • ${acc.email} (${acc.org})`);
  });
  console.log('');

  // Ask for confirmation
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const confirm = await new Promise(resolve => {
    rl.question('Continue? (y/N): ', answer => {
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });

  rl.close();

  if (!confirm) {
    console.log('❌ Aborted');
    return;
  }

  console.log('\n🚀 Starting password reset process...');

  let successCount = 0;
  const results = [];

  // Process each account
  for (const account of testAccounts) {
    const success = await setPasswordDirectly(account.email, account.newPassword);
    results.push({ ...account, success });
    if (success) successCount++;
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n📊 Password Reset Complete: ${successCount}/${testAccounts.length} successful`);
  console.log('\n🔐 New Credentials:');
  console.log('==================');

  results.forEach(result => {
    if (result.success) {
      console.log(`\n✅ ${result.name}`);
      console.log(`   Email: ${result.email}`);
      console.log(`   Password: ${result.newPassword}`);
      console.log(`   Organization: ${result.org}`);
    } else {
      console.log(`\n❌ ${result.name} - Failed to set password`);
    }
  });

  console.log('\n🧪 Testing login for successful accounts...');

  for (const result of results.filter(r => r.success)) {
    await testLogin(result.email, result.newPassword);
  }

  console.log('\n✅ Password reset process complete!');
  console.log('\n📋 Next steps:');
  console.log('  1. Test login with the new credentials');
  console.log('  2. Verify organization access');
  console.log('  3. Update test documentation with new passwords');
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