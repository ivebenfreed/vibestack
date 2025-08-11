#!/usr/bin/env node

/**
 * Setup .env.local for worktree development
 * This should be run once when setting up a new worktree
 * It generates the .env.local file with dynamic ports based on issue number
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function detectIssueNumber() {
  // Try to detect issue number from various sources
  
  // 1. Environment variable (manual override)
  if (process.env.ISSUE_NUMBER || process.env.PR_NUMBER) {
    return process.env.ISSUE_NUMBER || process.env.PR_NUMBER;
  }
  
  // 2. Git branch name (issue-123, feature-456, pr-789)
  try {
    const branchName = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    const match = branchName.match(/(?:issue-|feature-|pr-)(\d+)/);
    if (match) {
      return match[1];
    }
  } catch (error) {
    // Git command failed, continue
  }
  
  // 3. Working directory name (worktrees/issue-123)
  const cwd = process.cwd();
  const dirMatch = cwd.match(/issue-(\d+)/);
  if (dirMatch) {
    return dirMatch[1];
  }
  
  // Check for MAIN_MODE flag or staging branch
  try {
    const branchName = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    if (process.env.MAIN_MODE === 'true' || branchName === 'main' || branchName === 'staging') {
      return '0';
    }
  } catch (error) {
    // Git command failed, continue
  }
  
  // Default to 0 (main development)
  return '0';
}

function setupWorktreeEnv() {
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
  
  const serverDir = path.join(__dirname, '..', 'apps', 'server');
  const envPath = path.join(serverDir, '.env');
  const envLocalPath = path.join(serverDir, '.env.local');
  
  // Check if .env.local already exists
  if (fs.existsSync(envLocalPath) && !process.env.FORCE) {
    console.log(`⚠️  .env.local already exists. Use FORCE=true to regenerate.`);
    const existing = fs.readFileSync(envLocalPath, 'utf8');
    const existingIssue = existing.match(/ISSUE_NUMBER=(\d+)/)?.[1];
    if (existingIssue !== issueNumber) {
      console.log(`⚠️  WARNING: Existing .env.local is for issue #${existingIssue} but current branch suggests issue #${issueNumber}`);
      console.log(`   Run 'FORCE=true npm run setup:env' to regenerate`);
    }
    return;
  }
  
  // Check if base .env exists - it should contain all secrets
  if (!fs.existsSync(envPath)) {
    console.log('⚠️  WARNING: No .env file found in apps/server/');
    console.log('   The .env file should contain all secrets and base configuration.');
    console.log('   Create it from .dev.vars.bak or .env.example');
    console.log('');
  }
  
  // Create .env.local with ONLY worktree-specific overrides
  const envLocalContent = `# Worktree-specific overrides for ${issueNumber !== '0' ? `Issue #${issueNumber}` : 'main/staging development'}
# This file overrides values for local development
# Generated on ${new Date().toISOString()}
# To regenerate: FORCE=true npm run setup:env

# Dynamic ports for worktree isolation
WEB_PORT=${WEB_PORT}
SERVER_PORT=${SERVER_PORT}
DB_PORT=${DB_PORT}
PROXY_PORT=${PROXY_PORT}

# Local database configuration (using db.localtest.me for proxy compatibility)
DATABASE_URL=postgres://postgres:postgres@db.localtest.me:${PROXY_PORT}/vibestack_dev${issueNumber !== '0' ? '_issue_' + issueNumber : ''}
DIRECT_DATABASE_URL=postgres://postgres:postgres@localhost:${DB_PORT}/vibestack_dev${issueNumber !== '0' ? '_issue_' + issueNumber : ''}
LOCAL_DATABASE_URL=postgres://postgres:postgres@localhost:${DB_PORT}/vibestack_dev${issueNumber !== '0' ? '_issue_' + issueNumber : ''}

# Local development environment
ENVIRONMENT=local
BETTER_AUTH_URL=http://localhost:${WEB_PORT}
API_URL=http://localhost:${SERVER_PORT}

# Issue tracking
ISSUE_NUMBER=${issueNumber}`;
  
  // Write the .env.local file
  fs.writeFileSync(envLocalPath, envLocalContent);
  
  console.log(`✅ Generated ${envLocalPath}`);
  console.log(`   📍 Issue: ${issueNumber !== '0' ? `#${issueNumber}` : 'main/staging'}`);
  console.log(`   🌐 Web Port: ${WEB_PORT}`);
  console.log(`   🚀 Server Port: ${SERVER_PORT}`);
  console.log(`   🗄️  Database Port: ${DB_PORT}`);
  console.log(`   🔗 Proxy Port: ${PROXY_PORT}`);
  console.log('');
  console.log('📝 Note: This file is loaded automatically by Wrangler 4+');
  console.log('   .env.local takes precedence over .env for local development');
  console.log('   To switch between local and remote DB, rename or delete .env.local');
}

// Run the setup
try {
  setupWorktreeEnv();
} catch (error) {
  console.error('❌ Error setting up worktree environment:', error);
  process.exit(1);
}