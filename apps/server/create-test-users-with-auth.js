#!/usr/bin/env node
/**
 * Create Test Users with Organization Memberships and Get Auth Tokens
 * 
 * This script creates test users, assigns them to organizations, 
 * and retrieves authentication tokens for WebSocket testing.
 */

import { randomUUID } from 'crypto';

// Test Configuration
const SERVER_URL = 'http://localhost:8787';
const TEST_ORGS = [
  {
    id: 'org1-550e8400-e29b-41d4-a716-446655440001',
    slug: 'techstartup-inc',
    name: 'TechStartup Inc'
  },
  {
    id: 'org2-550e8400-e29b-41d4-a716-446655440002', 
    slug: 'globalcorp-enterprise',
    name: 'GlobalCorp Enterprise'
  }
];

const TEST_USERS = [
  {
    email: 'test-org1-user1@example.com',
    password: 'Complex&Pass@987!',
    name: 'Test User 1 (Org 1)',
    organizationId: TEST_ORGS[0].id,
    organizationSlug: TEST_ORGS[0].slug
  },
  {
    email: 'test-org1-user2@example.com', 
    password: 'Complex&Pass@987!',
    name: 'Test User 2 (Org 1)',
    organizationId: TEST_ORGS[0].id,
    organizationSlug: TEST_ORGS[0].slug
  },
  {
    email: 'test-org2-user1@example.com',
    password: 'Complex&Pass@987!', 
    name: 'Test User 1 (Org 2)',
    organizationId: TEST_ORGS[1].id,
    organizationSlug: TEST_ORGS[1].slug
  },
  {
    email: 'test-org2-user2@example.com',
    password: 'Complex&Pass@987!',
    name: 'Test User 2 (Org 2)', 
    organizationId: TEST_ORGS[1].id,
    organizationSlug: TEST_ORGS[1].slug
  }
];

class AuthTestSetup {
  constructor() {
    this.userTokens = new Map();
  }

  async setupTestUsers() {
    console.log('🚀 Setting up test users with organization memberships...');
    
    for (const user of TEST_USERS) {
      try {
        console.log(`Creating user: ${user.email} for org: ${user.organizationSlug}`);
        
        // Attempt to sign up the user
        const signupResult = await this.signUpUser(user);
        if (signupResult.success) {
          console.log(`✅ User created: ${user.email}`);
          
          // Get auth token
          const token = await this.signInUser(user);
          if (token) {
            this.userTokens.set(user.email, {
              token,
              organizationSlug: user.organizationSlug,
              user: user
            });
            console.log(`🔐 Auth token obtained for: ${user.email}`);
          }
        } else {
          console.log(`⚠️  User might already exist: ${user.email}, trying to sign in...`);
          
          // Try to sign in existing user
          const token = await this.signInUser(user);
          if (token) {
            this.userTokens.set(user.email, {
              token,
              organizationSlug: user.organizationSlug,
              user: user
            });
            console.log(`🔐 Auth token obtained for existing user: ${user.email}`);
          }
        }
        
      } catch (error) {
        console.error(`❌ Error setting up user ${user.email}:`, error.message);
      }
    }
    
    console.log(`\n📊 Setup complete. ${this.userTokens.size} users ready for testing.`);
    return this.userTokens;
  }

  async signUpUser(user) {
    try {
      const response = await fetch(`${SERVER_URL}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          password: user.password,
          name: user.name
        })
      });

      const result = await response.json();
      return {
        success: response.ok,
        data: result
      };
    } catch (error) {
      console.error(`Sign up failed for ${user.email}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async signInUser(user) {
    try {
      const response = await fetch(`${SERVER_URL}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          password: user.password
        })
      });

      if (!response.ok) {
        console.error(`Sign in failed for ${user.email}: ${response.status} ${response.statusText}`);
        return null;
      }

      // Extract session token from Set-Cookie header
      const setCookieHeader = response.headers.get('Set-Cookie');
      if (setCookieHeader) {
        const tokenMatch = setCookieHeader.match(/better-auth\.session_token=([^;]+)/);
        if (tokenMatch) {
          return tokenMatch[1];
        }
      }

      // Also try to get from response body if available
      const result = await response.json();
      if (result.token || result.sessionToken) {
        return result.token || result.sessionToken;
      }

      console.warn(`No session token found for ${user.email}`);
      return null;
    } catch (error) {
      console.error(`Sign in error for ${user.email}:`, error.message);
      return null;
    }
  }

  printTokensForTesting() {
    console.log('\n🔑 Authentication tokens for WebSocket testing:');
    console.log('='.repeat(60));
    
    for (const [email, data] of this.userTokens) {
      console.log(`\nUser: ${email}`);
      console.log(`Organization: ${data.organizationSlug}`);
      console.log(`Token: ${data.token.substring(0, 20)}...`);
      console.log(`WebSocket URL: ws://localhost:8787/api/sync/connect/${data.organizationSlug}?clientId=test-${randomUUID()}&lsn=0/0&auth=${data.token}`);
    }
  }

  getTokensByOrganization() {
    const orgTokens = {};
    
    for (const [email, data] of this.userTokens) {
      if (!orgTokens[data.organizationSlug]) {
        orgTokens[data.organizationSlug] = [];
      }
      orgTokens[data.organizationSlug].push({
        email,
        token: data.token,
        user: data.user
      });
    }
    
    return orgTokens;
  }
}

// Export for use by other scripts
export { AuthTestSetup, TEST_ORGS, TEST_USERS };

// Run setup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const setup = new AuthTestSetup();
  
  (async () => {
    try {
      const tokens = await setup.setupTestUsers();
      setup.printTokensForTesting();
      
      // Save tokens to file for use by WebSocket test
      const fs = (await import('fs')).default;
      const tokenData = setup.getTokensByOrganization();
      fs.writeFileSync('./test-auth-tokens.json', JSON.stringify(tokenData, null, 2));
      console.log('\n💾 Tokens saved to test-auth-tokens.json');
      
      process.exit(0);
    } catch (error) {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    }
  })();
}