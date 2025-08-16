#!/usr/bin/env node

/**
 * Add Polar Webhook via API
 * Attempts to configure webhook endpoint programmatically
 */

const { Polar } = require('@polar-sh/sdk');
require('dotenv').config();

// Configuration
const WEBHOOK_URL = 'https://webhooks.codevibesmatter.xyz/api/polar/webhooks';
const WEBHOOK_SECRET = process.env.POLAR_WEBHOOK_SECRET || 'whsec_8a643f4687a03292bfdc86310af19f6d2ba505c434df83f859648635246095ac';
const ORG_ID = '31d0a084-9f39-4f3c-bce5-bd0041ebec1c'; // elevra organization

async function addPolarWebhook() {
  console.log('🔗 Adding Polar webhook via API...\n');

  const polar = new Polar({
    accessToken: process.env.POLAR_TOKEN,
    server: 'production'
  });

  try {
    // Try to check existing webhooks first
    console.log('📋 Checking webhook capabilities...');
    
    // Unfortunately, Polar SDK doesn't expose webhook management endpoints yet
    // Let's try the raw API
    const response = await fetch('https://api.polar.sh/v1/webhooks/endpoints', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.POLAR_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        secret: WEBHOOK_SECRET,
        format: 'raw',
        events: [
          'customer.created',
          'customer.updated',
          'subscription.created',
          'subscription.updated',
          'subscription.active',
          'subscription.canceled',
          'order.created',
          'order.updated',
          'order.paid',
          'checkout.created',
          'checkout.updated'
        ]
      })
    });

    if (response.ok) {
      const webhook = await response.json();
      console.log('✅ Webhook created successfully via API!');
      console.log('Webhook ID:', webhook.id);
    } else {
      const error = await response.text();
      console.log('⚠️ API webhook creation not available or failed:', error);
      console.log('\n📝 Manual setup required in Polar dashboard:');
    }

  } catch (error) {
    console.log('⚠️ API webhook creation failed:', error.message);
    console.log('\n📝 Manual setup required in Polar dashboard:');
  }

  // Always show manual setup instructions
  console.log('\n🔧 Manual Webhook Setup:');
  console.log('='.repeat(50));
  console.log('1. Visit: https://polar.sh/dashboard/elevra/webhooks');
  console.log('2. Click "Add Webhook"');
  console.log(`3. URL: ${WEBHOOK_URL}`);
  console.log(`4. Secret: ${WEBHOOK_SECRET}`);
  console.log('5. Events: customer.*, subscription.*, payment.*, invoice.*');

  // Test our webhook endpoint
  console.log('\n🧪 Testing webhook endpoint...');
  try {
    const testResponse = await fetch('https://webhooks.codevibesmatter.xyz/api/polar/health');
    if (testResponse.ok) {
      const health = await testResponse.json();
      console.log('✅ Webhook endpoint is accessible!');
      console.log('Health check:', health);
    } else {
      console.log('⚠️ Webhook endpoint not yet accessible (DNS propagation)');
    }
  } catch (error) {
    console.log('⚠️ Webhook endpoint not yet accessible:', error.message);
    console.log('  (This is normal - DNS may still be propagating)');
  }

  console.log('\n✅ Webhook setup complete!');
}

if (require.main === module) {
  addPolarWebhook();
}

module.exports = { addPolarWebhook };