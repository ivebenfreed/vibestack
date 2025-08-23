#!/usr/bin/env node

async function updateDevWebhookToDirect() {
  const POLAR_ACCESS_TOKEN = process.env.POLAR_ACCESS_TOKEN || 'polar_oat_sc2PoBdh3tbdnVVBZFrE6bQ08bKazib4r1hap1MdxM2';
  const POLAR_BASE_URL = 'https://api.polar.sh/v1';

  // Use the dev subdomain instead of direct tunnel URL
  const TUNNEL_URL = 'https://dev.codevibesmatter.com/api/polar/webhooks';
  
  try {
    console.log('🔧 Updating development webhook to use dev subdomain...\n');
    
    // Find the development webhook (codevibesmatter.com one)
    const webhooksResponse = await fetch(`${POLAR_BASE_URL}/webhooks/endpoints`, {
      headers: {
        'Authorization': `Bearer ${POLAR_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!webhooksResponse.ok) {
      throw new Error(`Failed to fetch webhooks: ${webhooksResponse.status}`);
    }

    const webhooksData = await webhooksResponse.json();
    const devWebhook = webhooksData.items?.find(w => 
      w.url.includes('codevibesmatter.com')
    );

    if (!devWebhook) {
      console.log('❌ Development webhook not found');
      return;
    }

    console.log(`📡 Found development webhook: ${devWebhook.id}`);
    console.log(`   Current URL: ${devWebhook.url}`);
    console.log(`   New URL: ${TUNNEL_URL}\n`);

    // Update the webhook
    const updateResponse = await fetch(`${POLAR_BASE_URL}/webhooks/endpoints/${devWebhook.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${POLAR_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: TUNNEL_URL,
        events: devWebhook.events,
        format: 'raw'
      })
    });

    if (updateResponse.ok) {
      const updatedWebhook = await updateResponse.json();
      console.log('✅ Successfully updated development webhook!');
      console.log(`   ID: ${updatedWebhook.id}`);
      console.log(`   URL: ${updatedWebhook.url}`);
      console.log(`   Events: ${updatedWebhook.events?.length || 0} events`);
      
      // Test the endpoint
      console.log('\n🧪 Testing webhook endpoint...');
      const testResponse = await fetch(TUNNEL_URL.replace('/api/polar/webhooks', '/api/polar/health'));
      
      if (testResponse.ok) {
        const healthData = await testResponse.json();
        console.log('✅ Health check passed:', healthData);
      } else {
        console.log(`⚠️  Health check failed: ${testResponse.status}`);
      }
      
    } else {
      const errorBody = await updateResponse.text();
      console.log('❌ Failed to update webhook:');
      console.log(`   Status: ${updateResponse.status} ${updateResponse.statusText}`);
      console.log(`   Error: ${errorBody}`);
    }

  } catch (error) {
    console.error('❌ Error updating development webhook:', error.message);
  }
}

updateDevWebhookToDirect().catch(console.error);