#!/usr/bin/env node

/**
 * Cloudflare Tunnel API Setup Script
 * Creates tunnel and DNS records using Cloudflare API
 */

require('dotenv').config();

// Configuration
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ZONE_NAME = 'codevibesmatter.com';
const SUBDOMAIN = 'webhooks';
const LOCAL_URL = 'http://localhost:8787';

async function setupCloudflareConfig() {
  if (!CLOUDFLARE_API_TOKEN) {
    console.error('❌ CLOUDFLARE_API_TOKEN environment variable required');
    console.log('\n📝 To get your API token:');
    console.log('1. Visit: https://dash.cloudflare.com/profile/api-tokens');
    console.log('2. Create token with Zone:Read, DNS:Edit permissions for codevibesmatter.com');
    console.log('3. Add to .env.local: CLOUDFLARE_API_TOKEN=your_token_here');
    process.exit(1);
  }

  console.log('🌐 Setting up Cloudflare tunnel configuration...\n');

  try {
    // Get zone ID
    console.log(`📋 Getting zone ID for ${ZONE_NAME}...`);
    const zoneResponse = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${ZONE_NAME}`, {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const zoneData = await zoneResponse.json();
    if (!zoneData.success || zoneData.result.length === 0) {
      console.error('❌ Failed to get zone:', zoneData.errors);
      process.exit(1);
    }

    const zoneId = zoneData.result[0].id;
    console.log(`✅ Zone ID: ${zoneId}`);

    // Check if DNS record already exists
    console.log(`\n📋 Checking existing DNS records for ${SUBDOMAIN}.${ZONE_NAME}...`);
    const dnsResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?name=${SUBDOMAIN}.${ZONE_NAME}`, {
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const dnsData = await dnsResponse.json();
    if (!dnsData.success) {
      console.error('❌ Failed to check DNS records:', dnsData.errors);
      process.exit(1);
    }

    let dnsRecord = dnsData.result.find(record => record.name === `${SUBDOMAIN}.${ZONE_NAME}`);

    if (dnsRecord) {
      console.log(`✅ DNS record already exists: ${dnsRecord.name} -> ${dnsRecord.content}`);
    } else {
      console.log(`📝 DNS record doesn't exist yet. You'll need to create it manually or with a tunnel.`);
    }

    // Generate tunnel configuration
    console.log('\n⚙️ Tunnel Configuration:');
    console.log('='.repeat(50));
    console.log(`🔗 Subdomain: ${SUBDOMAIN}.${ZONE_NAME}`);
    console.log(`🎯 Target: ${LOCAL_URL}`);
    console.log(`📍 Zone ID: ${zoneId}`);

    console.log('\n📝 Manual Cloudflare Tunnel Setup:');
    console.log('1. Create tunnel:');
    console.log(`   ./cloudflared-extract/usr/bin/cloudflared tunnel create ${SUBDOMAIN}-webhook`);
    
    console.log('\n2. Create DNS record:');
    console.log(`   ./cloudflared-extract/usr/bin/cloudflared tunnel route dns ${SUBDOMAIN}-webhook ${SUBDOMAIN}.${ZONE_NAME}`);
    
    console.log('\n3. Run tunnel:');
    console.log(`   ./cloudflared-extract/usr/bin/cloudflared tunnel run --url ${LOCAL_URL} ${SUBDOMAIN}-webhook`);

    console.log('\n🧪 Test webhook endpoint:');
    console.log(`curl -X GET https://${SUBDOMAIN}.${ZONE_NAME}/api/polar/health`);

    console.log('\n📋 Polar Webhook Configuration:');
    console.log(`URL: https://${SUBDOMAIN}.${ZONE_NAME}/api/polar/webhooks`);
    console.log('Secret: whsec_8a643f4687a03292bfdc86310af19f6d2ba505c434df83f859648635246095ac');

    console.log('\n✅ Configuration ready!');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  setupCloudflareConfig();
}

module.exports = { setupCloudflareConfig };