#!/usr/bin/env node

/**
 * TechFlow Authentication Flow Testing
 * 
 * Tests the complete authentication workflow for created users
 */

const fs = require('fs');

async function apiCall(method, endpoint, data = null, cookies = null) {
  const fetch = (await import('node-fetch')).default;
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookies && { 'Cookie': cookies })
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(`http://localhost:8787${endpoint}`, options);
  const result = await response.text();
  
  let jsonResult;
  try {
    jsonResult = JSON.parse(result);
  } catch (e) {
    jsonResult = result;
  }
  
  return {
    status: response.status,
    ok: response.ok,
    headers: response.headers,
    data: jsonResult
  };
}

async function testAuthenticationFlow() {
  console.log('🔐 Testing TechFlow Authentication Flows\n');
  
  // Load created users
  let users;
  try {
    const usersData = fs.readFileSync('./users-final.json', 'utf8');
    users = JSON.parse(usersData);
    console.log(`📋 Loaded ${users.length} test users`);
  } catch (error) {
    console.error('❌ Could not load users data. Run final-techflow-test.cjs first.');
    process.exit(1);
  }
  
  const authResults = [];
  
  for (const userEntry of users) {
    const user = userEntry.user;
    console.log(`\n=== Testing ${user.name} (${user.email}) ===`);
    
    const testResult = {
      user: user,
      tests: {}
    };
    
    // Test 1: Sign-in attempt (should fail - email not verified)
    console.log('1. Testing sign-in (expect failure - unverified email)');
    try {
      const signInResponse = await apiCall('POST', '/api/auth/sign-in/email', {
        email: user.email,
        password: "X9#mK8$nP2@vQ7!wE5"
      });
      
      if (signInResponse.ok) {
        console.log('⚠️ Sign-in succeeded (unexpected - email should need verification)');
        testResult.tests.sign_in_unverified = { 
          status: 'unexpected_success', 
          data: signInResponse.data 
        };
      } else {
        console.log('✅ Sign-in failed as expected (email not verified)');
        testResult.tests.sign_in_unverified = { 
          status: 'expected_failure', 
          error: signInResponse.data 
        };
      }
    } catch (error) {
      console.log('✅ Sign-in failed as expected');
      testResult.tests.sign_in_unverified = { 
        status: 'expected_failure', 
        error: error.message 
      };
    }
    
    // Test 2: Password reset request
    console.log('2. Testing password reset request');
    try {
      const resetResponse = await apiCall('POST', '/api/auth/reset-password', {
        email: user.email
      });
      
      if (resetResponse.ok) {
        console.log('✅ Password reset request successful');
        testResult.tests.password_reset = { 
          status: 'success', 
          data: resetResponse.data 
        };
      } else {
        console.log('⚠️ Password reset request failed');
        testResult.tests.password_reset = { 
          status: 'failure', 
          error: resetResponse.data 
        };
      }
    } catch (error) {
      console.log('❌ Password reset request error');
      testResult.tests.password_reset = { 
        status: 'error', 
        error: error.message 
      };
    }
    
    // Test 3: Session validation (without authentication)
    console.log('3. Testing session validation (unauthenticated)');
    try {
      const sessionResponse = await apiCall('GET', '/api/auth/session');
      
      if (sessionResponse.ok) {
        console.log('⚠️ Session validation succeeded without authentication');
        testResult.tests.session_unauth = { 
          status: 'unexpected_success', 
          data: sessionResponse.data 
        };
      } else {
        console.log('✅ Session validation failed as expected (no auth)');
        testResult.tests.session_unauth = { 
          status: 'expected_failure', 
          error: sessionResponse.data 
        };
      }
    } catch (error) {
      console.log('✅ Session validation failed as expected');
      testResult.tests.session_unauth = { 
        status: 'expected_failure', 
        error: error.message 
      };
    }
    
    authResults.push(testResult);
  }
  
  // Save authentication test results
  const authTestResults = {
    timestamp: new Date().toISOString(),
    test_type: 'authentication_flows',
    users_tested: users.length,
    results: authResults,
    summary: {
      total_tests: authResults.length * 3,
      tests_completed: authResults.reduce((sum, r) => sum + Object.keys(r.tests).length, 0)
    }
  };
  
  fs.writeFileSync('./auth-flow-test-results.json', JSON.stringify(authTestResults, null, 2));
  console.log('\n✅ Saved: auth-flow-test-results.json');
  
  // Display summary
  console.log('\n📊 === AUTHENTICATION TEST SUMMARY ===');
  console.log(`Users Tested: ${users.length}`);
  console.log(`Total Tests: ${authTestResults.summary.total_tests}`);
  console.log(`Tests Completed: ${authTestResults.summary.tests_completed}`);
  
  console.log('\n📋 Test Results:');
  authResults.forEach(result => {
    console.log(`\n${result.user.name} (${result.user.email}):`);
    Object.entries(result.tests).forEach(([testName, testResult]) => {
      const icon = testResult.status.includes('success') ? '✅' : 
                   testResult.status.includes('expected') ? '✅' : '⚠️';
      console.log(`  ${icon} ${testName}: ${testResult.status}`);
    });
  });
  
  console.log('\n🔗 Next Steps:');
  console.log('1. Check server logs for email verification links');
  console.log('2. Use verification links to activate user accounts');
  console.log('3. Test authenticated workflows after verification');
  console.log('4. Test organization membership assignment');
  
  return authTestResults;
}

// Execute if called directly
if (require.main === module) {
  testAuthenticationFlow()
    .then(() => {
      console.log('\n🎉 Authentication flow testing completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Authentication flow testing failed:', error);
      process.exit(1);
    });
}

module.exports = { testAuthenticationFlow };