/**
 * Simple Legend State test to verify the page loads
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Legend State Simple Test', () => {
  test('should navigate to Legend State POC page', async ({ page }) => {
    // Navigate to the debug route
    console.log('🔄 Navigating to Legend State POC page...');
    await page.goto('/debug/legend-state-poc');
    
    // Wait for any content to appear
    await page.waitForLoadState('networkidle');
    
    // Check if we can find any main content
    const bodyText = await page.textContent('body');
    console.log('📄 Page content preview:', bodyText?.substring(0, 200));
    
    // Try to find the main heading with more flexible selector
    const headings = await page.locator('h1').all();
    console.log('📋 Found headings count:', headings.length);
    
    for (let i = 0; i < headings.length; i++) {
      const text = await headings[i].textContent();
      console.log(`   H1[${i}]: "${text}"`);
    }
    
    // Check if Legend State text appears anywhere
    const legendStateText = await page.locator('text=Legend State').first();
    if (await legendStateText.isVisible()) {
      console.log('✅ Found Legend State text on page');
    } else {
      console.log('❌ Legend State text not found');
    }
    
    // Check for specific buttons
    const buttons = await page.locator('button').all();
    console.log('🔘 Found buttons count:', buttons.length);
    
    for (let i = 0; i < Math.min(buttons.length, 5); i++) {
      const text = await buttons[i].textContent();
      console.log(`   Button[${i}]: "${text}"`);
    }
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'legend-state-debug.png', fullPage: true });
    console.log('📸 Screenshot saved as legend-state-debug.png');
  });

  test('should check if route exists', async ({ page }) => {
    // Navigate and check response status
    const response = await page.goto('/debug/legend-state-poc');
    console.log('🌐 Response status:', response?.status());
    
    // Check if we got a 404 or other error
    if (response?.status() === 404) {
      console.log('❌ Route not found - check if the file was created correctly');
    } else if (response?.status() === 200) {
      console.log('✅ Route exists and responds');
    } else {
      console.log('⚠️ Unexpected status:', response?.status());
    }
    
    // Check URL after navigation
    const currentUrl = page.url();
    console.log('📍 Current URL:', currentUrl);
    
    // Check if we were redirected
    if (!currentUrl.includes('legend-state-poc')) {
      console.log('🔄 Was redirected, probably to login or different page');
    }
  });
});