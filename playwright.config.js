// playwright.config.js
import { defineConfig, devices } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Detect issue number from branch name or environment
function getIssueNumber() {
  if (process.env.PR_NUMBER) {
    return process.env.PR_NUMBER;
  }
  
  try {
    const branchName = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    const match = branchName.match(/(?:issue-|feature-|pr-)(\d+)/);
    if (match) {
      console.log(`🔍 Auto-detected issue number ${match[1]} from branch: ${branchName}`);
      return match[1];
    }
  } catch (error) {
    console.log('Could not detect branch name, using default');
  }
  
  return 'main';
}

// Calculate ports based on issue number
function getPorts(issueNumber) {
  if (issueNumber === 'main') {
    return {
      webPort: 5173,
      serverPort: 8787
    };
  }
  
  const num = parseInt(issueNumber, 10);
  return {
    webPort: 5173 + (num * 10),
    serverPort: 8787 + (num * 10)
  };
}

const issueNumber = getIssueNumber();
const ports = getPorts(issueNumber);
const userDataDir = path.resolve(process.cwd(), '.playwright', 'profiles', `profile-${issueNumber}`);

console.log(`🎭 Playwright Config (Persistent Context):`);
console.log(`   Issue: ${issueNumber}`);
console.log(`   Web Port: ${ports.webPort}`);
console.log(`   Server Port: ${ports.serverPort}`);
console.log(`   Profile Dir: ${userDataDir}`);

export default defineConfig({
  testDir: './tests/playwright',
  testMatch: [
    'core/**/*.spec.js',
    'core/**/*.setup.js',
    `issue-${issueNumber}/**/*.spec.js`,
    `issue-${issueNumber}/**/*.setup.js`
  ],
  fullyParallel: false, // Run tests serially to avoid conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }]
  ],
  
  use: {
    baseURL: `http://localhost:${ports.webPort}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Note: userDataDir doesn't work here for persistent context
        // We'll use a custom fixture instead
        headless: true, // Default to headless, can override with --headed
      },
    },
  ],
});