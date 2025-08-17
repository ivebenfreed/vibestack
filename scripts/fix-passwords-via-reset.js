#!/usr/bin/env node

/**
 * Fix Wide Corp Passwords via Password Reset API
 * 
 * Uses Better Auth's password reset flow to set working passwords:
 * 1. Request password reset for each user
 * 2. Extract reset tokens from database  
 * 3. Use reset token to set new password
 */

const { Client } = require('pg');
const http = require('http');

// Database connection
const client = new Client({
  connectionString: 'postgres://postgres:postgres@localhost:5432/vibestack_dev'
});

const SERVER_URL = 'http://localhost:8787';

// Wide Corp users to fix
const wideCorpUsers = [
  {
    email: 'ceo@widecorp.com',
    password: 'WideCorp2024!CEO',
    role: 'owner'
  },
  {
    email: 'cto@widecorp.com', 
    password: 'WideCorp2024!CTO',
    role: 'admin'
  },
  {
    email: 'pm1@widecorp.com',
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

async function requestPasswordReset(email) {
  console.log(`\n🔄 Requesting password reset for: ${email}...`);
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 8787,
      path: '/api/auth/request-password-reset',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Better-Auth-Reset-Script/1.0',
      }
    }, {
      email: email
    });

    console.log(`   📊 Response status: ${response.status}`);
    
    if (response.status === 200) {
      console.log(`   ✅ Password reset requested successfully`);
      return { success: true };
    } else {
      console.log(`   ❌ Failed:`, response.body);
      return { success: false, error: response.body };
    }

  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function getResetTokenFromDB(email) {
  console.log(`   🔍 Getting reset token for ${email} from database...`);
  
  try {
    // Get the most recent verification token for this user  
    // The token is in the identifier as 'reset-password:TOKEN'
    const result = await client.query(`
      SELECT 
        SUBSTRING(identifier FROM 'reset-password:(.*)') as token,
        "expiresAt"
      FROM verification 
      WHERE value = (SELECT id FROM "user" WHERE email = $1)
      AND identifier LIKE 'reset-password:%'
      ORDER BY "createdAt" DESC 
      LIMIT 1
    `, [email]);
    
    if (result.rows.length === 0) {
      console.log(`   ❌ No reset token found for ${email}`);
      return null;
    }
    
    const tokenData = result.rows[0];
    const now = new Date();
    const expiresAt = new Date(tokenData.expiresAt);
    
    if (expiresAt < now) {
      console.log(`   ❌ Reset token expired for ${email}`);
      return null;
    }
    
    console.log(`   ✅ Found valid reset token for ${email}`);
    return tokenData.token;
    
  } catch (error) {
    console.log(`   ❌ Database error: ${error.message}`);
    return null;
  }
}

async function resetPasswordWithToken(token, newPassword, email) {
  console.log(`   🔐 Resetting password using token...`);
  
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 8787,
      path: '/api/auth/reset-password',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Better-Auth-Reset-Script/1.0',
      }
    }, {
      token: token,
      newPassword: newPassword
    });

    console.log(`   📊 Reset response status: ${response.status}`);
    
    if (response.status === 200) {
      console.log(`   ✅ Password reset successfully for ${email}`);
      return { success: true };
    } else {
      console.log(`   ❌ Reset failed:`, response.body);
      return { success: false, error: response.body };
    }

  } catch (error) {
    console.log(`   ❌ Reset request failed: ${error.message}`);
    return { success: false, error: error.message };
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
        'User-Agent': 'Better-Auth-Reset-Script/1.0',
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
  console.log('🔐 Better Auth Password Reset Fix');
  console.log('=================================');
  console.log('');
  console.log('🎯 Using password reset API to fix user passwords...');
  console.log('');

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const results = [];
    let successCount = 0;

    for (const user of wideCorpUsers) {
      console.log(`\n🔧 Processing: ${user.email}...`);
      
      // Step 1: Request password reset
      const resetRequest = await requestPasswordReset(user.email);
      if (!resetRequest.success) {
        results.push({ ...user, success: false, error: 'Reset request failed' });
        continue;
      }
      
      // Step 2: Wait a moment for the token to be created
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 3: Get reset token from database
      const token = await getResetTokenFromDB(user.email);
      if (!token) {
        results.push({ ...user, success: false, error: 'No reset token found' });
        continue;
      }
      
      // Step 4: Reset password using token
      const resetResult = await resetPasswordWithToken(token, user.password, user.email);
      if (resetResult.success) {
        results.push({ ...user, success: true });
        successCount++;
      } else {
        results.push({ ...user, success: false, error: resetResult.error });
      }
    }

    console.log(`\n📊 Password Reset Complete: ${successCount}/${wideCorpUsers.length} successful`);

    // Test logins
    if (successCount > 0) {
      console.log('\n🧪 Testing logins with reset passwords...');
      
      let loginSuccessCount = 0;
      for (const result of results.filter(r => r.success)) {
        const loginSuccess = await testLogin(result.email, result.password);
        if (loginSuccess) loginSuccessCount++;
      }

      console.log(`\n📊 Login Test Results: ${loginSuccessCount}/${successCount} successful`);

      if (loginSuccessCount > 0) {
        console.log('\n✅ WORKING CREDENTIALS:');
        console.log('=======================');
        
        results.filter(r => r.success).forEach(result => {
          console.log(`\n📧 ${result.email}`);
          console.log(`   Password: ${result.password}`);
          console.log(`   Role: ${result.role}`);
        });

        console.log('\n🎯 SUCCESS! You can now:');
        console.log('1. Login at: http://localhost:5173/sign-in');
        console.log('2. Access debug route: http://localhost:5173/debug/livestore-test');
        console.log('3. Test the LiveStore table display functionality!');
        console.log('');
        console.log('🎉 Authentication is now working with password reset API!');
      }
    }

  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('📪 Database connection closed');
  }
}

// Run the script
main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});