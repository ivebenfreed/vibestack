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
  context: async ({ }, use, testInfo) => {
    const issueNumber = getIssueNumber();
    const userDataDir = path.resolve(process.cwd(), '.playwright', 'profiles', `profile-${issueNumber}`);
    
    console.log(`🔧 Using persistent profile: ${userDataDir}`);
    
    // Check for --headed flag in the command line args
    const isHeaded = process.argv.includes('--headed') || 
                     process.argv.includes('--debug') ||
                     process.env.HEADED === 'true' ||
                     process.env.HEADED === '1';
    
    if (isHeaded) {
      console.log(`🖥️  Running in headed mode (browser visible)`);
    }
    
    // Launch persistent context
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: !isHeaded,
      viewport: { width: 1280, height: 720 },
      permissions: ['clipboard-read', 'clipboard-write'],
      acceptDownloads: true,
      args: isHeaded ? [] : ['--headless=new'], // Use new headless mode when headless
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