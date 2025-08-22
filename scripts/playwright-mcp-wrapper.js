#!/usr/bin/env node

/**
 * Playwright MCP Wrapper
 * Provides isolated browser profiles for each worktree
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Get current working directory (where Claude is running)
const cwd = process.cwd();

// Determine if we're in a worktree
function getWorktreeInfo() {
  try {
    const { execSync } = require('child_process');
    const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8', cwd }).trim();
    const worktreeList = execSync('git worktree list', { encoding: 'utf8', cwd });
    
    const lines = worktreeList.split('\n').filter(line => line.trim());
    const mainRepo = lines[0].split(/\s+/)[0];
    
    if (gitRoot !== mainRepo && worktreeList.includes(gitRoot)) {
      // We're in a worktree
      const worktreeName = path.basename(gitRoot);
      return {
        isWorktree: true,
        name: worktreeName,
        path: gitRoot
      };
    }
  } catch (error) {
    // Not in a git repo or other error
  }
  
  return {
    isWorktree: false,
    name: 'main',
    path: cwd
  };
}

// Get profile directory based on worktree
function getProfileDir() {
  const worktreeInfo = getWorktreeInfo();
  
  // Match the same profile directory structure as the test configuration
  // Use .playwright/profiles/profile-{issue} for consistency
  const issueNumber = worktreeInfo.isWorktree ? 
    worktreeInfo.name.replace(/^issue-/, '') : 
    'main';
  
  const profileDir = path.join(worktreeInfo.path, '.playwright', 'profiles', `profile-${issueNumber}`);
  
  // Ensure directory exists
  fs.mkdirSync(profileDir, { recursive: true });
  
  console.error(`[Playwright MCP] Using persistent profile: ${profileDir}`);
  
  return profileDir;
}

// Main execution
const args = process.argv.slice(2);
const profileDir = getProfileDir();

// Add user data directory to arguments
// Removed --isolated flag to use persistent profile on disk
const playwrightArgs = [
  '@playwright/mcp',
  `--user-data-dir=${profileDir}`,
  ...args
];

// Spawn the actual Playwright MCP server
const child = spawn('npx', playwrightArgs, {
  stdio: 'inherit',
  env: {
    ...process.env,
    PLAYWRIGHT_USER_DATA_DIR: profileDir
  }
});

child.on('error', (error) => {
  console.error('[Playwright MCP Wrapper] Error:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});