const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: {
      cookies: [
        {
          name: 'better-auth.session_token',
          value: 'LMozdPlU6snDJfNJq8Wr7Y6HmtR2w6Ry.UMgxhmAJbLuL%2B8rwRs2GAI7Gf%2FJtyr9DZ1%2F%2FwvaScfU%3D',
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          secure: false,
          sameSite: 'Lax'
        }
      ]
    }
  });
  
  const page = await context.newPage();
  
  console.log('Navigating to entity page...');
  await page.goto('http://localhost:5173/entities/project');
  
  // Wait for the page to load
  await page.waitForTimeout(3000);
  
  // Take a screenshot
  await page.screenshot({ path: '.playwright-mcp/entity-page-final-check.png', fullPage: true });
  
  // Check for the records count
  const content = await page.content();
  const hasZeroRecords = content.includes('0 records');
  const hasProjects = content.includes('Project');
  
  console.log('Page contains "0 records":', hasZeroRecords);
  console.log('Page contains "Project":', hasProjects);
  
  // Try to get the actual count
  const recordCount = await page.locator('text=/\\d+ records/').textContent().catch(() => 'Not found');
  console.log('Record count text:', recordCount);
  
  // Keep browser open for inspection
  console.log('Browser is open. Press Ctrl+C to close.');
  await new Promise(() => {});
})();