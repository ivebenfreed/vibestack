#!/usr/bin/env node

/**
 * Postinstall script for worktrees
 * Automatically syncs Claude configurations after pnpm install
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function isInWorktree() {
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
    const worktreeList = execSync('git worktree list', { encoding: 'utf8' });
    
    const lines = worktreeList.split('\n').filter(line => line.trim());
    const mainRepo = lines[0].split(/\s+/)[0];
    
    return gitRoot !== mainRepo && worktreeList.includes(gitRoot);
  } catch (error) {
    return false;
  }
}

function getMainRepoRoot() {
  try {
    const worktreeList = execSync('git worktree list', { encoding: 'utf8' });
    const lines = worktreeList.split('\n').filter(line => line.trim());
    return lines[0].split(/\s+/)[0]; // First line is main repo
  } catch (error) {
    return null;
  }
}

function syncClaudeConfigs() {
  const mainRepoRoot = getMainRepoRoot();
  if (!mainRepoRoot) {
    console.log('⚠️  Could not determine main repository root');
    return;
  }

  const syncScriptPath = path.join(mainRepoRoot, 'scripts', 'sync-claude-config.sh');
  
  if (!fs.existsSync(syncScriptPath)) {
    console.log('⚠️  Claude sync script not found');
    return;
  }

  console.log('🔄 Syncing Claude configurations from main repository...');
  
  try {
    execSync(`"${syncScriptPath}" "${process.cwd()}"`, { stdio: 'inherit' });
    console.log('✅ Claude configurations synced successfully');
  } catch (error) {
    // Don't fail the entire postinstall if sync fails
    console.log('⚠️  Claude sync completed with warnings (this is normal)');
  }
}

function addPlaywrightMCP() {
  console.log('🎭 Adding Playwright MCP server...');
  
  try {
    // Check if claude command exists
    execSync('which claude', { stdio: 'ignore' });
    
    // Add the Playwright MCP server
    execSync('claude mcp add playwright npx @playwright/mcp@latest', { stdio: 'inherit' });
    console.log('✅ Playwright MCP server added successfully');
  } catch (error) {
    // If claude command doesn't exist or if MCP server already exists, that's fine
    console.log('ℹ️  Skipping Playwright MCP setup (claude not found or already configured)');
  }
}

function setupPlaywrightConfig() {
  console.log('🎭 Setting up Playwright configuration...');
  
  const mainRepoRoot = getMainRepoRoot();
  if (!mainRepoRoot) {
    console.log('⚠️  Could not determine main repository root for Playwright setup');
    return;
  }

  const mainPlaywrightConfig = path.join(mainRepoRoot, 'playwright.config.js');
  const mainTestsDir = path.join(mainRepoRoot, 'tests');
  
  // Copy Playwright config if it exists in main repo
  if (fs.existsSync(mainPlaywrightConfig)) {
    try {
      fs.copyFileSync(mainPlaywrightConfig, './playwright.config.js');
      console.log('📋 Copied playwright.config.js from main repository');
    } catch (error) {
      console.log('⚠️  Could not copy playwright.config.js:', error.message);
    }
  }
  
  // Copy tests directory if it exists in main repo
  if (fs.existsSync(mainTestsDir)) {
    try {
      // Create tests directory if it doesn't exist
      if (!fs.existsSync('./tests')) {
        fs.mkdirSync('./tests', { recursive: true });
      }
      
      // Copy tests recursively
      execSync(`cp -r "${mainTestsDir}/"* ./tests/`, { stdio: 'ignore' });
      console.log('📋 Copied tests directory from main repository');
    } catch (error) {
      console.log('⚠️  Could not copy tests directory:', error.message);
    }
  }
  
  // Create screenshots directory
  if (!fs.existsSync('./screenshots')) {
    fs.mkdirSync('./screenshots', { recursive: true });
    console.log('📁 Created screenshots directory');
  }
  
  // Create playwright profiles directory
  if (!fs.existsSync('./.playwright/profiles')) {
    fs.mkdirSync('./.playwright/profiles', { recursive: true });
    console.log('📁 Created Playwright profiles directory');
  }
  
  console.log('✅ Playwright configuration setup complete');
}

// Main execution
if (isInWorktree()) {
  console.log('📍 Detected worktree environment');
  syncClaudeConfigs();
  setupPlaywrightConfig();
  addPlaywrightMCP();
} else {
  // In main repo, we might want to sync to all worktrees
  if (process.env.SYNC_ALL_WORKTREES === 'true') {
    console.log('🔄 Syncing Claude configs to all worktrees...');
    try {
      execSync('./scripts/sync-claude-config.sh', { stdio: 'inherit' });
    } catch (error) {
      // Script might not exist yet, that's OK
    }
  }
  // Also add Playwright MCP in main repo
  addPlaywrightMCP();
}