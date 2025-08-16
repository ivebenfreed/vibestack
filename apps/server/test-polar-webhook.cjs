#!/usr/bin/env node

const crypto = require('crypto');

// Test Polar webhook with proper signature
async function testPolarWebhook() {
  const webhookSecret = 'whsec_test_changeme';
  const payload = JSON.stringify({
    type: 'test',
    data: {
      id: 'test_event_123',
      customer: {
        id: 'cust_test_123',
        email: 'test@example.com'
      }
    }
  });

  // Generate correct HMAC signature
  const signature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  const fullSignature = `sha256=${signature}`;

  console.log('Testing Polar webhook...');
  console.log('Payload:', payload);
  console.log('Signature:', fullSignature);

  try {
    const response = await fetch('http://127.0.0.1:8787/api/polar/webhooks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-polar-signature': fullSignature
      },
      body: payload
    });

    const result = await response.text();
    console.log(`Status: ${response.status}`);
    console.log('Response:', result);

    if (response.ok) {
      console.log('✅ Webhook test successful!');
    } else {
      console.log('❌ Webhook test failed');
    }

  } catch (error) {
    console.error('Error testing webhook:', error);
  }
}

testPolarWebhook();