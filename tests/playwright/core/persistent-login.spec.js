// Simple login test for persistent context
import { test, expect } from '../fixtures/persistent-context.js';
import * as fs from 'fs';
import * as path from 'path';

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

test('login to persistent profile', async ({ page }) => {
  const env = loadEnvFile();
  
  // Skip if no credentials
  if (!env.VIBE_DEV_EMAIL || !env.VIBE_DEV_PASSWORD) {
    console.log('⚠️  Skipping login: No credentials found in .env.local');
    console.log('   Add VIBE_DEV_EMAIL and VIBE_DEV_PASSWORD to .env.local');
    test.skip();
    return;
  }
  
  // Navigate to the app
  await page.goto('/');
  
  // Check if already logged in by waiting briefly
  await page.waitForTimeout(2000);
  
  const needsLogin = await page.evaluate(() => {
    const path = window.location.pathname;
    return path.includes('/sign-in') || path.includes('/handler');
  });
  
  if (!needsLogin) {
    console.log('✅ Already logged in! Persistent context is working.');
    return;
  }
  
  console.log('📝 Performing first-time login for persistent profile...');
  
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
    return !path.includes('/sign-in') && !path.includes('/handler');
  }, { timeout: 30000 });
  
  console.log('✅ Login successful! Profile saved.');
  console.log('🎉 Next time you run tests, you\'ll already be logged in!');
  
  // Wait a bit for everything to settle
  await page.waitForTimeout(3000);
});