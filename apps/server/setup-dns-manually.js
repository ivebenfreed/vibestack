#!/usr/bin/env node

async function setupDNSManually() {
  console.log('🔧 Setting up DNS manually for codevibesmatter.com...\n');
  
  const TUNNEL_ID = '9caf1167-d6ce-4422-9db1-e5ab8fbbe32c';
  const TUNNEL_TARGET = `${TUNNEL_ID}.cfargotunnel.com`;
  
  console.log('📋 Manual DNS Setup Instructions:');
  console.log('');
  console.log('1. Go to Cloudflare Dashboard: https://dash.cloudflare.com');
  console.log('2. Select the "codevibesmatter.com" zone');
  console.log('3. Go to DNS → Records');
  console.log('4. Add/Update this CNAME record:');
  console.log('');
  console.log('   ┌─────────────────────────────────────────────────────────┐');
  console.log('   │ Record:                                                 │');
  console.log('   │   Type: CNAME                                           │');
  console.log('   │   Name: dev                                             │');
  console.log(`   │   Target: ${TUNNEL_TARGET}               │`);
  console.log('   │   TTL: Auto                                             │');
  console.log('   │   Proxy: 🟡 Proxied (recommended)                      │');
  console.log('   └─────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('5. Save the records');
  console.log('6. Wait 1-2 minutes for propagation');
  console.log('');
  
  console.log('🧪 Test Commands (run after DNS setup):');
  console.log('   curl https://dev.codevibesmatter.com/api/health');
  console.log('   curl https://dev.codevibesmatter.com/api/polar/health');
  console.log('');
  
  console.log('🎯 Final Webhook Configuration:');
  console.log('   🏠 Local Dev: https://dev.codevibesmatter.com/api/polar/webhooks');
  console.log('   🧪 Staging: https://vibestack-server-staging.team-c5f.workers.dev/api/polar/webhooks');
  console.log('   🚀 Production: https://vibestack-server-production.team-c5f.workers.dev/api/polar/webhooks');
  console.log('');
  
  console.log('💡 Tunnel Management:');
  console.log('   Start: /home/ben-freed/dev/vibestack/scripts/manage-dev-tunnel.sh start');
  console.log('   Stop: /home/ben-freed/dev/vibestack/scripts/manage-dev-tunnel.sh stop');
  console.log('   Status: /home/ben-freed/dev/vibestack/scripts/manage-dev-tunnel.sh status');
}

setupDNSManually().catch(console.error);