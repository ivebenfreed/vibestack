#!/usr/bin/env node

/**
 * Setup development ports for multi-instance support
 * Supports running multiple dev servers for different PRs
 */

const fs = require('fs');
const path = require('path');

// Get PR number from environment or default to 0
const prNumber = process.env.PR_NUMBER || '0';
const offset = parseInt(prNumber) * 10; // Use 10 as offset to avoid conflicts

// Base ports
const BASE_SERVER_PORT = 8787;
const BASE_WEB_PORT = 5173;
const BASE_DB_PORT = 5432;
const BASE_PROXY_PORT = 4444;

// Calculate actual ports
const SERVER_PORT = BASE_SERVER_PORT + offset;
const WEB_PORT = BASE_WEB_PORT + offset;
const DB_PORT = BASE_DB_PORT + offset;
const PROXY_PORT = BASE_PROXY_PORT + offset;

// Export for child processes
process.env.SERVER_PORT = SERVER_PORT.toString();
process.env.WEB_PORT = WEB_PORT.toString();
process.env.DB_PORT = DB_PORT.toString();
process.env.PROXY_PORT = PROXY_PORT.toString();

console.log(`🔧 Setting up development ports for ${prNumber ? `PR #${prNumber}` : 'main development'}`);
console.log(`   Server Port: ${SERVER_PORT}`);
console.log(`   Web Port: ${WEB_PORT}`);
console.log(`   Database Port: ${DB_PORT}`);
console.log(`   Proxy Port: ${PROXY_PORT}`);

// Generate dynamic wrangler config
require('./generate-wrangler-config');

// Generate dynamic vite config
require('./generate-vite-config');

// Update environment files
require('./update-env-files');

console.log('✅ Port configuration complete');