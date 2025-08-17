/**
 * Simple test to verify debug page access
 */

import { test, expect } from '../fixtures/persistent-context.js';

test('should access debug page and verify content', async ({ page }) => {
  // First go to home page to ensure authentication
  await page.goto('/');
  
  // Wait for authentication to be processed
  await page.waitForLoadState('networkidle');
  
  // Check if we're authenticated (look for user menu or dashboard elements)
  const isAuthenticated = await page.locator('[data-testid="user-menu"], .user-menu, text=Dashboard').first().isVisible().catch(() => false);
  
  if (!isAuthenticated) {
    console.log('⚠️ Not authenticated on home page');
    // If not authenticated, this test will document the current behavior
  }
  
  // Now navigate to the debug page
  await page.goto('/debug/livestore-test');
  
  // Take a screenshot to see what's actually rendered
  await page.screenshot({ path: 'debug-page-screenshot.png' });
  
  // Get the page title
  const title = await page.title();
  console.log('Page title:', title);
  
  // Get the current URL
  const url = page.url();
  console.log('Current URL:', url);
  
  // Get the h1 content
  const h1Content = await page.locator('h1').first().textContent();
  console.log('H1 content:', h1Content);
  
  // Check if we're on the right page or redirected
  if (h1Content && h1Content.includes('LiveStore Integration Debug')) {
    console.log('✅ Successfully reached debug page');
    
    // Verify the page elements are present
    await expect(page.locator('h1')).toContainText('LiveStore Integration Debug');
    await expect(page.locator('text=Live Data Tables (Via Sync System)')).toBeVisible();
    
  } else {
    console.log('❌ Not on debug page. Current content:', h1Content);
    console.log('URL:', url);
    
    // Check if we're on sign-in page
    const isSignInPage = await page.locator('text=Sign In').isVisible();
    const isSignInPageTitle = h1Content && h1Content.includes('Sign In');
    
    if (isSignInPage || isSignInPageTitle) {
      console.log('🔐 Redirected to sign-in page - authentication required');
    }
    
    // Log all visible h1, h2, h3 tags to understand the page structure
    const headings = await page.locator('h1, h2, h3').allTextContents();
    console.log('Page headings:', headings);
    
    // Fail the test if we're not where we expect to be
    expect(h1Content).toContain('LiveStore Integration Debug');
  }
});