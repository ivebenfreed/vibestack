#!/usr/bin/env node

/**
 * Generate .env.local file with dynamic ports for worktree development
 * This integrates with Wrangler 4's new .env file support
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function detectIssueNumber() {
  // Try to detect issue number from various sources
  
  // 1. Environment variable (manual override)
  if (process.env.PR_NUMBER) {
    return process.env.PR_NUMBER;
  }
  
  // 2. Git branch name (issue-123, feature-456, pr-789)
  try {
    const branchName = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    const match = branchName.match(/(?:issue-|feature-|pr-)(\d+)/);
    if (match) {
      console.log(`🔍 Auto-detected issue number ${match[1]} from branch: ${branchName}`);
      return match[1];
    }
  } catch (error) {
    // Git command failed, continue
  }
  
  // 3. Working directory name (worktrees/issue-123)
  const cwd = process.cwd();
  const dirMatch = cwd.match(/issue-(\d+)/);
  if (dirMatch) {
    console.log(`🔍 Auto-detected issue number ${dirMatch[1]} from directory: ${cwd}`);
    return dirMatch[1];
  }
  
  // Check for MAIN_MODE flag
  if (process.env.MAIN_MODE === 'true') {
    console.log('🏠 MAIN_MODE detected - using default ports');
    return '0';
  }
  
  // Default to 0 (main development)
  return '0';
}

function generateEnvLocal() {
  const issueNumber = detectIssueNumber();
  const offset = parseInt(issueNumber);
  
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
  
  // Read base .env if it exists, otherwise use defaults
  const serverDir = path.join(__dirname, '..', 'apps', 'server');
  const envPath = path.join(serverDir, '.env');
  const envLocalPath = path.join(serverDir, '.env.local');
  
  let baseEnv = '';
  if (fs.existsSync(envPath)) {
    baseEnv = fs.readFileSync(envPath, 'utf8');
  } else {
    console.log('⚠️  No .env file found, using defaults');
    baseEnv = `# Base environment configuration
DATABASE_URL=postgresql://neondb_owner:npg_N2CLXIVGK9Ra@ep-tight-forest-a4hnhb61-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
NEON_API_KEY=napi_z1ema88q0fv6fcv3sbo8q1ux73db2waa1gka1idfz4hn554lbdcdbt66klvgvo6c
API_URL=https://127.0.0.1:8787
ENVIRONMENT=development
LOG_TIMESTAMP_FORMAT=iso
LOG_LEVEL=info
BETTER_AUTH_SECRET="NXlg2n5ouDPKtoHHOvUvc8pcQztoW8bpIN5B+jdC3Yk="
BETTER_AUTH_URL="http://localhost:5173"
BOOTSTRAP_SECRET="c1a7b3e2d8f0c9a1b3e2d8f0c9a1b3e2d8f0c9a1b3e2d8f0c9a1b3e2d8f0c9a1"
RESEND_API_KEY="re_jdbsLnkN_45KiUYXRGskuFXE7Gth6wqM6"`;
  }
  
  // Create .env.local with overrides for local development
  const envLocalContent = `# Auto-generated .env.local for ${issueNumber !== '0' ? `Issue #${issueNumber}` : 'main development'}
# This file overrides values from .env for local development
# Generated on ${new Date().toISOString()}

# Dynamic ports for worktree isolation
WEB_PORT=${WEB_PORT}
SERVER_PORT=${SERVER_PORT}
DB_PORT=${DB_PORT}
PROXY_PORT=${PROXY_PORT}

# Local database configuration (overrides remote DATABASE_URL)
DATABASE_URL=postgres://postgres:postgres@localhost:${DB_PORT}/vibestack_dev
DIRECT_DATABASE_URL=postgres://postgres:postgres@localhost:${DB_PORT}/vibestack_dev
LOCAL_DATABASE_URL=postgres://postgres:postgres@localhost:${DB_PORT}/vibestack_dev

# Local development environment
ENVIRONMENT=local
BETTER_AUTH_URL=http://localhost:${WEB_PORT}
API_URL=http://localhost:${SERVER_PORT}

# Issue tracking
ISSUE_NUMBER=${issueNumber}
`;
  
  // Write the .env.local file
  fs.writeFileSync(envLocalPath, envLocalContent);
  
  console.log(`✅ Generated ${envLocalPath}`);
  console.log(`   📍 Issue: ${issueNumber !== '0' ? `#${issueNumber}` : 'main'}`);
  console.log(`   🌐 Web Port: ${WEB_PORT}`);
  console.log(`   🚀 Server Port: ${SERVER_PORT}`);
  console.log(`   🗄️  Database Port: ${DB_PORT}`);
  console.log(`   🔗 Proxy Port: ${PROXY_PORT}`);
  
  return {
    SERVER_PORT,
    WEB_PORT,
    DB_PORT,
    PROXY_PORT,
    ISSUE_NUMBER: issueNumber
  };
}

// Export for use in other scripts
if (require.main === module) {
  generateEnvLocal();
}

module.exports = { generateEnvLocal, detectIssueNumber };