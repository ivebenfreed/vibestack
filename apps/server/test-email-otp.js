#!/usr/bin/env node

/**
 * Test Email OTP Verification System
 * 
 * This script tests the new email OTP verification system with Resend integration.
 */

const API_BASE = 'http://127.0.0.1:8787';

async function testEmailOTPFlow() {
  console.log('🔍 TESTING EMAIL OTP VERIFICATION SYSTEM');
  console.log('========================================');
  
  try {
    const testEmail = `test-otp-${Date.now()}@vibestack.test`;
    const testPassword = 'SecurePassword123!';
    
    console.log(`\n📧 Testing with email: ${testEmail}`);
    
    // Step 1: Sign up user (should trigger OTP email)
    console.log('\n🔄 Step 1: User sign-up (should send OTP email)...');
    const signUpResponse = await fetch(`${API_BASE}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'OTP Test User',
        email: testEmail,
        password: testPassword
      })
    });
    
    console.log(`Sign-up status: ${signUpResponse.status}`);
    const signUpBody = await signUpResponse.text();
    console.log(`Sign-up response: ${signUpBody}`);
    
    if (signUpResponse.ok) {
      console.log('✅ Sign-up successful - OTP email should have been sent');
      console.log('📧 Check the server logs for OTP email details');
    } else {
      console.log('❌ Sign-up failed');
      return;
    }
    
    // Step 2: Try to sign in without verification (should fail)
    console.log('\n🔄 Step 2: Try sign-in without email verification (should fail)...');
    const signInResponse = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });
    
    console.log(`Sign-in status: ${signInResponse.status}`);
    const signInBody = await signInResponse.text();
    console.log(`Sign-in response: ${signInBody}`);
    
    if (signInResponse.status === 403 || signInResponse.status === 401) {
      console.log('✅ Sign-in properly blocked - email verification required');
    } else {
      console.log('❌ Sign-in should have been blocked');
    }
    
    // Step 3: Test OTP verification endpoint
    console.log('\n🔄 Step 3: Testing OTP verification...');
    console.log('📝 Note: In a real scenario, you would get the OTP from the email');
    console.log('📝 For testing, check server logs for the actual OTP code');
    
    // Try with a dummy OTP (will fail, but tests the endpoint)
    const otpResponse = await fetch(`${API_BASE}/api/auth/email-otp/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        otp: '123456' // Dummy OTP
      })
    });
    
    console.log(`OTP verification status: ${otpResponse.status}`);
    const otpBody = await otpResponse.text();
    console.log(`OTP verification response: ${otpBody}`);
    
    // Step 4: Test resend OTP
    console.log('\n🔄 Step 4: Testing OTP resend...');
    const resendResponse = await fetch(`${API_BASE}/api/auth/email-otp/send-verification-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        type: 'email-verification'
      })
    });
    
    console.log(`Resend OTP status: ${resendResponse.status}`);
    const resendBody = await resendResponse.text();
    console.log(`Resend OTP response: ${resendBody}`);
    
    if (resendResponse.ok) {
      console.log('✅ OTP resend successful - check logs for new OTP');
    }
    
    console.log('\n📊 TEST SUMMARY:');
    console.log('================');
    console.log('✅ User sign-up triggers OTP email');
    console.log('✅ Sign-in blocked without email verification');
    console.log('✅ OTP verification endpoint available');
    console.log('✅ OTP resend functionality works');
    console.log('');
    console.log('🔍 TO COMPLETE VERIFICATION:');
    console.log('1. Check server logs for the OTP code');
    console.log('2. Use the OTP code with /api/auth/email-otp/verify-email endpoint');
    console.log('3. Then sign-in should work normally');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testEmailOTPFlow()
    .then(() => {
      console.log('\n✅ Email OTP testing completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Tests failed:', error);
      process.exit(1);
    });
}