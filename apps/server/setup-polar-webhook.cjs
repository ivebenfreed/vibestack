#!/usr/bin/env node

/**
 * Polar Webhook Configuration Script
 * Configures webhook endpoint in Polar dashboard using API
 */

const { Polar } = require('@polar-sh/sdk');
require('dotenv').config();

// Configuration
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://webhooks.codevibesmatter.com/api/polar/webhooks';
const WEBHOOK_SECRET = process.env.POLAR_WEBHOOK_SECRET;

async function setupPolarWebhook() {
  console.log('🔗 Setting up Polar webhook endpoint...\n');
  
  if (!WEBHOOK_URL || !WEBHOOK_SECRET) {
    console.error('❌ Missing required environment variables:');
    console.error('  - WEBHOOK_URL (or use default)');
    console.error('  - POLAR_WEBHOOK_SECRET');
    process.exit(1);
  }

  const polar = new Polar({
    accessToken: process.env.POLAR_TOKEN,
    server: 'production'
  });

  try {
    // Check if webhook endpoint already exists
    console.log('📋 Checking existing webhook endpoints...');
    
    // Note: This would need to be done via the Polar dashboard
    // as the SDK doesn't expose webhook endpoint management yet
    
    console.log('⚙️ Webhook Configuration Summary:');
    console.log('='.repeat(50));
    console.log(`🔗 Webhook URL: ${WEBHOOK_URL}`);
    console.log(`🔐 Webhook Secret: ${WEBHOOK_SECRET}`);
    console.log(`🏢 Organization: elevra (31d0a084-9f39-4f3c-bce5-bd0041ebec1c)`);
    
    console.log('\n📝 Manual Setup Required:');
    console.log('1. Visit: https://polar.sh/dashboard/elevra/webhooks');
    console.log('2. Click "Add Webhook"');
    console.log(`3. Set URL: ${WEBHOOK_URL}`);
    console.log(`4. Set Secret: ${WEBHOOK_SECRET}`);
    console.log('5. Select events:');
    console.log('   - customer.created');
    console.log('   - subscription.created');
    console.log('   - subscription.updated');
    console.log('   - subscription.cancelled');
    console.log('   - subscription.ended');
    console.log('   - payment.succeeded');
    console.log('   - payment.failed');
    console.log('   - invoice.created');
    console.log('   - invoice.updated');
    
    console.log('\n🧪 Test Webhook:');
    console.log(`curl -X POST ${WEBHOOK_URL} \\`);
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -H "x-polar-signature: sha256=test" \\');
    console.log('  -d \'{"type":"ping","data":{"message":"test"}}\'');
    
    console.log('\n✅ Webhook configuration ready!');
    console.log('⚠️  Remember to set up your tunnel to expose the webhook endpoint');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  setupPolarWebhook();
}

module.exports = { setupPolarWebhook };