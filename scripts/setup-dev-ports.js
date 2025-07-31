#!/usr/bin/env node

/**
 * Setup development ports for multi-instance support
 * Supports running multiple dev servers for different PRs
 */

const fs = require('fs');
const path = require('path');

// For main development, we don't actually need to check ports
// The system will fail naturally if ports are in use
// This keeps the code simple and avoids race conditions

function detectIssueNumber() {
  // Try to detect issue number from various sources
  
  // 1. Environment variable (manual override)
  if (process.env.PR_NUMBER) {
    return process.env.PR_NUMBER;
  }
  
  // 2. Git branch name (issue-123, feature-456, pr-789)
  try {
    const { execSync } = require('child_process');
    const branchName = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    const match = branchName.match(/(?:issue-|feature-|pr-)(\d+)/);
    if (match) {
      console.log(`🔍 Auto-detected issue number ${match[1]} from branch: ${branchName}`);
      return match[1];
    }
  } catch (error) {
    // Git command failed, continue
  }
  
  // 3. Package.json name (vibestack-issue-123)
  try {
    const fs = require('fs');
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const match = packageJson.name.match(/issue-(\d+)/);
    if (match) {
      console.log(`🔍 Auto-detected issue number ${match[1]} from package.json: ${packageJson.name}`);
      return match[1];
    }
  } catch (error) {
    // package.json read failed, continue
  }
  
  // 4. Working directory name (vibestack-issue-123)
  const cwd = process.cwd();
  const dirMatch = cwd.match(/vibestack-issue-(\d+)/);
  if (dirMatch) {
    console.log(`🔍 Auto-detected issue number ${dirMatch[1]} from directory: ${cwd}`);
    return dirMatch[1];
  }
  
  // Default to 0 (main development)
  return '0';
}

async function setupPorts() {
  // Get PR number from environment variable (set in package.json scripts)
  const prNumber = process.env.PR_NUMBER || '0';
  const offset = parseInt(prNumber) * 10; // Use 10 as offset to avoid conflicts

  // Base ports
  const BASE_SERVER_PORT = 8787;
  const BASE_WEB_PORT = 5173;
  const BASE_DB_PORT = 5432;
  const BASE_PROXY_PORT = 4444;

  // Calculate ports with offset
  const SERVER_PORT = BASE_SERVER_PORT + offset;
  const WEB_PORT = BASE_WEB_PORT + offset;
  const DB_PORT = BASE_DB_PORT + offset;
  const PROXY_PORT = BASE_PROXY_PORT + offset;

  // Export for child processes
  process.env.SERVER_PORT = SERVER_PORT.toString();
  process.env.WEB_PORT = WEB_PORT.toString();
  process.env.DB_PORT = DB_PORT.toString();
  process.env.PROXY_PORT = PROXY_PORT.toString();
  process.env.PR_NUMBER = prNumber;

  console.log(`🔧 Setting up development ports for ${prNumber !== '0' ? `PR #${prNumber}` : 'main development'}`);
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
}

// Run the setup
setupPorts().catch(error => {
  console.error('Error setting up ports:', error);
  process.exit(1);
});