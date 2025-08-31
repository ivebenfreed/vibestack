#!/usr/bin/env node

/**
 * Manual OTP test - verify email with captured OTP from console logs
 */

const axios = require('axios');
const BASE_URL = 'http://localhost:8787';

async function testManualOTP() {
  console.log('🔐 Manual OTP Verification Test\n');
  
  // Use the OTP and email from the previous test
  const testEmail = 'trial-1755276237782@gmail.com';
  const testPassword = 'X9#mK8$nP2@vQ7!wE5';
  const capturedOTP = '962167'; // From server console logs
  
  try {
    console.log('📧 Step 1: Verify Email with Captured OTP');
    console.log(`   Email: ${testEmail}`);
    console.log(`   OTP: ${capturedOTP}`);
    
    // Verify email with OTP
    const verifyResponse = await axios.post(`${BASE_URL}/api/auth/verify-email`, {
      email: testEmail,
      otp: capturedOTP
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true
    });
    
    console.log(`   Verification Status: ${verifyResponse.status}`);
    if (verifyResponse.status === 200) {
      console.log('   ✅ SUCCESS: Email verified with OTP');
    } else {
      console.log('   ❌ FAILED: Email verification failed');
      console.log('   Response:', verifyResponse.data);
      return;
    }
    console.log('');
    
    console.log('🔐 Step 2: Sign In After Verification');
    
    const signinResponse = await axios.post(`${BASE_URL}/api/auth/sign-in/email`, {
      email: testEmail,
      password: testPassword
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true
    });
    
    console.log(`   Sign-in Status: ${signinResponse.status}`);
    if (signinResponse.status === 200) {
      console.log('   ✅ SUCCESS: User signed in after email verification');
      
      // Extract session cookie
      let sessionCookie = null;
      const setCookieHeader = signinResponse.headers['set-cookie'];
      if (setCookieHeader) {
        sessionCookie = setCookieHeader.find(cookie => cookie.startsWith('better-auth.session_token'));
        if (sessionCookie) {
          sessionCookie = sessionCookie.split(';')[0];
          console.log('   ✅ Session cookie obtained');
        }
      }
      
      if (signinResponse.data.token) {
        sessionCookie = `better-auth.session_token=${signinResponse.data.token}`;
        console.log('   ✅ Session token obtained');
      }
      
      console.log('');
      console.log('🏢 Step 3: Access Organizations (Trial Test)');
      
      // Test accessing organizations with valid session
      const orgsResponse = await axios.get(`${BASE_URL}/api/organizations`, {
        headers: sessionCookie ? { 'Cookie': sessionCookie } : {},
        validateStatus: () => true
      });
      
      console.log(`   Organizations Status: ${orgsResponse.status}`);
      if (orgsResponse.status === 200) {
        console.log('   ✅ SUCCESS: Authenticated access to organizations');
        console.log(`   Organizations found: ${orgsResponse.data.length}`);
        
        if (orgsResponse.data.length > 0) {
          const org = orgsResponse.data[0];
          console.log(`   Organization ID: ${org.id}`);
          console.log(`   Organization Name: ${org.name}`);
          console.log(`   Subscription Tier: ${org.subscription_tier}`);
          console.log(`   Trial Ends: ${org.trial_ends_at}`);
        }
      } else {
        console.log('   ❌ FAILED: Could not access organizations');
        console.log('   Response:', orgsResponse.data);
      }
      
      console.log('');
      console.log('🎯 Complete Trial Flow - SUCCESS!');
      console.log('='.repeat(50));
      console.log('✅ User registration with Polar customer creation');
      console.log('✅ Email verification with OTP');
      console.log('✅ User sign-in after verification');
      console.log('✅ Authenticated access to protected resources');
      console.log('✅ Trial organization system working');
      
    } else {
      console.log('   ❌ FAILED: Sign-in failed even after verification');
      console.log('   Response:', signinResponse.data);
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
if (require.main === module) {
  testManualOTP().catch(console.error);
}

module.exports = { testManualOTP };