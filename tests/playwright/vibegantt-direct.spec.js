// tests/playwright/vibegantt-direct.spec.js
// Test suite to verify VibeGantt components by navigating directly to Gantt views
import { test, expect } from '@playwright/test';

test.describe('VibeGantt Direct Navigation Tests', () => {
  test.setTimeout(60000);
  
  test('should render VibeGantt when navigating directly to gantt view', async ({ page }) => {
    console.log('🎯 Testing direct navigation to VibeGantt...');
    
    // First navigate to home to ensure we're authenticated
    await page.goto('/');
    console.log('🌐 Navigated to app');
    
    // Wait for any sync overlay to disappear
    const syncOverlay = page.locator('text="Syncing data"');
    if (await syncOverlay.isVisible().catch(() => false)) {
      console.log('⏳ Waiting for initial sync to complete...');
      await syncOverlay.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    }
    
    // Try different possible Gantt URLs
    const ganttUrls = [
      '/gantt',
      '/projects/gantt',
      '/project/1/gantt',
      '/tasks/gantt',
      '/vibegantt',
      '/projects/1',  // Sometimes Gantt is the default view for a project
      '/projects'
    ];
    
    let ganttFound = false;
    
    for (const url of ganttUrls) {
      console.log(`🔍 Trying URL: ${url}`);
      
      // Navigate to the URL
      const response = await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => null);
      
      if (response && response.status() !== 404) {
        console.log(`✅ URL ${url} returned status: ${response.status()}`);
        
        // Wait for page to stabilize
        await page.waitForTimeout(2000);
        
        // Check for Gantt elements
        const ganttSelectors = [
          '[class*="gantt"]',
          '[id*="gantt"]',
          '[data-testid*="gantt"]',
          '.vibegantt',
          '#vibegantt',
          'svg[class*="gantt"]',
          '.gantt-chart',
          '.gantt-container'
        ];
        
        for (const selector of ganttSelectors) {
          const count = await page.locator(selector).count();
          if (count > 0) {
            console.log(`✅ Found Gantt element with selector: ${selector}`);
            ganttFound = true;
            
            // Take screenshot
            await page.screenshot({ 
              path: `screenshots/vibegantt-direct-${url.replace(/\//g, '-')}.png`,
              fullPage: true 
            });
            
            break;
          }
        }
        
        if (ganttFound) {
          console.log(`🎉 VibeGantt found at URL: ${url}`);
          break;
        }
      }
    }
    
    if (!ganttFound) {
      console.log('⚠️ VibeGantt not found via direct navigation');
      console.log('📸 Taking screenshot of current page');
      
      await page.screenshot({ 
        path: 'screenshots/vibegantt-not-found.png',
        fullPage: true 
      });
      
      // Log current URL
      console.log(`📍 Current URL: ${page.url()}`);
      
      // Try to find any navigation links that might lead to Gantt
      const navLinks = await page.locator('a').evaluateAll(links => 
        links.map(link => ({
          text: link.textContent?.trim() || '',
          href: link.href
        })).filter(link => link.text || link.href)
      );
      
      console.log('🔗 Available navigation links:');
      navLinks.forEach(link => {
        if (link.text.toLowerCase().includes('gantt') || 
            link.text.toLowerCase().includes('timeline') ||
            link.text.toLowerCase().includes('project') ||
            link.href.includes('gantt')) {
          console.log(`   - "${link.text}": ${link.href}`);
        }
      });
    }
    
    expect(ganttFound).toBe(true);
  });
  
  test('should render VibeGantt components after creating a project', async ({ page }) => {
    console.log('\n=== CREATING PROJECT AND CHECKING GANTT ===');
    
    // Navigate to home
    await page.goto('/');
    
    // Wait for sync to complete
    const syncOverlay = page.locator('text="Syncing data"');
    if (await syncOverlay.isVisible().catch(() => false)) {
      await syncOverlay.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    }
    
    // Look for "New Project" or "Create Project" button
    const createProjectSelectors = [
      'button:has-text("New Project")',
      'button:has-text("Create Project")',
      'button:has-text("Add Project")',
      'button[aria-label*="project"]',
      'a:has-text("New Project")',
      '[data-testid="create-project"]'
    ];
    
    let createButton = null;
    for (const selector of createProjectSelectors) {
      const button = page.locator(selector);
      if (await button.count() > 0) {
        createButton = button.first();
        console.log(`✅ Found create project button: ${selector}`);
        break;
      }
    }
    
    if (createButton) {
      await createButton.click();
      console.log('🔄 Clicked create project button');
      
      // Wait for form/modal
      await page.waitForTimeout(1000);
      
      // Fill in project name
      const nameInput = page.locator('input[name="name"], input[placeholder*="name"], input[type="text"]').first();
      if (await nameInput.count() > 0) {
        await nameInput.fill('Test Gantt Project');
        console.log('📝 Filled project name');
        
        // Submit form
        const submitButton = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")').first();
        if (await submitButton.count() > 0) {
          await submitButton.click();
          console.log('✅ Submitted project creation');
          
          // Wait for navigation
          await page.waitForTimeout(3000);
          
          // Check if we're now on a project page with Gantt
          const currentUrl = page.url();
          console.log(`📍 Current URL after project creation: ${currentUrl}`);
          
          // Take screenshot
          await page.screenshot({ 
            path: 'screenshots/vibegantt-after-project-creation.png',
            fullPage: true 
          });
          
          // Check for Gantt elements
          const ganttElements = await page.locator('[class*="gantt"], [id*="gantt"]').count();
          console.log(`🔍 Found ${ganttElements} gantt elements after project creation`);
        }
      }
    } else {
      console.log('⚠️ No create project button found');
      
      // Take screenshot of current state
      await page.screenshot({ 
        path: 'screenshots/vibegantt-no-create-button.png',
        fullPage: true 
      });
    }
  });
});