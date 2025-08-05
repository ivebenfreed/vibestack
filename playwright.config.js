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
const authFile = path.resolve(process.cwd(), '.playwright', 'auth', `auth-${issueNumber}.json`);

console.log(`🎭 Playwright Config:`);
console.log(`   Issue: ${issueNumber}`);
console.log(`   Web Port: ${ports.webPort}`);
console.log(`   Server Port: ${ports.serverPort}`);
console.log(`   Auth State: ${authFile}`);

export default defineConfig({
  testDir: './tests/playwright',
  fullyParallel: false, // Run tests serially to avoid conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list']],
  
  use: {
    baseURL: `http://localhost:${ports.webPort}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Setup project that handles authentication
    { 
      name: 'setup', 
      testMatch: /.*auth\.setup\.js/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    // Main test project that uses the stored auth state
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Use the stored authentication state
        storageState: authFile,
      },
      dependencies: ['setup'],
    },
  ],
});