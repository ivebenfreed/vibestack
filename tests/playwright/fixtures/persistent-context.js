/**
 * Persistent Context Fixture
 * 
 * This fixture provides a persistent browser context that maintains
 * login state across test runs. Each worktree gets its own profile.
 */

import { test as base, expect } from '@playwright/test';
import path from 'path';

// Get the user data directory from the same logic as playwright.config.js
function getIssueNumber() {
  if (process.env.PR_NUMBER) {
    return process.env.PR_NUMBER;
  }
  
  try {
    const { execSync } = require('child_process');
    const branchName = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    const match = branchName.match(/(?:issue-|feature-|pr-)(\d+)/);
    if (match) {
      return match[1];
    }
  } catch (error) {
    // Silent fail
  }
  
  return 'main';
}

const issueNumber = getIssueNumber();
const userDataDir = path.resolve(process.cwd(), '.playwright', 'profiles', `profile-${issueNumber}`);

export const test = base.extend({
  context: async ({ browser }, use) => {
    console.log(`🔧 Using persistent profile: ${userDataDir}`);
    
    // Create a persistent context with the user data directory
    const context = await browser.newContext({
      userDataDir: userDataDir,
      // Add any other context options you need
    });
    
    await use(context);
    
    // Don't close the context - this preserves the persistent data
    // await context.close();
  },
});

export { expect };