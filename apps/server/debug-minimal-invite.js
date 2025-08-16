#!/usr/bin/env node

/**
 * Minimal invite test to isolate validation error
 */

const API_BASE = 'http://127.0.0.1:8787';

async function testMinimalInvite() {
  console.log('🔍 MINIMAL INVITE VALIDATION TEST');
  console.log('=================================');
  
  try {
    // Get the CEO token from organization creation
    const signUpResponse = await fetch(`${API_BASE}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test CEO',
        email: 'testceo@test.org',
        password: 'Password123'
      })
    });
    
    console.log(`Sign-up status: ${signUpResponse.status}`);
    
    // Sign in to get session
    const signInResponse = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'testceo@test.org',
        password: 'Password123'
      })
    });
    
    console.log(`Sign-in status: ${signInResponse.status}`);
    
    const setCookieHeader = signInResponse.headers.get('Set-Cookie');
    const sessionMatch = setCookieHeader.match(/better-auth\.session_token=([^;]+)/);
    const ceoToken = decodeURIComponent(sessionMatch[1]);
    
    console.log(`CEO token: ${ceoToken.substring(0, 30)}...`);
    
    // Create organization  
    const orgResponse = await fetch(`${API_BASE}/api/auth/organization/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `better-auth.session_token=${ceoToken}`
      },
      body: JSON.stringify({
        name: 'Test Organization',
        slug: 'test-org-minimal'
      })
    });
    
    console.log(`Organization creation status: ${orgResponse.status}`);
    const orgData = await orgResponse.json();
    console.log(`Organization ID: ${orgData.id}`);
    
    // Test different invitation payloads
    const testCases = [
      {
        name: 'Just email',
        payload: { email: 'invite1@test.org' }
      },
      {
        name: 'Email + role',
        payload: { email: 'invite2@test.org', role: 'member' }
      },
      {
        name: 'Email + role + organizationId',
        payload: { 
          email: 'invite3@test.org', 
          role: 'member',
          organizationId: orgData.id
        }
      },
      {
        name: 'Email + role (admin)',
        payload: { email: 'invite4@test.org', role: 'admin' }
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n📋 Testing: ${testCase.name}`);
      console.log(`Payload: ${JSON.stringify(testCase.payload, null, 2)}`);
      
      const inviteResponse = await fetch(`${API_BASE}/api/auth/organization/invite-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `better-auth.session_token=${ceoToken}`
        },
        body: JSON.stringify(testCase.payload)
      });
      
      console.log(`Status: ${inviteResponse.status}`);
      const responseText = await inviteResponse.text();
      console.log(`Response: ${responseText}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testMinimalInvite()
    .then(() => {
      console.log('\n✅ Minimal invite tests completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Tests failed:', error);
      process.exit(1);
    });
}