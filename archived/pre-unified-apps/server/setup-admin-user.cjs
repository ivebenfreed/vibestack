#!/usr/bin/env node

/**
 * Setup Admin User for TechFlow Organization Creation
 * Creates an authenticated admin user to perform organization setup
 */

async function setupAdminUser() {
  const fetch = (await import('node-fetch')).default;
  const API_BASE = 'http://localhost:8787';
  
  console.log('🔐 Setting up admin user for TechFlow organization creation...');
  
  try {
    // Create admin user
    const adminData = {
      name: "TechFlow Admin",
      email: "admin@techflow.solutions",
      password: "X9#mK8$nP2@vQ7!wE5"
    };
    
    console.log('Creating admin user account...');
    const response = await fetch(`${API_BASE}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(adminData)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ Failed to create admin user:', result);
      return null;
    }
    
    console.log('✅ Created admin user:', result.user.email);
    
    // Get sign-in session
    console.log('Signing in admin user...');
    const signInResponse = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: adminData.email,
        password: adminData.password
      })
    });
    
    const signInResult = await signInResponse.json();
    
    if (!signInResponse.ok) {
      console.error('❌ Failed to sign in admin user:', signInResult);
      return null;
    }
    
    console.log('✅ Admin user signed in successfully');
    
    // Extract session token from cookies
    const cookies = signInResponse.headers.get('set-cookie') || '';
    console.log('🍪 Session cookies:', cookies);
    
    return {
      user: result.user,
      sessionCookies: cookies
    };
    
  } catch (error) {
    console.error('❌ Error setting up admin user:', error);
    return null;
  }
}

// Execute if called directly
if (require.main === module) {
  setupAdminUser()
    .then((result) => {
      if (result) {
        console.log('\n✅ Admin user setup completed successfully!');
        console.log('User ID:', result.user.id);
        console.log('Session established for organization creation');
      } else {
        console.log('\n❌ Admin user setup failed');
      }
    })
    .catch((error) => {
      console.error('\n💥 Admin user setup error:', error);
    });
}

module.exports = { setupAdminUser };