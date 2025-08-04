// tests/playwright/debug-sync.spec.js
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Helper function to load environment variables
function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.log('⚠️  .env.local not found');
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

test.use({ 
  headless: false,
  viewport: { width: 1280, height: 720 }
});

test.describe('Debug Sync Issue', () => {
  test('login and wait for sync', async ({ page }) => {
    const env = loadEnvFile();
    
    // Enable console logging
    page.on('console', msg => console.log('Browser console:', msg.text()));
    page.on('pageerror', error => console.log('Page error:', error.message));
    
    // Navigate to app
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
    console.log('Navigated to:', page.url());
    
    // Wait a bit for React to render
    await page.waitForTimeout(2000);
    
    // Take initial screenshot
    await page.screenshot({ path: 'screenshots/debug-1-initial.png', fullPage: true });
    console.log('Screenshot: debug-1-initial.png');
    
    // If we need to login
    if (page.url().includes('sign-in')) {
      console.log('On login page, logging in...');
      
      // Wait for form to be ready
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      
      // Fill email
      const email = env.VIBE_DEV_EMAIL || 'ben@getelevra.com';
      console.log('Filling email:', email);
      await page.fill('input[type="email"]', email);
      
      await page.screenshot({ path: 'screenshots/debug-2-email-filled.png', fullPage: true });
      console.log('Screenshot: debug-2-email-filled.png');
      
      // Fill password
      const password = env.VIBE_DEV_PASSWORD || 'password';
      console.log('Filling password');
      await page.fill('input[type="password"]', password);
      
      await page.screenshot({ path: 'screenshots/debug-3-password-filled.png', fullPage: true });
      console.log('Screenshot: debug-3-password-filled.png');
      
      // Click login button
      const loginButton = page.locator('button:has-text("Login")');
      await loginButton.waitFor({ state: 'visible' });
      console.log('Clicking login button...');
      await loginButton.click();
      
      await page.screenshot({ path: 'screenshots/debug-4-after-click.png', fullPage: true });
      console.log('Screenshot: debug-4-after-click.png');
    }
    
    // Wait for navigation
    await page.waitForTimeout(3000);
    console.log('After login URL:', page.url());
    
    await page.screenshot({ path: 'screenshots/debug-5-after-wait.png', fullPage: true });
    console.log('Screenshot: debug-5-after-wait.png');
    
    // Check for sync overlay
    const syncOverlay = await page.locator('text="Syncing data"').count();
    console.log('Sync overlay visible:', syncOverlay > 0);
    
    // Check what's actually on the page
    const pageText = await page.textContent('body');
    console.log('Page contains:', pageText.substring(0, 200) + '...');
    
    // Keep browser open for manual inspection
    console.log('\n🔍 Browser will stay open for inspection.');
    console.log('Press Ctrl+C to close when done.\n');
    
    // Wait indefinitely
    await page.waitForTimeout(300000); // 5 minutes
  });
});