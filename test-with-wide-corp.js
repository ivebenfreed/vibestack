const { chromium } = require('playwright');
const path = require('path');

(async () => {
  // Use the persistent profile from .playwright/profiles/profile-main
  const profileDir = path.join(__dirname, '.playwright/profiles/profile-main');
  
  console.log('Using persistent profile:', profileDir);
  
  const browser = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1280, height: 720 },
    baseURL: 'http://localhost:5173'
  });
  
  const page = await browser.newPage();
  
  // First, go to dashboard to switch organization
  console.log('Navigating to dashboard...');
  await page.goto('/');
  
  await page.waitForTimeout(2000);
  
  // Click on the organization switcher
  console.log('Looking for organization switcher...');
  const orgSwitcher = await page.locator('button:has-text("Playwright Test Organization"), button:has-text("Wide Corp Solutions")').first();
  if (await orgSwitcher.count() > 0) {
    const currentOrg = await orgSwitcher.textContent();
    console.log('Current organization:', currentOrg);
    
    if (!currentOrg.includes('Wide Corp')) {
      console.log('Switching to Wide Corp Solutions...');
      await orgSwitcher.click();
      
      // Wait for dropdown
      await page.waitForTimeout(1000);
      
      // Click on Wide Corp Solutions
      await page.locator('text=Wide Corp Solutions').click();
      
      // Wait for switch to complete
      await page.waitForTimeout(2000);
    }
  }
  
  console.log('Navigating to entity page...');
  await page.goto('/entities/project');
  
  // Wait for content to load
  await page.waitForTimeout(3000);
  
  // Take a screenshot
  await page.screenshot({ 
    path: '.playwright-mcp/entity-page-wide-corp.png', 
    fullPage: true 
  });
  
  // Check for data
  const pageContent = await page.content();
  const hasZeroRecords = pageContent.includes('0 records');
  const hasProjectText = pageContent.includes('Project');
  const hasLoadingText = pageContent.includes('Loading Organization Data');
  
  // Try to find any text containing "records"
  const recordsText = await page.locator('text=/\\d+ records?/i').allTextContents().catch(() => []);
  
  // Check if there's a table with data
  const tableRows = await page.locator('table tbody tr').count().catch(() => 0);
  
  console.log('------- Results -------');
  console.log('Page contains "0 records":', hasZeroRecords);
  console.log('Page contains "Project":', hasProjectText);
  console.log('Page contains "Loading":', hasLoadingText);
  console.log('Records text found:', recordsText);
  console.log('Table rows found:', tableRows);
  console.log('----------------------');
  console.log('Screenshot saved to .playwright-mcp/entity-page-wide-corp.png');
  console.log('Browser is open for inspection. Press Ctrl+C to close.');
  
  // Keep browser open
  await new Promise(() => {});
})();