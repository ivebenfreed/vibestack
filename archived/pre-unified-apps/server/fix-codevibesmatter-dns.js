#!/usr/bin/env node

async function fixCodevibesmatterDNS() {
  const TUNNEL_ID = '9caf1167-d6ce-4422-9db1-e5ab8fbbe32c';
  
  console.log('🔧 Setting up codevibesmatter.com DNS for cloudflared tunnel...\n');
  
  console.log('📋 Tunnel Information:');
  console.log(`   Tunnel ID: ${TUNNEL_ID}`);
  console.log(`   Tunnel Name: vibestack-dev`);
  console.log(`   Target: ${TUNNEL_ID}.cfargotunnel.com\n`);
  
  console.log('🌐 Required DNS Records (set these in your Cloudflare dashboard):');
  console.log('');
  console.log('   Domain: codevibesmatter.com');
  console.log('   -----------------------------------------');
  console.log(`   1. Name: dev`);
  console.log(`      Type: CNAME`);
  console.log(`      Target: ${TUNNEL_ID}.cfargotunnel.com`);
  console.log('');
  
  console.log('🎯 Steps to fix:');
  console.log('1. Go to Cloudflare Dashboard → DNS → Records');
  console.log('2. Find and update/add the CNAME records above');
  console.log('3. Wait 1-2 minutes for DNS propagation');
  console.log('4. Test: curl https://dev.codevibesmatter.com/api/health');
  console.log('');
  
  console.log('💡 Alternative - try cloudflared CLI commands:');
  console.log(`   cloudflared tunnel route dns vibestack-dev dev.codevibesmatter.com`);
  console.log('');
  
  // Test current DNS resolution
  console.log('🔍 Testing current DNS resolution...');
  
  try {
    // Use Node.js dns module to check resolution
    const dns = require('dns').promises;
    
    try {
      const addresses = await dns.lookup('dev.codevibesmatter.com');
      console.log(`   ✅ dev.codevibesmatter.com resolves to: ${addresses.address}`);
    } catch (err) {
      console.log(`   ❌ dev.codevibesmatter.com does not resolve: ${err.message}`);
    }
    
    try {
      const cname = await dns.resolveCname('dev.codevibesmatter.com');
      console.log(`   📋 CNAME record: ${cname.join(', ')}`);
    } catch (err) {
      console.log(`   📋 No CNAME record found (might be A record instead)`);
    }
    
  } catch (error) {
    console.log('   ⚠️  DNS test failed:', error.message);
  }
}

fixCodevibesmatterDNS().catch(console.error);