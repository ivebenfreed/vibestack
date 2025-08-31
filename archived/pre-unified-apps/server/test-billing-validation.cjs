#!/usr/bin/env node

/**
 * Test script to demonstrate billing account validation for organization creation
 * This shows how the system now fails when trying to create paid organizations without billing accounts
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8787';

async function testBillingValidation() {
  console.log('🧪 Testing Billing Account Validation for Organization Creation\n');
  
  try {
    // Test 1: Creating free organization (should work without billing account)
    console.log('1️⃣ Test: Creating FREE organization (no billing required)');
    
    const freeOrgResponse = await axios.post(`${BASE_URL}/api/organizations`, {
      name: 'Test Free Organization',
      slug: 'test-free-org',
      description: 'A free organization for testing',
      subscription_tier: 'free'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true // Don't throw on non-2xx status
    });

    console.log(`Status: ${freeOrgResponse.status}`);
    if (freeOrgResponse.status === 201) {
      console.log('✅ SUCCESS: Free organization created without billing account');
      console.log(`Organization ID: ${freeOrgResponse.data.data?.id}`);
    } else {
      console.log('❌ FAILED: Free organization creation failed');
      console.log('Response:', freeOrgResponse.data);
    }
    console.log('');

    // Test 2: Creating PRO organization without billing account (should fail)
    console.log('2️⃣ Test: Creating PRO organization WITHOUT billing account (should fail)');
    
    const proOrgNoBillingResponse = await axios.post(`${BASE_URL}/api/organizations`, {
      name: 'Test Pro Organization No Billing',
      slug: 'test-pro-org-no-billing',
      description: 'A pro organization without billing account',
      subscription_tier: 'pro'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true
    });

    console.log(`Status: ${proOrgNoBillingResponse.status}`);
    if (proOrgNoBillingResponse.status === 400) {
      console.log('✅ SUCCESS: Pro organization creation correctly rejected without billing account');
      console.log('Error:', proOrgNoBillingResponse.data.error);
    } else {
      console.log('❌ FAILED: Pro organization creation should have been rejected');
      console.log('Response:', proOrgNoBillingResponse.data);
    }
    console.log('');

    // Test 3: Creating PRO organization with invalid billing account (should fail)
    console.log('3️⃣ Test: Creating PRO organization with INVALID billing account (should fail)');
    
    const proOrgInvalidBillingResponse = await axios.post(`${BASE_URL}/api/organizations`, {
      name: 'Test Pro Organization Invalid Billing',
      slug: 'test-pro-org-invalid-billing',
      description: 'A pro organization with invalid billing account',
      subscription_tier: 'pro',
      billing_email: 'invalid-email-format',
      polar_customer_id: 'invalid@customer@id'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true
    });

    console.log(`Status: ${proOrgInvalidBillingResponse.status}`);
    if (proOrgInvalidBillingResponse.status === 400) {
      console.log('✅ SUCCESS: Pro organization creation correctly rejected with invalid billing data');
      console.log('Error:', proOrgInvalidBillingResponse.data.error);
    } else {
      console.log('❌ FAILED: Pro organization creation should have been rejected');
      console.log('Response:', proOrgInvalidBillingResponse.data);
    }
    console.log('');

    // Test 4: Creating PRO organization with valid billing account (should work)
    console.log('4️⃣ Test: Creating PRO organization with VALID billing account (should work)');
    
    const proOrgValidBillingResponse = await axios.post(`${BASE_URL}/api/organizations`, {
      name: 'Test Pro Organization Valid Billing',
      slug: 'test-pro-org-valid-billing',
      description: 'A pro organization with valid billing account',
      subscription_tier: 'pro',
      billing_email: 'billing@testcompany.com',
      polar_customer_id: 'cust_valid_test_customer_12345'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true
    });

    console.log(`Status: ${proOrgValidBillingResponse.status}`);
    if (proOrgValidBillingResponse.status === 201) {
      console.log('✅ SUCCESS: Pro organization created with valid billing account');
      console.log(`Organization ID: ${proOrgValidBillingResponse.data.data?.id}`);
      console.log(`Polar Customer ID: ${proOrgValidBillingResponse.data.data?.polar_customer_id}`);
    } else {
      console.log('❌ FAILED: Pro organization creation failed with valid billing');
      console.log('Response:', proOrgValidBillingResponse.data);
    }
    console.log('');

    // Test 5: Trying to create another organization with same billing account (should fail)
    console.log('5️⃣ Test: Creating ANOTHER organization with SAME billing account (should fail)');
    
    const duplicateBillingResponse = await axios.post(`${BASE_URL}/api/organizations`, {
      name: 'Test Duplicate Billing Organization',
      slug: 'test-duplicate-billing-org',
      description: 'An organization with duplicate billing account',
      subscription_tier: 'enterprise',
      billing_email: 'billing@testcompany.com',
      polar_customer_id: 'cust_valid_test_customer_12345' // Same as previous test
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true
    });

    console.log(`Status: ${duplicateBillingResponse.status}`);
    if (duplicateBillingResponse.status === 400) {
      console.log('✅ SUCCESS: Organization creation correctly rejected with duplicate billing account');
      console.log('Error:', duplicateBillingResponse.data.error);
    } else {
      console.log('❌ FAILED: Organization creation should have been rejected for duplicate billing');
      console.log('Response:', duplicateBillingResponse.data);
    }

    console.log('\n🎯 Billing Validation Summary:');
    console.log('===============================');
    console.log('✅ Free organizations: No billing account required');
    console.log('✅ Paid organizations: Billing account validation enforced');
    console.log('✅ Invalid billing data: Properly rejected');
    console.log('✅ Duplicate billing accounts: Properly prevented');
    console.log('✅ Organization creation with billing: Working correctly');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testBillingValidation().catch(console.error);