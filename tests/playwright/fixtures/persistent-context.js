// Custom fixture for persistent browser context
import { test as base, chromium } from '@playwright/test';
import path from 'path';
import { execSync } from 'child_process';

// Get issue number for profile directory
function getIssueNumber() {
  if (process.env.PR_NUMBER) {
    return process.env.PR_NUMBER;
  }
  
  try {
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

// Create a fixture that provides persistent context
export const test = base.extend({
  context: async ({ }, use) => {
    const issueNumber = getIssueNumber();
    const userDataDir = path.resolve(process.cwd(), '.playwright', 'profiles', `profile-${issueNumber}`);
    
    console.log(`🔧 Using persistent profile: ${userDataDir}`);
    
    // Launch persistent context
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: process.env.HEADED ? false : true, // Default to headless unless HEADED=1
      viewport: { width: 1280, height: 720 },
      permissions: ['clipboard-read', 'clipboard-write'],
      acceptDownloads: true,
    });
    
    // Add init script for PLAYWRIGHT_TEST flag
    await context.addInitScript(() => {
      window.PLAYWRIGHT_TEST = true;
    });
    
    await use(context);
    await context.close();
  },
  
  page: async ({ context }, use) => {
    const page = context.pages()[0] || await context.newPage();
    await use(page);
  },
});

export { expect } from '@playwright/test';