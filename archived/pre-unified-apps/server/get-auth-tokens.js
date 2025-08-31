#!/usr/bin/env node
/**
 * Get Authentication Tokens for Existing Users
 * 
 * This script attempts to authenticate existing test users and get session tokens
 * for WebSocket testing.
 */

// Test Configuration
const SERVER_URL = 'http://localhost:8787';

const EXISTING_USERS = [
  {
    email: 'viewer@realtest.com',
    password: 'Complex&Pass@987!', // Strong password without common words or sequences
    name: 'Test Viewer'
  },
  {
    email: 'contributor@realtest.com', 
    password: 'Complex&Pass@987!',
    name: 'Test Contributor'
  },
  {
    email: 'member@realtest.com',
    password: 'Complex&Pass@987!', 
    name: 'Test Member'
  }
];

class AuthTokenGetter {
  constructor() {
    this.tokens = new Map();
  }

  async getAuthTokens() {
    console.log('🔐 Attempting to get auth tokens for existing users...');
    
    for (const user of EXISTING_USERS) {
      try {
        console.log(`\nTrying to authenticate: ${user.email}`);
        
        // Try different auth endpoints - Better Auth uses specific paths
        const endpoints = [
          '/api/auth/sign-in/email',  // Correct Better Auth endpoint
          '/api/auth/signin/email',   // Alternative
          '/api/auth/sign-in',        // Fallback
          '/api/auth/signin'          // Fallback
        ];
        
        let token = null;
        for (const endpoint of endpoints) {
          token = await this.trySignIn(user, endpoint);
          if (token) {
            console.log(`✅ Got token via ${endpoint} for ${user.email}`);
            break;
          }
        }
        
        if (token) {
          this.tokens.set(user.email, {
            token,
            user
          });
        } else {
          console.log(`❌ Could not authenticate ${user.email}`);
        }
        
      } catch (error) {
        console.error(`❌ Error with ${user.email}:`, error.message);
      }
    }
    
    console.log(`\n📊 Authentication complete. ${this.tokens.size} tokens obtained.`);
    return this.tokens;
  }

  async trySignIn(user, endpoint) {
    try {
      console.log(`  Trying ${endpoint}...`);
      
      const response = await fetch(`${SERVER_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          password: user.password
        })
      });

      console.log(`  Response: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        return null;
      }

      // Try to extract session token from Set-Cookie header
      const setCookieHeader = response.headers.get('Set-Cookie');
      if (setCookieHeader) {
        const tokenMatch = setCookieHeader.match(/better-auth\.session_token=([^;]+)/);
        if (tokenMatch) {
          return tokenMatch[1];
        }
      }

      // Try response body
      const result = await response.json();
      if (result.token || result.sessionToken) {
        return result.token || result.sessionToken;
      }

      return null;
    } catch (error) {
      console.log(`  Error: ${error.message}`);
      return null;
    }
  }

  async testWebSocketConnection(email, token) {
    return new Promise((resolve) => {
      const WebSocket = (async () => (await import('ws')).default)();
      
      WebSocket.then(WS => {
        // Test with the first organization we know exists
        const orgSlug = 'techstartup-inc';
        const clientId = `test-${Date.now()}`;
        const wsUrl = `ws://localhost:8787/api/sync/connect/${orgSlug}?clientId=${clientId}&lsn=0/0&auth=${token}`;
        
        console.log(`🔗 Testing WebSocket connection for ${email}...`);
        console.log(`   URL: ${wsUrl.replace(token, token.substring(0, 10) + '...')}`);
        
        const ws = new WS(wsUrl);
        
        const timeout = setTimeout(() => {
          ws.close();
          resolve({ success: false, error: 'Timeout' });
        }, 5000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          console.log(`✅ WebSocket connected successfully for ${email}`);
          ws.close();
          resolve({ success: true });
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            console.log(`📨 Received message:`, message);
          } catch (e) {
            console.log(`📨 Received:`, data.toString());
          }
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          console.log(`❌ WebSocket error for ${email}:`, error.message);
          resolve({ success: false, error: error.message });
        });
        
        ws.on('close', (code, reason) => {
          clearTimeout(timeout);
          console.log(`🔌 WebSocket closed for ${email}: ${code} ${reason}`);
        });
      });
    });
  }

  async testAllConnections() {
    console.log('\n🧪 Testing WebSocket connections with auth tokens...');
    
    for (const [email, data] of this.tokens) {
      await this.testWebSocketConnection(email, data.token);
      // Wait a bit between connections
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  printResults() {
    console.log('\n🎯 Final Results:');
    console.log('='.repeat(50));
    
    if (this.tokens.size === 0) {
      console.log('❌ No authentication tokens obtained.');
      console.log('📝 Next steps:');
      console.log('   1. Check if users exist in database');
      console.log('   2. Verify correct passwords');
      console.log('   3. Check auth endpoint paths');
      return;
    }
    
    for (const [email, data] of this.tokens) {
      console.log(`\n✅ ${email}`);
      console.log(`   Token: ${data.token.substring(0, 20)}...`);
      console.log(`   WebSocket Test: Use this token for manual testing`);
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const getter = new AuthTokenGetter();
  
  (async () => {
    try {
      await getter.getAuthTokens();
      await getter.testAllConnections();
      getter.printResults();
      process.exit(0);
    } catch (error) {
      console.error('❌ Script failed:', error);
      process.exit(1);
    }
  })();
}

export { AuthTokenGetter };