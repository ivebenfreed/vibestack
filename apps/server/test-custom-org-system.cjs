#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Custom Organization System
 * Tests all API endpoints end-to-end with actual database operations
 */

const API_BASE = 'http://localhost:8787/api';
let authToken = null;
let testUserId = null;
let testOrgId = null;
let testMemberId = null;
let testInvitationId = null;

// Test utilities
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const makeRequest = async (method, endpoint, data = null) => {
  const url = `${API_BASE}${endpoint}`;
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    }
  };

  if (authToken) {
    options.headers['Authorization'] = `Bearer ${authToken}`;
  }

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    console.log(`🔄 ${method} ${endpoint}`);
    const response = await fetch(url, options);
    
    let result;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      result = await response.text();
    }
    
    if (!response.ok) {
      console.log(`❌ ${method} ${endpoint} - ${response.status}`);
      console.log('Error:', result);
      return { success: false, status: response.status, data: result };
    }
    
    console.log(`✅ ${method} ${endpoint} - ${response.status}`);
    return { success: true, status: response.status, data: result };
    
  } catch (error) {
    console.log(`💥 ${method} ${endpoint} - Network Error`);
    console.log('Error:', error.message);
    return { success: false, error: error.message };
  }
};

// Authentication setup
async function setupAuth() {
  console.log('\n🔐 Setting up authentication...');
  
  // Create test user with Better Auth
  const signUpData = {
    email: 'test-org@example.com',
    password: 'VerySecureP@ssw0rd!2024Complex',
    name: 'Test User'
  };

  let authResult = await makeRequest('POST', '/auth/sign-up', signUpData);
  
  if (!authResult.success && authResult.data?.error?.includes('already exists')) {
    console.log('User already exists, attempting sign in...');
    authResult = await makeRequest('POST', '/auth/sign-in', {
      email: signUpData.email,
      password: signUpData.password
    });
  }

  if (authResult.success && authResult.data.token) {
    authToken = authResult.data.token;
    testUserId = authResult.data.user.id;
    console.log(`✅ Authenticated as user: ${testUserId}`);
    return true;
  }

  console.log('❌ Authentication failed');
  return false;
}

// Test organization CRUD
async function testOrganizationCRUD() {
  console.log('\n📋 Testing Organization CRUD...');
  
  // 1. Create Organization
  const createOrgData = {
    name: 'Test Organization',
    slug: 'test-org-' + Date.now(),
    description: 'Test organization for API validation',
    industry: 'Technology',
    company_size: '1-10',
    country: 'US',
    timezone: 'UTC',
    subscription_tier: 'free',
    settings: {
      notifications: true,
      public_profile: false
    }
  };

  const createResult = await makeRequest('POST', '/organizations', createOrgData);
  if (!createResult.success) {
    console.log('❌ Failed to create organization');
    return false;
  }

  testOrgId = createResult.data.id;
  console.log(`✅ Created organization: ${testOrgId}`);

  // 2. Get Organization
  const getResult = await makeRequest('GET', `/organizations/${testOrgId}`);
  if (!getResult.success || getResult.data.id !== testOrgId) {
    console.log('❌ Failed to get organization');
    return false;
  }
  console.log('✅ Retrieved organization successfully');

  // 3. List Organizations
  const listResult = await makeRequest('GET', '/organizations');
  if (!listResult.success || !Array.isArray(listResult.data)) {
    console.log('❌ Failed to list organizations');
    return false;
  }
  console.log(`✅ Listed ${listResult.data.length} organizations`);

  // 4. Update Organization
  const updateData = {
    description: 'Updated test organization description',
    company_size: '11-50'
  };

  const updateResult = await makeRequest('PUT', `/organizations/${testOrgId}`, updateData);
  if (!updateResult.success) {
    console.log('❌ Failed to update organization');
    return false;
  }
  console.log('✅ Updated organization successfully');

  // 5. Get Organization Stats
  const statsResult = await makeRequest('GET', `/organizations/${testOrgId}/stats`);
  if (!statsResult.success) {
    console.log('❌ Failed to get organization stats');
    return false;
  }
  console.log('✅ Retrieved organization stats successfully');

  return true;
}

// Test member management
async function testMemberManagement() {
  console.log('\n👥 Testing Member Management...');
  
  if (!testOrgId) {
    console.log('❌ No test organization available');
    return false;
  }

  // 1. List Members (should show owner/creator)
  const listResult = await makeRequest('GET', `/organizations/${testOrgId}/members`);
  if (!listResult.success || !Array.isArray(listResult.data)) {
    console.log('❌ Failed to list members');
    return false;
  }

  const ownerMember = listResult.data.find(m => m.role === 'owner');
  if (!ownerMember) {
    console.log('❌ Owner member not found');
    return false;
  }
  
  console.log(`✅ Found ${listResult.data.length} members (including owner)`);

  // 2. Create a test user to add as member
  const newUserData = {
    email: 'test-member@example.com',
    password: 'VerySecureP@ssw0rd!2024Member',
    name: 'Test Member'
  };

  let newUserResult = await makeRequest('POST', '/auth/sign-up', newUserData);
  if (!newUserResult.success && newUserResult.data?.error?.includes('already exists')) {
    // User exists, get their info
    const signInResult = await makeRequest('POST', '/auth/sign-in', {
      email: newUserData.email,
      password: newUserData.password
    });
    
    if (signInResult.success) {
      testMemberId = signInResult.data.user.id;
    }
  } else if (newUserResult.success) {
    testMemberId = newUserResult.data.user.id;
  }

  if (!testMemberId) {
    console.log('❌ Failed to create/get test member user');
    return false;
  }

  // 3. Add Member
  const addMemberResult = await makeRequest('POST', `/organizations/${testOrgId}/members`, {
    user_id: testMemberId,
    role: 'member'
  });

  if (!addMemberResult.success) {
    console.log('❌ Failed to add member');
    console.log('Error details:', addMemberResult.data);
    return false;
  }
  console.log('✅ Added member successfully');

  // 4. Update Member Role
  const updateMemberResult = await makeRequest('PUT', `/organizations/${testOrgId}/members/${testMemberId}`, {
    role: 'admin',
    title: 'Test Administrator'
  });

  if (!updateMemberResult.success) {
    console.log('❌ Failed to update member');
    return false;
  }
  console.log('✅ Updated member role successfully');

  // 5. List Members Again
  const listAfterUpdate = await makeRequest('GET', `/organizations/${testOrgId}/members`);
  if (!listAfterUpdate.success) {
    console.log('❌ Failed to list members after update');
    return false;
  }

  const updatedMember = listAfterUpdate.data.find(m => m.user_id === testMemberId);
  if (!updatedMember || updatedMember.role !== 'admin') {
    console.log('❌ Member role was not updated correctly');
    return false;
  }
  console.log('✅ Verified member role update');

  return true;
}

// Test invitation system
async function testInvitationSystem() {
  console.log('\n✉️ Testing Invitation System...');
  
  if (!testOrgId) {
    console.log('❌ No test organization available');
    return false;
  }

  // 1. Create Invitation
  const inviteData = {
    email: 'invited-user@example.com',
    role: 'member',
    personal_message: 'Welcome to our test organization!',
    expires_in_hours: 48
  };

  const createInviteResult = await makeRequest('POST', `/organizations/${testOrgId}/invitations`, inviteData);
  if (!createInviteResult.success) {
    console.log('❌ Failed to create invitation');
    console.log('Error details:', createInviteResult.data);
    return false;
  }

  testInvitationId = createInviteResult.data.id;
  console.log(`✅ Created invitation: ${testInvitationId}`);

  // 2. List Invitations
  const listInvitesResult = await makeRequest('GET', `/organizations/${testOrgId}/invitations`);
  if (!listInvitesResult.success || !Array.isArray(listInvitesResult.data)) {
    console.log('❌ Failed to list invitations');
    return false;
  }

  const createdInvite = listInvitesResult.data.find(i => i.id === testInvitationId);
  if (!createdInvite) {
    console.log('❌ Created invitation not found in list');
    return false;
  }
  console.log(`✅ Found ${listInvitesResult.data.length} invitations`);

  // 3. Resend Invitation
  const resendResult = await makeRequest('POST', `/organizations/${testOrgId}/invitations/${testInvitationId}/resend`);
  if (!resendResult.success) {
    console.log('❌ Failed to resend invitation');
    return false;
  }
  console.log('✅ Resent invitation successfully');

  // 4. Cancel Invitation
  const cancelResult = await makeRequest('DELETE', `/organizations/${testOrgId}/invitations/${testInvitationId}`);
  if (!cancelResult.success) {
    console.log('❌ Failed to cancel invitation');
    return false;
  }
  console.log('✅ Cancelled invitation successfully');

  return true;
}

// Test permission system
async function testPermissionSystem() {
  console.log('\n🛡️ Testing Permission System...');
  
  if (!testOrgId || !testMemberId) {
    console.log('❌ No test data available for permission tests');
    return false;
  }

  // Store original token
  const ownerToken = authToken;

  // Try to authenticate as the member user to test permissions
  const memberSignIn = await makeRequest('POST', '/auth/sign-in', {
    email: 'test-member@example.com',
    password: 'VerySecureP@ssw0rd!2024Member'
  });

  if (!memberSignIn.success) {
    console.log('❌ Failed to sign in as member user');
    return false;
  }

  authToken = memberSignIn.data.token;
  console.log('✅ Authenticated as member user');

  // Test permission - member should be able to view but not delete organization
  const viewResult = await makeRequest('GET', `/organizations/${testOrgId}`);
  if (!viewResult.success) {
    console.log('❌ Member should be able to view organization');
    authToken = ownerToken; // Restore
    return false;
  }
  console.log('✅ Member can view organization');

  // Try to delete (should fail)
  const deleteResult = await makeRequest('DELETE', `/organizations/${testOrgId}`);
  if (deleteResult.success) {
    console.log('❌ Member should not be able to delete organization');
    authToken = ownerToken; // Restore
    return false;
  }
  console.log('✅ Member correctly blocked from deleting organization');

  // Restore owner token
  authToken = ownerToken;
  console.log('✅ Permission system working correctly');

  return true;
}

// Cleanup test data
async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    if (testMemberId && testOrgId) {
      await makeRequest('DELETE', `/organizations/${testOrgId}/members/${testMemberId}`);
      console.log('✅ Removed test member');
    }

    if (testOrgId) {
      await makeRequest('DELETE', `/organizations/${testOrgId}`);
      console.log('✅ Deleted test organization');
    }
  } catch (error) {
    console.log('⚠️ Some cleanup operations failed:', error.message);
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Custom Organization System Tests');
  console.log('='.repeat(50));

  try {
    // Health check
    const healthResult = await makeRequest('GET', '/health');
    if (!healthResult.success) {
      console.log('❌ Server health check failed');
      return;
    }
    console.log('✅ Server is healthy');

    // Run test suite
    const authSuccess = await setupAuth();
    if (!authSuccess) return;

    const tests = [
      testOrganizationCRUD,
      testMemberManagement,
      testInvitationSystem,
      testPermissionSystem
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
      await delay(500); // Brief pause between tests
    }

    // Results
    console.log('\n📊 Test Results');
    console.log('='.repeat(30));
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

    if (failed === 0) {
      console.log('\n🎉 All tests passed! Custom organization system is working correctly.');
    } else {
      console.log('\n⚠️ Some tests failed. Check the logs above for details.');
    }

  } catch (error) {
    console.log('💥 Test suite crashed:', error.message);
  } finally {
    await cleanup();
  }
}

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };