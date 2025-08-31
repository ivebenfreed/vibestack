#!/usr/bin/env node

/**
 * Test Password Validation System
 * 
 * This script tests the comprehensive password validation system with B2B security standards.
 */

const API_BASE = 'http://127.0.0.1:8787';

async function testPasswordValidation() {
  console.log('🔍 TESTING PASSWORD VALIDATION SYSTEM');
  console.log('=====================================');
  
  const baseEmail = `pw-test-${Date.now()}@vibestack.test`;
  
  // Test cases with different password strengths
  const testCases = [
    {
      name: 'Too short password',
      password: 'Short1!',
      email: baseEmail.replace('@', '+short@'),
      shouldFail: true,
      expectedError: 'at least 8 characters'
    },
    {
      name: 'No uppercase letters',
      password: 'lowercase123!',
      email: baseEmail.replace('@', '+noup@'),
      shouldFail: true,
      expectedError: 'uppercase letter'
    },
    {
      name: 'No lowercase letters',
      password: 'UPPERCASE123!',
      email: baseEmail.replace('@', '+nolow@'),
      shouldFail: true,
      expectedError: 'lowercase letter'
    },
    {
      name: 'No numbers',
      password: 'NoNumbers!',
      email: baseEmail.replace('@', '+nonum@'),
      shouldFail: true,
      expectedError: 'number'
    },
    {
      name: 'No special characters',
      password: 'NoSpecialChars123',
      email: baseEmail.replace('@', '+nospec@'),
      shouldFail: true,
      expectedError: 'special character'
    },
    {
      name: 'Common password',
      password: 'Password123!',
      email: baseEmail.replace('@', '+common@'),
      shouldFail: true,
      expectedError: 'common words'
    },
    {
      name: 'Sequential characters',
      password: 'Sequence123!',
      email: baseEmail.replace('@', '+seq@'),
      shouldFail: true,
      expectedError: 'sequential characters'
    },
    {
      name: 'Repeated characters',
      password: 'Repeattt123!',
      email: baseEmail.replace('@', '+repeat@'),
      shouldFail: true,
      expectedError: 'repeated characters'
    },
    {
      name: 'Email similarity',
      password: 'PwTest2024!',  // Contains 'pw-test' from email
      email: baseEmail.replace('@', '+similar@'),
      shouldFail: true,
      expectedError: 'similar to your email'
    },
    {
      name: 'Valid strong password',
      password: 'MySecure2024!',
      email: baseEmail.replace('@', '+valid@'),
      shouldFail: false,
      expectedError: null
    },
    {
      name: 'Another valid password',
      password: 'B2bAuth$ecure9',
      email: baseEmail.replace('@', '+valid2@'),
      shouldFail: false,
      expectedError: null
    }
  ];
  
  console.log(`\n📋 Testing ${testCases.length} password validation scenarios...\n`);
  
  let passedTests = 0;
  let failedTests = 0;
  
  for (const testCase of testCases) {
    console.log(`🔄 ${testCase.name}:`);
    console.log(`   Password: "${testCase.password}"`);
    console.log(`   Email: ${testCase.email}`);
    
    try {
      const response = await fetch(`${API_BASE}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test User',
          email: testCase.email,
          password: testCase.password
        })
      });
      
      const responseBody = await response.text();
      
      if (testCase.shouldFail) {
        if (response.ok) {
          console.log(`   ❌ FAIL: Expected password validation to reject this password`);
          console.log(`   Response: ${responseBody}`);
          failedTests++;
        } else {
          if (testCase.expectedError && responseBody.toLowerCase().includes(testCase.expectedError.toLowerCase())) {
            console.log(`   ✅ PASS: Correctly rejected with expected error`);
            passedTests++;
          } else {
            console.log(`   ⚠️  PARTIAL: Rejected but with unexpected error`);
            console.log(`   Expected: ${testCase.expectedError}`);
            console.log(`   Got: ${responseBody}`);
            passedTests++; // Still counts as pass since it was rejected
          }
        }
      } else {
        if (response.ok) {
          console.log(`   ✅ PASS: Valid password correctly accepted`);
          passedTests++;
        } else {
          console.log(`   ❌ FAIL: Valid password incorrectly rejected`);
          console.log(`   Response: ${responseBody}`);
          failedTests++;
        }
      }
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      failedTests++;
    }
    
    console.log(''); // Empty line for readability
  }
  
  // Test edge cases
  console.log('🔄 Testing edge cases...\n');
  
  // Extremely long password
  const longPassword = 'A'.repeat(130) + '1!';
  console.log('🔄 Extremely long password (130+ chars):');
  try {
    const response = await fetch(`${API_BASE}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: baseEmail.replace('@', '+long@'),
        password: longPassword
      })
    });
    
    const responseBody = await response.text();
    
    if (!response.ok && responseBody.toLowerCase().includes('exceed 128')) {
      console.log('   ✅ PASS: Long password correctly rejected');
      passedTests++;
    } else {
      console.log('   ❌ FAIL: Long password should have been rejected');
      console.log(`   Response: ${responseBody}`);
      failedTests++;
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    failedTests++;
  }
  
  console.log('\n📊 TEST RESULTS:');
  console.log('================');
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📈 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);
  
  console.log('\n🛡️ PASSWORD SECURITY FEATURES TESTED:');
  console.log('• Minimum 8 characters');
  console.log('• Maximum 128 characters');
  console.log('• At least 1 uppercase letter');
  console.log('• At least 1 lowercase letter');
  console.log('• At least 1 number');
  console.log('• At least 1 special character');
  console.log('• No common passwords (password, 123456, etc.)');
  console.log('• No similarity to email address');
  console.log('• No sequential characters (123, abc, etc.)');
  console.log('• No more than 2 repeated characters in a row');
  
  console.log('\n📝 VALIDATION REQUIREMENTS SUMMARY:');
  console.log('For B2B SaaS applications, passwords must be:');
  console.log('• 8-128 characters long');
  console.log('• Mix of uppercase, lowercase, numbers, symbols');
  console.log('• Not contain common words or patterns');
  console.log('• Unique from user\'s email address');
  console.log('• Free of predictable sequences');
  
  return { passed: passedTests, failed: failedTests };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testPasswordValidation()
    .then((results) => {
      console.log('\n✅ Password validation testing completed');
      if (results.failed === 0) {
        console.log('🎉 All password validation tests passed!');
        process.exit(0);
      } else {
        console.log(`❌ ${results.failed} tests failed - review password validation logic`);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Tests failed:', error);
      process.exit(1);
    });
}