import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Quick Entity Test', () => {
  test('should verify entity pages are accessible', async ({ page }) => {
    // Test if we can access entity pages directly
    await page.goto('/entities');
    await page.waitForSelector('[data-playwright-ready="true"]', { timeout: 10000 });
    
    console.log('✅ Entities index page loaded');
    console.log('📍 Current URL:', page.url());
    
    // Take a screenshot to see what's available
    await page.screenshot({ path: 'screenshots/entities-index.png' });
    
    // Try a specific entity
    try {
      await page.goto('/entities/Project');
      await page.waitForSelector('[data-playwright-ready="true"]', { timeout: 5000 });
      console.log('✅ Project entity page loaded');
      await page.screenshot({ path: 'screenshots/entities-project.png' });
    } catch (error) {
      console.log('⚠️ Project entity page not accessible:', error.message);
    }
    
    // Check page content for any entity lists or forms
    const pageContent = await page.textContent('body');
    console.log('📋 Page content preview:', pageContent.substring(0, 500));
    
    // Look for entity-related elements
    const entityElements = await page.locator('[data-testid*="entity"]').count();
    console.log(`📊 Found ${entityElements} elements with 'entity' in data-testid`);
    
    if (entityElements > 0) {
      // List the first few entity elements
      for (let i = 0; i < Math.min(entityElements, 5); i++) {
        const element = page.locator('[data-testid*="entity"]').nth(i);
        const testId = await element.getAttribute('data-testid');
        console.log(`   - Element ${i + 1}: ${testId}`);
      }
    }
  });
});