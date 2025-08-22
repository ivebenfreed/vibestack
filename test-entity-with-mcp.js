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
  
  console.log('Navigating to entity page...');
  await page.goto('/entities/project');
  
  // Wait for content to load
  await page.waitForTimeout(2000);
  
  // Take a screenshot
  await page.screenshot({ 
    path: '.playwright-mcp/entity-page-with-profile.png', 
    fullPage: true 
  });
  
  // Check for data
  const pageContent = await page.content();
  const hasZeroRecords = pageContent.includes('0 records');
  const hasProjectText = pageContent.includes('Project');
  
  // Try to find any text containing "records"
  const recordsText = await page.locator('text=/\\d+ records?/i').allTextContents().catch(() => []);
  
  console.log('------- Results -------');
  console.log('Page contains "0 records":', hasZeroRecords);
  console.log('Page contains "Project":', hasProjectText);
  console.log('Records text found:', recordsText);
  
  // Check if there's a table with data
  const tableRows = await page.locator('table tbody tr').count().catch(() => 0);
  console.log('Table rows found:', tableRows);
  
  // Check for any error messages
  const errorMessages = await page.locator('text=/error|failed|exception/i').allTextContents().catch(() => []);
  if (errorMessages.length > 0) {
    console.log('Error messages found:', errorMessages);
  }
  
  console.log('----------------------');
  console.log('Screenshot saved to .playwright-mcp/entity-page-with-profile.png');
  console.log('Browser is open for inspection. Press Ctrl+C to close.');
  
  // Keep browser open
  await new Promise(() => {});
})();