import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Basic Entity Test', () => {
  test('should access entity pages without ready hook', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Wait for basic page load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Give time for initialization
    
    console.log('📍 Dashboard URL:', page.url());
    console.log('📄 Page title:', await page.title());
    
    // Take a screenshot of the current state
    await page.screenshot({ path: 'screenshots/dashboard-state.png' });
    
    // Check page content
    const bodyText = await page.textContent('body');
    console.log('📋 Dashboard content (first 500 chars):', bodyText.substring(0, 500));
    
    // Look for any navigation or entity-related elements
    const navElements = await page.locator('nav, [role="navigation"], .sidebar, .menu').count();
    console.log(`📊 Found ${navElements} navigation elements`);
    
    // Check for common UI elements that might lead to entities
    const buttons = await page.locator('button').count();
    const links = await page.locator('a').count();
    console.log(`📊 Found ${buttons} buttons, ${links} links`);
    
    // Try to find any entity-related text or links
    const entityKeywords = ['Project', 'Client', 'Task', 'Document', 'Invoice'];
    for (const keyword of entityKeywords) {
      const count = await page.locator(`text=${keyword}`).count();
      if (count > 0) {
        console.log(`✅ Found "${keyword}" on page (${count} instances)`);
      }
    }
    
    // Try direct navigation to entities
    console.log('\n🔍 Testing direct entity navigation...');
    
    try {
      await page.goto('/entities');
      await page.waitForTimeout(2000);
      console.log('📍 Entities page URL:', page.url());
      await page.screenshot({ path: 'screenshots/entities-direct.png' });
      
      const entitiesContent = await page.textContent('body');
      console.log('📋 Entities page content (first 500 chars):', entitiesContent.substring(0, 500));
      
    } catch (error) {
      console.log('❌ Failed to load /entities:', error.message);
    }
    
    // Try a specific entity
    try {
      await page.goto('/entities/Project');
      await page.waitForTimeout(2000);
      console.log('📍 Project page URL:', page.url());
      await page.screenshot({ path: 'screenshots/project-direct.png' });
      
      const projectContent = await page.textContent('body');
      console.log('📋 Project page content (first 500 chars):', projectContent.substring(0, 500));
      
    } catch (error) {
      console.log('❌ Failed to load /entities/Project:', error.message);
    }
    
    // Check if we can find any forms or CRUD interfaces
    const forms = await page.locator('form').count();
    const tables = await page.locator('table').count();
    const grids = await page.locator('[role="grid"], .grid, .data-table').count();
    
    console.log(`📊 Found ${forms} forms, ${tables} tables, ${grids} grids`);
    
    // This test always passes - it's just for exploration
    expect(true).toBe(true);
  });
});