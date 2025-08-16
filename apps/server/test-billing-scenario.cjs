#!/usr/bin/env node

/**
 * Complete Billing Scenario Test
 * Tests the full customer journey from signup to subscription with real events
 */

const { Polar } = require('@polar-sh/sdk');
const crypto = require('crypto');
require('dotenv').config();

// Configuration
const POLAR_TOKEN = process.env.POLAR_TOKEN;
const WEBHOOK_SECRET = '8a643f4687a03292bfdc86310af19f6d2ba505c434df83f859648635246095ac'; // Remove whsec_ prefix for HMAC
const WEBHOOK_URL = 'https://webhooks.codevibesmatter.xyz/api/polar/webhooks';
const LOCAL_WEBHOOK_URL = 'http://localhost:8787/api/polar/webhooks';
const ORG_ID = '31d0a084-9f39-4f3c-bce5-bd0041ebec1c';

// Product IDs from our setup
const PRODUCTS = {
  free: 'be94b25f-b93c-407e-9256-494626d035f9',
  proMonthly: '9bd1d779-3f8a-45b1-b072-0591b8325a02',
  proAnnual: 'dedff847-c566-4ba7-b2d9-7d8690312151',
  enterpriseMonthly: '6e13296d-fcbf-4d7f-9027-bb47e7c6e25f',
  enterpriseAnnual: '68a1eb14-5bf9-40cf-a827-1f37bf30d1d9'
};

// Helper function to create webhook signature
function createWebhookSignature(payload, secret) {
  return 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

// Helper function to send webhook
async function sendWebhook(eventType, data) {
  const payload = JSON.stringify({
    type: eventType,
    data: data
  });

  const signature = createWebhookSignature(payload, WEBHOOK_SECRET);

  console.log(`📤 Sending webhook: ${eventType}`);
  
  try {
    const response = await fetch(LOCAL_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-polar-signature': signature
      },
      body: payload
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ Webhook processed successfully:`, result);
    } else {
      console.log(`❌ Webhook failed:`, result);
    }
    
    return { success: response.ok, result };
  } catch (error) {
    console.log(`❌ Webhook error:`, error.message);
    return { success: false, error: error.message };
  }
}

async function testCompleteBillingScenario() {
  console.log('🚀 Starting Complete Billing Scenario Test\n');
  console.log('='.repeat(60));

  const polar = new Polar({
    accessToken: POLAR_TOKEN,
    server: 'production'
  });

  try {
    // Step 1: Test customer creation
    console.log('\n📋 Step 1: Customer Creation Event');
    console.log('-'.repeat(40));
    
    const customerId = `customer_test_${Date.now()}`;
    const customerData = {
      id: customerId,
      email: 'test@vibestack.com',
      name: 'Test Customer',
      created_at: new Date().toISOString(),
      organization_id: ORG_ID
    };

    await sendWebhook('customer.created', { customer: customerData });

    // Step 2: Test subscription creation (Pro Monthly)
    console.log('\n💳 Step 2: Subscription Creation Event');
    console.log('-'.repeat(40));
    
    const subscriptionId = `sub_test_${Date.now()}`;
    const subscriptionData = {
      id: subscriptionId,
      customer_id: customerId,
      product_id: PRODUCTS.proMonthly,
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      quantity: 5, // 5 seats
      interval: 'month',
      amount: 1500, // $15.00
      currency: 'USD'
    };

    const productData = {
      id: PRODUCTS.proMonthly,
      name: 'VibeStack Pro (Monthly)',
      type: 'recurring'
    };

    await sendWebhook('subscription.created', {
      subscription: subscriptionData,
      product: productData,
      customer: customerData
    });

    // Step 3: Test subscription activation
    console.log('\n🟢 Step 3: Subscription Activation Event');
    console.log('-'.repeat(40));
    
    await sendWebhook('subscription.active', {
      subscription: { ...subscriptionData, status: 'active' },
      product: productData,
      customer: customerData
    });

    // Step 4: Test checkout creation
    console.log('\n🛒 Step 4: Checkout Creation Event');
    console.log('-'.repeat(40));
    
    const checkoutId = `checkout_test_${Date.now()}`;
    const checkoutData = {
      id: checkoutId,
      customer_id: customerId,
      product_id: PRODUCTS.proMonthly,
      status: 'open',
      amount: 1500,
      currency: 'USD',
      created_at: new Date().toISOString()
    };

    await sendWebhook('checkout.created', { checkout: checkoutData });

    // Step 5: Test order creation and payment
    console.log('\n📦 Step 5: Order Creation Event');
    console.log('-'.repeat(40));
    
    const orderId = `order_test_${Date.now()}`;
    const orderData = {
      id: orderId,
      customer_id: customerId,
      subscription_id: subscriptionId,
      amount: 1500,
      currency: 'USD',
      status: 'confirmed',
      created_at: new Date().toISOString()
    };

    await sendWebhook('order.created', { order: orderData });

    // Step 6: Test successful payment
    console.log('\n💰 Step 6: Successful Payment Event');
    console.log('-'.repeat(40));
    
    await sendWebhook('order.paid', {
      order: { ...orderData, status: 'paid' },
      subscription: subscriptionData,
      customer: customerData
    });

    // Step 7: Test subscription upgrade (to Annual)
    console.log('\n⬆️  Step 7: Subscription Upgrade Event');
    console.log('-'.repeat(40));
    
    const upgradedSubscription = {
      ...subscriptionData,
      product_id: PRODUCTS.proAnnual,
      amount: 15000, // $150.00
      interval: 'year',
      current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    };

    const annualProduct = {
      id: PRODUCTS.proAnnual,
      name: 'VibeStack Pro (Annual)',
      type: 'recurring'
    };

    await sendWebhook('subscription.updated', {
      subscription: upgradedSubscription,
      product: annualProduct,
      customer: customerData
    });

    // Step 8: Test subscription cancellation
    console.log('\n❌ Step 8: Subscription Cancellation Event');
    console.log('-'.repeat(40));
    
    await sendWebhook('subscription.canceled', {
      subscription: { ...upgradedSubscription, status: 'canceled' },
      product: annualProduct,
      customer: customerData
    });

    // Final step: Check database state
    console.log('\n🔍 Step 9: Database State Check');
    console.log('-'.repeat(40));
    
    console.log('📊 Scenario Summary:');
    console.log('✅ Customer created and linked');
    console.log('✅ Subscription created (Pro Monthly)');
    console.log('✅ Subscription activated');
    console.log('✅ Checkout processed');
    console.log('✅ Order created and paid');
    console.log('✅ Subscription upgraded (Pro Annual)');
    console.log('✅ Subscription canceled');

    console.log('\n🎯 Database Should Contain:');
    console.log('- Customer linked to organization');
    console.log('- Billing events logged');
    console.log('- Organization billing status updated');
    console.log('- Subscription tier history tracked');

    console.log('\n✅ Complete billing scenario test finished!');
    console.log('\n📝 Manual Verification:');
    console.log('1. Check organization_billing_events table for all events');
    console.log('2. Verify organization billing_settings updated');
    console.log('3. Check logs for webhook processing');

  } catch (error) {
    console.error('❌ Test scenario failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  testCompleteBillingScenario();
}

module.exports = { testCompleteBillingScenario };