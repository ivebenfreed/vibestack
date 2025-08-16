#!/usr/bin/env node

const crypto = require('crypto');

const secret = '8a643f4687a03292bfdc86310af19f6d2ba505c434df83f859648635246095ac';
const payload = '{"test":"data"}';

console.log('Secret:', secret);
console.log('Payload:', payload);

const signature = crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

console.log('Generated signature:', signature);
console.log('Full header value: sha256=' + signature);

// Test different payloads
const testPayloads = [
  '{"test":"data"}',
  '{"type":"ping","data":{"message":"test"}}',
  JSON.stringify({"test":"data"}),
  JSON.stringify({"type":"ping","data":{"message":"test"}})
];

console.log('\nTesting different payload formats:');
testPayloads.forEach((p, i) => {
  const sig = crypto.createHmac('sha256', secret).update(p).digest('hex');
  console.log(`${i+1}. "${p}" -> sha256=${sig}`);
});