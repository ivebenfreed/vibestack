#!/usr/bin/env node

/**
 * Debug Better Auth Invite Validation
 * 
 * This script tests the exact validation requirements for Better Auth organization invites
 */

const API_BASE = 'http://127.0.0.1:8787';

async function getCEOToken() {
  // Sign in as the CEO who created the organization
  const response = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'sarah-1755194529567@devshop.agency',
      password: 'DevShop2024'
    })
  });
  
  if (!response.ok) {
    throw new Error(`CEO sign-in failed: ${response.status}`);
  }
  
  const setCookieHeader = response.headers.get('Set-Cookie');
  const sessionMatch = setCookieHeader.match(/better-auth\.session_token=([^;]+)/);
  if (!sessionMatch) {
    throw new Error('Session token not found');
  }
  
  return decodeURIComponent(sessionMatch[1]);
}

async function testInviteVariations() {
  console.log('🔍 TESTING BETTER AUTH INVITE VALIDATION');
  console.log('========================================');
  
  try {
    const ceoToken = await getCEOToken();
    console.log(`✅ CEO token obtained: ${ceoToken.substring(0, 30)}...`);
    
    const baseHeaders = {
      'Content-Type': 'application/json',
      'Cookie': `better-auth.session_token=${ceoToken}`
    };
    
    // Test 1: Minimal payload (current approach)
    console.log('\n📋 TEST 1: Minimal payload');
    const test1Payload = {
      email: "test1@devshop.agency",
      role: "member"
    };
    console.log('Payload:', JSON.stringify(test1Payload, null, 2));
    
    const test1Response = await fetch(`${API_BASE}/api/auth/organization/invite-member`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify(test1Payload)
    });
    
    console.log(`Status: ${test1Response.status}`);
    const test1Body = await test1Response.text();
    console.log(`Response: ${test1Body}`);
    
    // Test 2: With explicit organizationId
    console.log('\n📋 TEST 2: With explicit organizationId');
    const test2Payload = {
      email: "test2@devshop.agency",
      role: "member",
      organizationId: "0198a9bf-33f4-7f6d-8391-1c665c76fa32" // From the simulation logs
    };
    console.log('Payload:', JSON.stringify(test2Payload, null, 2));
    
    const test2Response = await fetch(`${API_BASE}/api/auth/organization/invite-member`, {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify(test2Payload)
    });
    
    console.log(`Status: ${test2Response.status}`);
    const test2Body = await test2Response.text();
    console.log(`Response: ${test2Body}`);
    
    // Test 3: Check current user's active organization
    console.log('\n📋 TEST 3: Check user session details');
    const sessionResponse = await fetch(`${API_BASE}/api/auth/session`, {
      headers: baseHeaders
    });
    
    console.log(`Session status: ${sessionResponse.status}`);
    const sessionBody = await sessionResponse.text();
    console.log(`Session details: ${sessionBody}`);
    
    // Test 4: List current organizations
    console.log('\n📋 TEST 4: List user organizations');
    const orgsResponse = await fetch(`${API_BASE}/api/auth/organization/list`, {
      headers: baseHeaders
    });
    
    console.log(`Organizations status: ${orgsResponse.status}`);
    const orgsBody = await orgsResponse.text();
    console.log(`Organizations: ${orgsBody}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testInviteVariations()
    .then(() => {
      console.log('\n✅ Invite validation tests completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Tests failed:', error);
      process.exit(1);
    });
}

export { testInviteVariations };