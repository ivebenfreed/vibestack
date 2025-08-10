// Smoke test to verify the app loads at all
import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('App Loading Tests', () => {
  test.setTimeout(20000); // 20 second timeout
  
  test('should load the application', async ({ page }) => {
    console.log('🌐 Navigating to application...');
    
    // Navigate to the app
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    console.log(`📍 Current URL: ${page.url()}`);
    
    // Check if we're on a login page or the main app
    const isLoginPage = page.url().includes('/login') || 
                       page.url().includes('/sign-in') ||
                       page.url().includes('/handler');
    
    if (isLoginPage) {
      console.log('🔐 On login page - need to authenticate');
      console.log('   Run: npx playwright test tests/playwright/setup/01-initial-auth.spec.js');
    } else {
      console.log('🏠 App loaded - checking if ready...');
      
      // Wait for Playwright ready hook
      const hasPlaywrightReady = await page.waitForFunction(() => {
        return document.body.getAttribute('data-playwright-ready') === 'true';
      }, { timeout: 10000 }).then(() => true).catch(() => false);
      
      if (hasPlaywrightReady) {
        console.log('✅ App fully loaded with Playwright ready hook');
      } else {
        console.log('⚠️  App loaded but no Playwright ready hook detected');
      }
    }
    
    // Basic check - we should have the root element
    const hasRoot = await page.locator('#root').count();
    expect(hasRoot).toBeGreaterThan(0);
  });
  
  test('should have correct title', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Get the page title
    const title = await page.title();
    console.log(`📄 Page title: "${title}"`);
    
    // Verify title is not empty
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  });
  
});