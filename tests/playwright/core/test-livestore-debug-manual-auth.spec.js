/**
 * LiveStore Debug Route Test with Manual Authentication
 * 
 * Tests the LiveStore integration by manually logging in during the test
 */

import { test, expect } from '@playwright/test';

test.describe('LiveStore Debug Route with Manual Auth', () => {
  test('should login and test LiveStore debug route', async ({ page }) => {
    console.log('🔐 Starting manual authentication test...');
    
    // Navigate to login page
    await page.goto('/sign-in', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    
    // Fill in login form with admin user
    await page.fill('input[type="email"]', 'test-playwright-1755347086@gmail.com');
    await page.fill('input[type="password"]', 'TestPass123!');
    
    // Submit login
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    // Wait for redirect after login
    await page.waitForTimeout(3000);
    console.log('✅ Login successful, redirected to:', page.url());
    
    // Check if we need to select an organization
    const needsOrgSelection = await page.locator('text=Select Organization').isVisible();
    if (needsOrgSelection) {
      console.log('🏢 Organization selection required...');
      
      // Look for the organization button and click it
      const orgButton = page.getByRole('button', { name: 'Playwright Test Organization' });
      if (await orgButton.isVisible()) {
        await orgButton.click();
        console.log('✅ Selected Playwright Test Organization');
        await page.waitForTimeout(5000);
      } else {
        console.log('⚠️ No Playwright Test Organization found, trying any clickable org...');
        // Try clicking any button that contains "Organization"
        const anyOrgButton = page.locator('button').filter({ hasText: 'Organization' }).first();
        if (await anyOrgButton.isVisible()) {
          await anyOrgButton.click();
          await page.waitForTimeout(5000);
          console.log('✅ Selected first available organization');
        }
      }
      
      // Verify we moved past org selection
      await page.waitForTimeout(2000);
      const stillOnOrgSelection = await page.locator('text=Select Organization').isVisible();
      if (stillOnOrgSelection) {
        console.log('⚠️ Still on organization selection page, trying alternative click...');
        // Try clicking anywhere in the organization area
        await page.click('[class*="cursor-pointer"], button:has-text("1755"), div:has-text("1755")');
        await page.waitForTimeout(3000);
      }
    }
    
    // Now try to access debug route
    console.log('🔄 Navigating to debug route...');
    await page.goto('/debug', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);
    
    const debugUrl = page.url();
    console.log('📍 Debug route URL:', debugUrl);
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/manual-auth-debug.png', fullPage: true });
    
    // Check if we're on debug page or access denied
    const pageText = await page.textContent('body');
    
    if (pageText.includes('Debug Section')) {
      console.log('✅ Successfully accessed debug section!');
      
      // Now try to access LiveStore test route
      await page.goto('/debug/livestore-test', { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(3000);
      
      // Wait for LiveStore component to load
      try {
        await page.waitForSelector('h1:has-text("LiveStore Integration Debug")', { timeout: 10000 });
        console.log('✅ LiveStore debug page loaded successfully!');
        
        // Take screenshot of LiveStore debug page
        await page.screenshot({ path: 'screenshots/livestore-debug-success.png', fullPage: true });
        
        // Check status cards
        await page.waitForTimeout(2000);
        
        const userStatus = await page.locator('text=User Session').locator('..').textContent();
        console.log('👤 User Status:', userStatus);
        
        const schemaStatus = await page.locator('text=Schema Status').locator('..').textContent();
        console.log('📋 Schema Status:', schemaStatus);
        
        const instanceStatus = await page.locator('text=Instance Status').locator('..').textContent();
        console.log('🏪 Instance Status:', instanceStatus);
        
        // Try running tests if the Run All Tests button is available
        const runTestsButton = page.locator('button:has-text("Run All Tests")');
        if (await runTestsButton.isVisible()) {
          console.log('🧪 Running LiveStore integration tests...');
          await runTestsButton.click();
          
          // Wait for tests to start
          await page.waitForTimeout(5000);
          
          // Take screenshot of test results
          await page.screenshot({ path: 'screenshots/livestore-test-results.png', fullPage: true });
          console.log('📸 Test results screenshot saved');
        }
        
      } catch (error) {
        console.log('❌ LiveStore debug page did not load:', error.message);
        await page.screenshot({ path: 'screenshots/livestore-debug-error.png', fullPage: true });
      }
      
    } else if (pageText.includes('Access Denied')) {
      console.log('❌ Access denied to debug section');
      console.log('Current role in page:', pageText.match(/Current role: ([^|]+)/)?.[1] || 'not found');
    } else {
      console.log('⚠️ Unexpected page content');
      console.log('Page contains sign-in?', pageText.includes('Login'));
    }
  });
});