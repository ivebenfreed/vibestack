import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Simple Entity Page Test', () => {
  test('should check what entity pages exist', async ({ page }) => {
    // Start from the dashboard
    await page.goto('/');
    await page.waitForSelector('[data-playwright-ready="true"]', { timeout: 10000 });
    
    console.log('✅ Dashboard loaded');
    
    // Try to navigate to entities
    await page.goto('/entities');
    await page.waitForTimeout(3000); // Give it time to load
    
    const url = page.url();
    console.log('📍 Entities page URL:', url);
    
    // Take a screenshot to see what's there
    await page.screenshot({ path: 'screenshots/entities-page.png' });
    
    // Get page content
    const title = await page.title();
    console.log('📄 Page title:', title);
    
    const bodyText = await page.textContent('body');
    console.log('📋 Page text (first 1000 chars):', bodyText.substring(0, 1000));
    
    // Look for any buttons, links, or navigation elements
    const buttons = await page.locator('button').count();
    const links = await page.locator('a').count();
    const headings = await page.locator('h1, h2, h3').count();
    
    console.log(`📊 Found: ${buttons} buttons, ${links} links, ${headings} headings`);
    
    // Check if there are any entity names visible
    const entityNames = ['Project', 'Client', 'Timesheet', 'Document', 'Invoice'];
    for (const entityName of entityNames) {
      const entityText = await page.locator(`text=${entityName}`).count();
      if (entityText > 0) {
        console.log(`✅ Found "${entityName}" on page (${entityText} instances)`);
      }
    }
    
    // Try direct entity URLs
    for (const entityName of ['Project', 'Client']) {
      try {
        await page.goto(`/entities/${entityName}`);
        await page.waitForTimeout(2000);
        
        const entityUrl = page.url();
        const entityTitle = await page.title();
        
        console.log(`📍 ${entityName} page - URL: ${entityUrl}, Title: ${entityTitle}`);
        await page.screenshot({ path: `screenshots/entity-${entityName.toLowerCase()}.png` });
        
        // Look for common CRUD elements
        const newButton = await page.locator('button:has-text("New"), button:has-text("Create"), [data-testid*="new"]').count();
        const listElements = await page.locator('[data-testid*="list"], table, .grid').count();
        
        console.log(`   ${entityName}: ${newButton} create buttons, ${listElements} list elements`);
        
      } catch (error) {
        console.log(`❌ Error loading ${entityName}: ${error.message}`);
      }
    }
  });
});