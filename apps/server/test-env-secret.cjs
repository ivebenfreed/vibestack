#!/usr/bin/env node

require('dotenv').config();

console.log('Environment check:');
console.log('POLAR_WEBHOOK_SECRET length:', process.env.POLAR_WEBHOOK_SECRET?.length);
console.log('POLAR_WEBHOOK_SECRET value:', process.env.POLAR_WEBHOOK_SECRET);
console.log('With prefix stripped:', process.env.POLAR_WEBHOOK_SECRET?.startsWith('whsec_') 
  ? process.env.POLAR_WEBHOOK_SECRET.substring(6) 
  : process.env.POLAR_WEBHOOK_SECRET);