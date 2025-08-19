#!/usr/bin/env node

/**
 * Get Wide Corp CEO session for testing WebSocket sync
 */

async function getWideCorpSession() {
  console.log('🔑 Getting Wide Corp CEO session...\n');
  
  // Alice CEO credentials from CLAUDE.md
  const credentials = {
    email: 'ceo@widecorp.com',
    password: 'WideCorp2024!CEO'
  };
  
  try {
    console.log(`📧 Signing in as: ${credentials.email}`);
    
    // Sign in to get session
    const signInResponse = await fetch('http://localhost:8787/api/auth/sign-in/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify(credentials)
    });
    
    if (!signInResponse.ok) {
      throw new Error(`Sign-in failed: ${signInResponse.status} ${signInResponse.statusText}`);
    }
    
    // Extract session cookie
    const setCookieHeader = signInResponse.headers.get('set-cookie');
    if (!setCookieHeader) {
      throw new Error('No session cookie received');
    }
    
    // Parse the session token
    const sessionMatch = setCookieHeader.match(/better-auth\.session_token=([^;]+)/);
    if (!sessionMatch) {
      throw new Error('Could not extract session token');
    }
    
    const sessionToken = sessionMatch[1];
    console.log(`✅ Session obtained: ${sessionToken.substring(0, 20)}...`);
    
    // Verify session by getting user info
    const userResponse = await fetch('http://localhost:8787/api/auth/get-session', {
      headers: {
        'Cookie': `better-auth.session_token=${sessionToken}`,
        'Origin': 'http://localhost:5173'
      }
    });
    
    if (!userResponse.ok) {
      throw new Error('Session verification failed');
    }
    
    const userInfo = await userResponse.json();
    console.log('\n👤 User info:');
    console.log(`  Name: ${userInfo.user?.name || 'N/A'}`);
    console.log(`  Email: ${userInfo.user?.email}`);
    console.log(`  User ID: ${userInfo.user?.id}`);
    
    // Get organization access
    const orgResponse = await fetch('http://localhost:8787/api/organizations', {
      headers: {
        'Cookie': `better-auth.session_token=${sessionToken}`,
        'Origin': 'http://localhost:5173'
      }
    });
    
    if (orgResponse.ok) {
      const orgs = await orgResponse.json();
      console.log('\n🏢 Organizations:');
      orgs.forEach(org => {
        console.log(`  - ${org.name} (${org.id})`);
      });
      
      // Find Wide Corp
      const wideCorp = orgs.find(org => org.id === '01920000-1000-7000-8000-000000000001');
      if (wideCorp) {
        console.log(`\n🎯 Wide Corp found: ${wideCorp.name}`);
        console.log(`   Organization ID: ${wideCorp.id}`);
      }
    }
    
    console.log(`\n📝 Session token for testing:`);
    console.log(`${sessionToken}`);
    
    return {
      sessionToken,
      userInfo,
      organizationId: '01920000-1000-7000-8000-000000000001'
    };
    
  } catch (error) {
    console.error('❌ Error getting session:', error.message);
    throw error;
  }
}

if (require.main === module) {
  getWideCorpSession().catch(console.error);
}

module.exports = { getWideCorpSession };