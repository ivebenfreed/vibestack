const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const profileDir = path.join(__dirname, '.playwright/profiles/profile-0');
  
  console.log('Using persistent profile:', profileDir);
  
  const browser = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1280, height: 720 },
    baseURL: 'http://localhost:5173'
  });
  
  const page = await browser.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    if (msg.text().includes('[EntityPage]') || msg.text().includes('[OrgDataStore]')) {
      console.log('Browser console:', msg.text());
    }
  });
  
  console.log('Navigating to entity page...');
  await page.goto('/entities/project');
  
  // Wait for the store to be initialized
  console.log('Waiting for store initialization...');
  
  // Try multiple times to wait for content
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(2000);
    
    const pageContent = await page.content();
    const hasLoading = pageContent.includes('Loading Organization Data');
    const hasEntityNotFound = pageContent.includes('Entity Not Found');
    const hasTable = pageContent.includes('<table');
    const hasProjectInTitle = pageContent.includes('>Project<');
    
    console.log(`Attempt ${i+1}:`, {
      hasLoading,
      hasEntityNotFound,
      hasTable,
      hasProjectInTitle
    });
    
    if (hasTable || hasProjectInTitle || hasEntityNotFound) {
      console.log('Page loaded!');
      break;
    }
    
    if (i === 5) {
      // Try refreshing the page
      console.log('Refreshing page...');
      await page.reload();
    }
  }
  
  // Final screenshot
  await page.screenshot({ 
    path: '.playwright-mcp/entity-page-wait-store.png', 
    fullPage: true 
  });
  
  // Final check
  const finalContent = await page.content();
  const hasZeroRecords = finalContent.includes('0 records');
  const hasData = finalContent.includes('<table') || finalContent.includes('<tr');
  const recordsMatch = finalContent.match(/(\d+)\s+records?/i);
  
  console.log('\n------- Final Results -------');
  console.log('✓ Does NOT show "0 records":', !hasZeroRecords);
  console.log('Has table/data:', hasData);
  console.log('Record count:', recordsMatch ? recordsMatch[0] : 'Not found');
  console.log('-----------------------------');
  
  if (hasData && !hasZeroRecords) {
    console.log('✅ SUCCESS: Entity page is showing data!');
  }
  
  console.log('\nScreenshot saved. Browser open for inspection.');
  await new Promise(() => {});
})();