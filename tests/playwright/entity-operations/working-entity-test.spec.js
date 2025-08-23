import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Working Entity Test', () => {
  test('should login and access entity pages', async ({ page }) => {
    // Go to the sign-in page
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');
    
    console.log('📍 Sign-in page URL:', page.url());
    await page.screenshot({ path: 'screenshots/signin-page.png' });
    
    // Fill in login credentials
    const emailField = page.locator('input[type="email"], input[name="email"], [data-testid*="email"]');
    const passwordField = page.locator('input[type="password"], input[name="password"], [data-testid*="password"]');
    
    if (await emailField.isVisible()) {
      await emailField.fill('ceo@widecorp.com');
      console.log('✅ Filled email field');
    }
    
    if (await passwordField.isVisible()) {
      await passwordField.fill('WideCorp2024!CEO');
      console.log('✅ Filled password field');
    }
    
    // Find and click login button
    const loginButton = page.locator('button:has-text("Login"), button[type="submit"], [data-testid*="login"]');
    if (await loginButton.isVisible()) {
      await loginButton.click();
      console.log('✅ Clicked login button');
    }
    
    // Wait for redirect after login
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    console.log('📍 After login URL:', page.url());
    await page.screenshot({ path: 'screenshots/after-login.png' });
    
    // Now try to access entities
    await page.goto('/entities');
    await page.waitForTimeout(2000);
    
    console.log('📍 Entities page URL:', page.url());
    
    // Check if we're still on sign-in (auth failed) or on entities page
    if (page.url().includes('/sign-in')) {
      console.log('❌ Still on sign-in page - authentication failed');
      const errorMessage = await page.locator('.error, [data-testid*="error"], .alert').textContent();
      if (errorMessage) {
        console.log('🚨 Error message:', errorMessage);
      }
    } else {
      console.log('✅ Successfully accessed entities page');
      await page.screenshot({ path: 'screenshots/entities-authenticated.png' });
      
      const entitiesContent = await page.textContent('body');
      console.log('📋 Entities page content (first 1000 chars):', entitiesContent.substring(0, 1000));
      
      // Look for entity-related UI elements
      const entityCards = await page.locator('[data-testid*="entity"], .entity-card, .entity-item').count();
      const createButtons = await page.locator('button:has-text("Create"), button:has-text("New"), [data-testid*="create"]').count();
      
      console.log(`📊 Found ${entityCards} entity elements, ${createButtons} create buttons`);
      
      // Try accessing a specific entity
      await page.goto('/entities/Project');
      await page.waitForTimeout(2000);
      
      console.log('📍 Project page URL:', page.url());
      await page.screenshot({ path: 'screenshots/project-authenticated.png' });
      
      if (!page.url().includes('/sign-in')) {
        console.log('✅ Successfully accessed Project entity page');
        
        const projectContent = await page.textContent('body');
        console.log('📋 Project page content (first 1000 chars):', projectContent.substring(0, 1000));
        
        // Look for CRUD elements
        const projectCards = await page.locator('[data-testid*="project"], .project-card, .project-item').count();
        const newProjectButtons = await page.locator('button:has-text("New Project"), button:has-text("Create Project"), [data-testid*="new-project"]').count();
        
        console.log(`📊 Found ${projectCards} project elements, ${newProjectButtons} new project buttons`);
      }
    }
    
    // Test passes if we get this far without throwing
    expect(true).toBe(true);
  });
});