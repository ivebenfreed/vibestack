#!/usr/bin/env node

/**
 * Quick Role Login Validation Script
 * 
 * Tests login for key roles to verify credentials are working
 */

const API_BASE = 'http://localhost:5173/api/auth'; // Through Vite proxy

const testAccounts = [
  {
    role: 'Owner',
    email: 'ceo@widecorp.com',
    password: 'WideCorp2024!CEO',
    name: 'Alice CEO'
  },
  {
    role: 'Admin', 
    email: 'cto@widecorp.com',
    password: 'WideCorp2024!CTO',
    name: 'Bob CTO'
  },
  {
    role: 'Manager',
    email: 'pm1@widecorp.com', 
    password: 'WideCorp2024!PM1',
    name: 'Carol PM'
  },
  {
    role: 'Member',
    email: 'dev1@widecorp.com',
    password: 'WideCorp2024!DEV1',
    name: 'Eve Developer'
  },
  {
    role: 'Viewer',
    email: 'intern@widecorp.com',
    password: 'WideCorp2024!INTERN', 
    name: 'Henry Intern'
  }
];

async function testLogin(account) {
  console.log(`\n🧪 Testing ${account.role}: ${account.name}...`);
  
  try {
    const response = await fetch(`${API_BASE}/sign-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: account.email,
        password: account.password
      })
    });

    if (response.ok) {
      console.log(`✅ ${account.role} login successful`);
      return true;
    } else {
      const error = await response.text();
      console.log(`❌ ${account.role} login failed: ${response.status} - ${error}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${account.role} login error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔐 Wide Corp Role Login Validation');
  console.log('==================================');
  console.log('Testing key roles to verify credentials are working...');

  let successCount = 0;

  for (const account of testAccounts) {
    const success = await testLogin(account);
    if (success) successCount++;
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n📊 Login Test Results: ${successCount}/${testAccounts.length} successful`);
  
  if (successCount === testAccounts.length) {
    console.log('\n🎉 All role credentials are working!');
    console.log('✅ Ready for comprehensive permission testing');
    console.log('\n🌐 Login URL: http://localhost:5173/sign-in');
  } else {
    console.log('\n⚠️ Some logins failed - check server logs or try manual login');
  }
}

main().catch(error => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});