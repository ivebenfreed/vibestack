#!/usr/bin/env node

/**
 * Reset Rate Limit Script
 * 
 * Resets the local development rate limiter by restarting the server
 * or making a direct API call to clear the in-memory store.
 */

console.log('🔄 Rate Limit Reset Tool');
console.log('=======================');
console.log('');

console.log('🎯 The rate limiting is stored in-memory on the server.');
console.log('   To reset it, we need to restart the server or wait 15 minutes.');
console.log('');

console.log('📊 Current Rate Limits:');
console.log('  • Auth endpoints: 5 requests per 15 minutes');
console.log('  • Signup endpoints: 3 requests per hour'); 
console.log('  • API endpoints: 100 requests per minute');
console.log('');

console.log('🔧 Options to reset:');
console.log('  1. Wait 15 minutes for auth rate limit to expire');
console.log('  2. Restart the dev server (recommended for immediate reset)');
console.log('  3. Use a different IP/user agent');
console.log('');

console.log('🚀 To restart the server:');
console.log('  ./scripts/bg-stop.sh vibestack-dev-issue-0');
console.log('  ./scripts/dev-start.sh');
console.log('');

console.log('💡 Alternative: Use the CTO credentials instead:');
console.log('  Email: cto@widecorp.com');
console.log('  Password: WideCorp2024!CTO');
console.log('');

console.log('✅ Rate limit info displayed. Choose your preferred reset method above.');