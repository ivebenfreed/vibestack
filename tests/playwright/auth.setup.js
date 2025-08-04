// tests/playwright/auth.setup.js
// Setup file that handles authentication and saves the state
import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Helper to load environment variables
function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.log('⚠️  .env.local not found, login credentials not available');
    return {};
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim();
    }
  });
  
  return env;
}

// Get issue number for auth file path
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

setup('authenticate', async ({ page }) => {
  const env = loadEnvFile();
  
  // Skip if no credentials
  if (!env.VIBE_DEV_EMAIL || !env.VIBE_DEV_PASSWORD) {
    console.log('⚠️  Skipping auth setup: No credentials found in .env.local');
    console.log('   Add VIBE_DEV_EMAIL and VIBE_DEV_PASSWORD to .env.local');
    setup.skip();
    return;
  }
  
  console.log('🔐 Setting up authentication...');
  
  // Navigate to the app
  await page.goto('/');
  console.log('🌐 Navigated to app');
  
  // Check if already logged in
  let needsLogin = await page.evaluate(() => {
    const path = window.location.pathname;
    return path.includes('/login') || 
           path.includes('/sign-in') ||
           path.includes('/handler');
  });
  
  if (!needsLogin) {
    console.log('✅ Already authenticated, logging out to capture fresh auth state...');
    
    // Try to find and click logout button
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout"), a:has-text("Sign out")');
    if (await logoutButton.count() > 0) {
      await logoutButton.first().click();
      console.log('🔄 Clicked logout button');
      await page.waitForTimeout(2000);
    } else {
      // Try user menu first
      const userButton = page.locator('[data-testid="user-button"], button[aria-label*="user"], button[aria-label*="account"], .user-menu');
      if (await userButton.count() > 0) {
        await userButton.first().click();
        await page.waitForTimeout(500);
        
        const logoutInMenu = page.locator('button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout"), a:has-text("Sign out")');
        if (await logoutInMenu.count() > 0) {
          await logoutInMenu.first().click();
          console.log('🔄 Clicked logout in user menu');
          await page.waitForTimeout(2000);
        }
      }
    }
    
    // Wait for login page to appear
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 30000 });
    needsLogin = true;
  }
  
  if (needsLogin) {
    console.log('📝 Performing login...');
    
    // Wait for login form
    await page.waitForSelector('input[type="email"], input[name="email"]', { 
      timeout: 30000 
    });
    
    // Fill credentials
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.fill(env.VIBE_DEV_EMAIL);
    console.log(`📧 Entered email: ${env.VIBE_DEV_EMAIL}`);
    
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await passwordInput.fill(env.VIBE_DEV_PASSWORD);
    console.log('🔑 Entered password');
    
    // Click login
    const loginButton = page.locator('button:has-text("Login")').first();
    await loginButton.click();
    console.log('🔄 Login submitted');
    
    // Wait for successful login
    await page.waitForFunction(() => {
      const path = window.location.pathname;
      return !path.includes('/login') && 
             !path.includes('/sign-in') &&
             !path.includes('/handler');
    }, { timeout: 30000 });
    
    console.log('✅ Login successful!');
  }
  
  // Wait for any initial sync to complete
  const syncOverlay = page.locator('text="Syncing data"');
  if (await syncOverlay.isVisible().catch(() => false)) {
    console.log('⏳ Waiting for initial sync...');
    await syncOverlay.waitFor({ state: 'detached', timeout: 60000 }).catch(() => {
      console.log('⚠️  Sync timeout, continuing anyway');
    });
    console.log('✅ Initial sync complete');
  }
  
  // Wait a bit for the session to stabilize
  await page.waitForTimeout(2000);
  
  // Save storage state
  const issueNumber = getIssueNumber();
  const authDir = path.resolve(process.cwd(), '.playwright', 'auth');
  const authFile = path.join(authDir, `auth-${issueNumber}.json`);
  
  // Ensure auth directory exists
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }
  
  await page.context().storageState({ path: authFile });
  console.log(`💾 Authentication state saved to: ${authFile}`);
  
  // Verify the file was created and has content
  const stats = fs.statSync(authFile);
  console.log(`   File size: ${stats.size} bytes`);
});