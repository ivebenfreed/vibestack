#!/usr/bin/env node

/**
 * Debug session organization context after creation
 */

const API_BASE = 'http://127.0.0.1:8787';

async function debugSessionContext() {
  console.log('🔍 DEBUGGING SESSION ORGANIZATION CONTEXT');
  console.log('=========================================');
  
  try {
    // Step 1: Create user and organization
    await fetch(`${API_BASE}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Debug User',
        email: 'debug@sessiontest.org',
        password: 'Password123'
      })
    });
    
    const signInResponse = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'debug@sessiontest.org',
        password: 'Password123'
      })
    });
    
    const setCookieHeader = signInResponse.headers.get('Set-Cookie');
    const sessionMatch = setCookieHeader.match(/better-auth\.session_token=([^;]+)/);
    const token = decodeURIComponent(sessionMatch[1]);
    
    console.log(`✅ User created and signed in`);
    console.log(`Token: ${token.substring(0, 30)}...`);
    
    // Step 2: Create organization
    const orgResponse = await fetch(`${API_BASE}/api/auth/organization/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `better-auth.session_token=${token}`
      },
      body: JSON.stringify({
        name: 'Debug Organization',
        slug: 'debug-org-session'
      })
    });
    
    const orgData = await orgResponse.json();
    console.log(`✅ Organization created: ${orgData.id}`);
    
    // Step 3: Check session details using Better Auth endpoints
    console.log('\n📋 Checking session context...');
    
    // Try to get user's organizations
    const orgsResponse = await fetch(`${API_BASE}/api/auth/organization/list`, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `better-auth.session_token=${token}`
      }
    });
    
    console.log(`Organizations list status: ${orgsResponse.status}`);
    const orgsData = await orgsResponse.text();
    console.log(`User organizations: ${orgsData}`);
    
    // Try a different Better Auth endpoint to check active organization
    const sessionResponse = await fetch(`${API_BASE}/api/auth/get-session`, {
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `better-auth.session_token=${token}`
      }
    });
    
    console.log(`Session endpoint status: ${sessionResponse.status}`);
    const sessionData = await sessionResponse.text();
    console.log(`Session data: ${sessionData}`);
    
    // Step 4: Try invite with explicit organization ID
    console.log('\n📋 Testing invitation with explicit org ID...');
    const inviteResponse = await fetch(`${API_BASE}/api/auth/organization/invite-member`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `better-auth.session_token=${token}`
      },
      body: JSON.stringify({
        email: 'invite@sessiontest.org',
        role: 'member',
        organizationId: orgData.id
      })
    });
    
    console.log(`Invite status: ${inviteResponse.status}`);
    const inviteData = await inviteResponse.text();
    console.log(`Invite response: ${inviteData}`);
    
    // Step 5: Check database state directly
    console.log('\n📋 Checking database state...');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  debugSessionContext()
    .then(() => {
      console.log('\n✅ Session context debug completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Tests failed:', error);
      process.exit(1);
    });
}