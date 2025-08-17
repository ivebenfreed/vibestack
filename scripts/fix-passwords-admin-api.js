#!/usr/bin/env node

/**
 * Fix Wide Corp Passwords Using Better Auth Admin API
 * 
 * Uses the correct Better Auth admin setUserPassword endpoint
 * to fix password hashing for all Wide Corp users.
 */

const http = require('http');

const SERVER_URL = 'http://localhost:8787';

// Wide Corp users with their IDs and desired passwords
const wideCorpUsers = [
  {
    email: 'ceo@widecorp.com',
    userId: '0198b046-c453-72d9-b71a-092e1f75601a',
    password: 'WideCorp2024!CEO',
    role: 'owner'
  },
  {
    email: 'cto@widecorp.com', 
    userId: '0198b046-d127-769d-9bc2-8e5824b71b3a',
    password: 'WideCorp2024!CTO',
    role: 'admin'
  },
  {
    email: 'pm1@widecorp.com',
    userId: '0198b046-d931-7772-a1e8-b63c68c7f43d', 
    password: 'WideCorp2024!PM1',
    role: 'manager'
  }
];

// Helper function to make HTTP requests
function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = {
            status: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null
          };
          resolve(response);
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function setUserPassword(user) {
  console.log(`\n🔐 Setting password for: ${user.email}...`);
  
  try {
    // Use Better Auth admin setUserPassword endpoint
    const response = await makeRequest({
      hostname: 'localhost',
      port: 8787,
      path: '/api/auth/admin/set-user-password',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Better-Auth-Admin-Script/1.0',
      }
    }, {
      userId: user.userId,
      newPassword: user.password
    });

    console.log(`   📊 Response status: ${response.status}`);
    
    if (response.status === 200) {
      console.log(`   ✅ Password set successfully: ${user.email}`);
      return { success: true, user };
    } else {
      console.log(`   ❌ Failed (${response.status}):`, response.body);
      return { success: false, error: response.body, user };
    }

  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}`);
    return { success: false, error: error.message, user };
  }
}

async function testLogin(email, password) {
  console.log(`\n🧪 Testing login: ${email}...`);
  
  try {
    const loginResponse = await makeRequest({
      hostname: 'localhost',
      port: 8787,
      path: '/api/auth/sign-in/email',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Better-Auth-Admin-Script/1.0',
      }
    }, {
      email: email,
      password: password
    });

    console.log(`   📊 Login response status: ${loginResponse.status}`);
    
    if (loginResponse.status === 200) {
      console.log(`   ✅ Login successful: ${email}`);
      return true;
    } else {
      console.log(`   ❌ Login failed:`, loginResponse.body);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Login test failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔐 Better Auth Admin API Password Fix');
  console.log('====================================');
  console.log('');
  console.log('🎯 Using /api/auth/admin/set-user-password endpoint...');
  console.log('');

  const results = [];
  let successCount = 0;

  // Set passwords using admin API
  for (const user of wideCorpUsers) {
    const result = await setUserPassword(user);
    results.push(result);
    if (result.success) successCount++;
  }

  console.log(`\n📊 Password Setting Complete: ${successCount}/${wideCorpUsers.length} successful`);

  // Test logins for successful users
  if (successCount > 0) {
    console.log('\n🧪 Testing logins with new passwords...');
    
    let loginSuccessCount = 0;
    for (const result of results.filter(r => r.success)) {
      const loginSuccess = await testLogin(result.user.email, result.user.password);
      if (loginSuccess) loginSuccessCount++;
    }

    console.log(`\n📊 Login Test Results: ${loginSuccessCount}/${successCount} successful`);

    if (loginSuccessCount > 0) {
      console.log('\n✅ WORKING CREDENTIALS:');
      console.log('=======================');
      
      results.filter(r => r.success).forEach(result => {
        console.log(`\n📧 ${result.user.email}`);
        console.log(`   Password: ${result.user.password}`);
        console.log(`   Role: ${result.user.role}`);
        console.log(`   User ID: ${result.user.userId}`);
      });

      console.log('\n🎯 SUCCESS! You can now:');
      console.log('1. Login at: http://localhost:5173/sign-in');
      console.log('2. Access debug route: http://localhost:5173/debug/livestore-test');
      console.log('3. Test the LiveStore table display functionality!');
      console.log('');
      console.log('🎉 Better Auth passwords are now properly formatted!');
    } else {
      console.log('\n❌ Password setting succeeded but logins still failed.');
      console.log('   This might indicate a different authentication issue.');
    }
  }

  return results;
}

// Run the script
main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});