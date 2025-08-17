#!/usr/bin/env node

/**
 * Create Users via Better Auth Admin API
 * 
 * Uses Better Auth admin plugin to create users with proper password hashing.
 * Makes HTTP requests to the running server's admin endpoints.
 */

const http = require('http');

const SERVER_URL = 'http://localhost:8787';
const WEB_URL = 'http://localhost:5173';

// Wide Corp users to create
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

async function createUserViaAdminAPI(user) {
  console.log(`\n🔧 Creating user: ${user.name} (${user.email})...`);
  
  try {
    // Try Better Auth admin createUser endpoint
    const adminResponse = await makeRequest({
      hostname: 'localhost',
      port: 8787,
      path: '/api/auth/admin/create-user',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    }, {
      email: user.email,
      password: user.password,
      name: user.name,
      emailVerified: true // Skip email verification for test users
    });

    if (adminResponse.status === 200 || adminResponse.status === 201) {
      console.log(`   ✅ Admin API success: ${user.email}`);
      return { success: true, method: 'admin-api', user };
    }

    console.log(`   ❌ Admin API failed (${adminResponse.status}):`, adminResponse.body);

    // Fallback: Try regular signUp endpoint
    const signUpResponse = await makeRequest({
      hostname: 'localhost',
      port: 8787,
      path: '/api/auth/sign-up/email',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    }, {
      email: user.email,
      password: user.password,
      name: user.name
    });

    if (signUpResponse.status === 200 || signUpResponse.status === 201) {
      console.log(`   ✅ SignUp API success: ${user.email}`);
      return { success: true, method: 'signup-api', user };
    }

    console.log(`   ❌ SignUp API failed (${signUpResponse.status}):`, signUpResponse.body);
    return { success: false, error: `Both methods failed. Last error: ${JSON.stringify(signUpResponse.body)}`, user };

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
      }
    }, {
      email: email,
      password: password
    });

    if (loginResponse.status === 200) {
      console.log(`   ✅ Login successful: ${email}`);
      return true;
    } else {
      console.log(`   ❌ Login failed (${loginResponse.status}):`, loginResponse.body);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Login test failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔐 Better Auth Admin API User Creation');
  console.log('======================================');
  console.log('');
  console.log('🎯 Creating Wide Corp users via Better Auth admin endpoints...');
  console.log('');

  const results = [];
  let successCount = 0;

  // Create users
  for (const user of wideCorpUsers) {
    const result = await createUserViaAdminAPI(user);
    results.push(result);
    if (result.success) successCount++;
  }

  console.log(`\n📊 User Creation Complete: ${successCount}/${wideCorpUsers.length} successful`);

  // Test logins for successful users
  if (successCount > 0) {
    console.log('\n🧪 Testing logins...');
    
    for (const result of results.filter(r => r.success)) {
      await testLogin(result.user.email, result.user.password);
    }

    console.log('\n✅ WORKING CREDENTIALS:');
    console.log('=======================');
    
    results.filter(r => r.success).forEach(result => {
      console.log(`\n📧 ${result.user.email}`);
      console.log(`   Password: ${result.user.password}`);
      console.log(`   Method: ${result.method}`);
      console.log(`   Role: ${result.user.role}`);
    });

    console.log('\n🎯 Next Steps:');
    console.log('1. Try logging in at: http://localhost:5173/sign-in');
    console.log('2. Navigate to debug route: http://localhost:5173/debug/livestore-test');
    console.log('3. Test the LiveStore table display functionality!');
  }

  return results;
}

// Run the script
main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});