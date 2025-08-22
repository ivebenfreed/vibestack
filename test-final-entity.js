const { chromium } = require('playwright');
const path = require('path');

(async () => {
  // Use the correct profile from playwright config
  const profileDir = path.join(__dirname, '.playwright/profiles/profile-0');
  
  console.log('Using persistent profile:', profileDir);
  
  const browser = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1280, height: 720 },
    baseURL: 'http://localhost:5173'
  });
  
  const page = await browser.newPage();
  
  console.log('Navigating directly to entity page...');
  await page.goto('/entities/project');
  
  // Wait longer for data to load
  console.log('Waiting for data to load...');
  await page.waitForTimeout(5000);
  
  // Take a screenshot
  await page.screenshot({ 
    path: '.playwright-mcp/entity-page-final.png', 
    fullPage: true 
  });
  
  // Check for data
  const pageContent = await page.content();
  const hasZeroRecords = pageContent.includes('0 records');
  const hasProjectHeader = pageContent.includes('Project');
  const hasLoadingText = pageContent.includes('Loading Organization Data');
  
  // Try to find the UniversalEntityPage component
  const hasEntityPage = pageContent.includes('universal-entity-page') || pageContent.includes('UniversalEntityPage');
  
  // Look for table headers that would indicate data is loaded
  const hasTableHeaders = pageContent.includes('<th') || pageContent.includes('</th>');
  
  // Try to find any records count
  const recordsMatch = pageContent.match(/(\d+)\s+records?/i);
  const recordCount = recordsMatch ? recordsMatch[1] : 'Not found';
  
  // Check for actual project data
  const hasDataRows = pageContent.includes('<tr') && pageContent.includes('</tr>');
  
  console.log('------- Results -------');
  console.log('✓ Page does NOT contain "0 records":', !hasZeroRecords);
  console.log('Has "Project" header:', hasProjectHeader);
  console.log('Has "Loading" message:', hasLoadingText);
  console.log('Has entity page component:', hasEntityPage);
  console.log('Has table headers:', hasTableHeaders);
  console.log('Has data rows:', hasDataRows);
  console.log('Record count found:', recordCount);
  console.log('----------------------');
  
  if (!hasZeroRecords && (hasTableHeaders || hasDataRows || recordCount !== 'Not found')) {
    console.log('✅ SUCCESS: Entity page is showing data!');
  } else if (hasLoadingText) {
    console.log('⏳ Page is still loading...');
  } else if (hasZeroRecords) {
    console.log('❌ ISSUE: Page shows "0 records"');
  } else {
    console.log('❓ Unknown state - check screenshot');
  }
  
  console.log('\nScreenshot saved to .playwright-mcp/entity-page-final.png');
  console.log('Browser is open for inspection. Press Ctrl+C to close.');
  
  // Keep browser open
  await new Promise(() => {});
})();