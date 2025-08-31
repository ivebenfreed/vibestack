#!/usr/bin/env node

/**
 * Organization Membership Testing
 * Tests adding users to organizations with proper roles
 */

const fs = require('fs');

async function apiCall(method, endpoint, data = null) {
  const fetch = (await import('node-fetch')).default;
  
  // Read session cookies
  let cookieHeader = '';
  try {
    const cookieContent = fs.readFileSync('../cookies.txt', 'utf8');
    const cookieMatch = cookieContent.match(/better-auth\.session_token\s+([^\s]+)/);
    if (cookieMatch) {
      cookieHeader = `better-auth.session_token=${decodeURIComponent(cookieMatch[1])}`;
    }
  } catch (error) {
    throw new Error('No session cookies found. Please ensure admin is authenticated.');
  }
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  console.log(`🔗 ${method} ${endpoint}`);
  if (data) console.log('📤', JSON.stringify(data, null, 2));
  
  const response = await fetch(`http://localhost:8787${endpoint}`, options);
  const result = await response.text();
  
  console.log(`📥 ${response.status} ${response.statusText}`);
  
  let jsonResult;
  try {
    jsonResult = JSON.parse(result);
    console.log('📊', JSON.stringify(jsonResult, null, 2));
  } catch (e) {
    console.log('📄 Raw response:', result);
    jsonResult = result;
  }
  
  return {
    status: response.status,
    ok: response.ok,
    data: jsonResult
  };
}

async function testOrganizationMembership() {
  console.log('👥 Testing Organization Membership Assignment\n');
  
  // Load test data
  let organization, users;
  try {
    organization = JSON.parse(fs.readFileSync('./organization-final.json', 'utf8'));
    users = JSON.parse(fs.readFileSync('./users-final.json', 'utf8'));
    console.log(`📋 Loaded organization: ${organization.name}`);
    console.log(`📋 Loaded ${users.length} users for membership testing`);
  } catch (error) {
    console.error('❌ Could not load test data. Run final-techflow-test.cjs first.');
    process.exit(1);
  }
  
  const membershipResults = {
    timestamp: new Date().toISOString(),
    organization_id: organization.id,
    membership_tests: []
  };
  
  console.log('\n=== Testing Organization Membership APIs ===');
  
  // Test 1: Get current organization members
  console.log('\n1. Getting current organization members');
  const membersResponse = await apiCall('GET', `/api/organizations/${organization.id}/members`);
  
  if (membersResponse.ok) {
    console.log(`✅ Current members: ${membersResponse.data.length || 0}`);
    membershipResults.current_members = membersResponse.data;
  } else {
    console.log('⚠️ Could not retrieve current members');
    membershipResults.current_members_error = membersResponse.data;
  }
  
  // Test 2: Add users to organization
  console.log('\n2. Adding users to organization');
  
  for (const userEntry of users) {
    const user = userEntry.user;
    const role = userEntry.intended_role;
    
    console.log(`\n--- Adding ${user.name} as ${role} ---`);
    
    const memberData = {
      user_id: user.id,
      role: role,
      position: userEntry.position || 'Team Member'
    };
    
    const addMemberResponse = await apiCall('POST', `/api/organizations/${organization.id}/members`, memberData);
    
    const testResult = {
      user: user,
      intended_role: role,
      add_member_response: addMemberResponse
    };
    
    if (addMemberResponse.ok) {
      console.log(`✅ Successfully added ${user.name} to organization`);
      testResult.membership_status = 'success';
    } else {
      console.log(`❌ Failed to add ${user.name}: ${addMemberResponse.status}`);
      testResult.membership_status = 'failed';
    }
    
    membershipResults.membership_tests.push(testResult);
  }
  
  // Test 3: Verify organization members after additions
  console.log('\n3. Verifying organization members after additions');
  const updatedMembersResponse = await apiCall('GET', `/api/organizations/${organization.id}/members`);
  
  if (updatedMembersResponse.ok) {
    console.log(`✅ Updated members count: ${updatedMembersResponse.data.length || 0}`);
    membershipResults.updated_members = updatedMembersResponse.data;
    
    // Display member details
    if (updatedMembersResponse.data && updatedMembersResponse.data.length > 0) {
      console.log('\n👥 Organization Members:');
      updatedMembersResponse.data.forEach(member => {
        console.log(`  - ${member.user?.name || member.name || 'Unknown'} (${member.role})`);
      });
    }
  } else {
    console.log('⚠️ Could not retrieve updated members');
    membershipResults.updated_members_error = updatedMembersResponse.data;
  }
  
  // Test 4: Test role-based permissions for different endpoints
  console.log('\n4. Testing role-based access to organization endpoints');
  
  const permissionTests = [
    { endpoint: `/api/organizations/${organization.id}`, method: 'GET', description: 'View organization details' },
    { endpoint: `/api/organizations/${organization.id}`, method: 'PUT', description: 'Update organization', data: { description: 'Updated description for testing' } },
    { endpoint: `/api/organizations`, method: 'GET', description: 'List all organizations' }
  ];
  
  membershipResults.permission_tests = [];
  
  for (const test of permissionTests) {
    console.log(`\nTesting: ${test.description}`);
    
    const permissionResponse = await apiCall(test.method, test.endpoint, test.data);
    
    membershipResults.permission_tests.push({
      test: test.description,
      endpoint: test.endpoint,
      method: test.method,
      response: permissionResponse
    });
    
    if (permissionResponse.ok) {
      console.log(`✅ ${test.description}: Allowed`);
    } else {
      console.log(`❌ ${test.description}: ${permissionResponse.status}`);
    }
  }
  
  // Save results
  fs.writeFileSync('./organization-membership-test-results.json', JSON.stringify(membershipResults, null, 2));
  console.log('\n✅ Saved: organization-membership-test-results.json');
  
  // Summary
  console.log('\n📊 === ORGANIZATION MEMBERSHIP TEST SUMMARY ===');
  console.log(`Organization: ${organization.name}`);
  console.log(`Users Tested: ${users.length}`);
  console.log(`Membership Additions Attempted: ${membershipResults.membership_tests.length}`);
  
  const successful = membershipResults.membership_tests.filter(t => t.membership_status === 'success').length;
  const failed = membershipResults.membership_tests.filter(t => t.membership_status === 'failed').length;
  
  console.log(`✅ Successful Additions: ${successful}`);
  console.log(`❌ Failed Additions: ${failed}`);
  
  if (membershipResults.updated_members) {
    console.log(`👥 Total Organization Members: ${membershipResults.updated_members.length}`);
  }
  
  console.log(`🔐 Permission Tests: ${membershipResults.permission_tests.length}`);
  
  return membershipResults;
}

// Execute if called directly
if (require.main === module) {
  testOrganizationMembership()
    .then(() => {
      console.log('\n🎉 Organization membership testing completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Organization membership testing failed:', error);
      process.exit(1);
    });
}

module.exports = { testOrganizationMembership };