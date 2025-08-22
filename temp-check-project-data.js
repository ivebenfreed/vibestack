const { chromium } = require('playwright');

async function checkProjectData() {
  console.log('🚀 Starting browser to check project data...');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    // Create context - will check if already logged in
    const context = await browser.newContext();
    const page = await context.newPage();
    
    console.log('📂 Navigating to project entities page...');
    await page.goto('http://localhost:5173/entities/project');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check if we're on login page and need to authenticate
    const isLoginPage = await page.locator('text=Login').isVisible().catch(() => false);
    
    if (isLoginPage) {
      console.log('🔐 Not logged in, authenticating with CEO credentials...');
      
      // Fill in login form
      await page.fill('input[type="email"]', 'ceo@widecorp.com');
      await page.fill('input[type="password"]', 'WideCorp2024!CEO');
      await page.click('button:has-text("Login")');
      
      // Wait for login to complete
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Navigate to project entities page again
      console.log('🚀 Login successful, navigating to project entities...');
      await page.goto('http://localhost:5173/entities/project');
      await page.waitForLoadState('networkidle');
    }
    
    // Wait a bit more for data to load
    await page.waitForTimeout(3000);
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'project-entities-page.png', fullPage: true });
    console.log('📸 Screenshot saved as project-entities-page.png');
    
    // Check for project data indicators
    const pageContent = await page.content();
    
    // Look for "0 records" vs actual data
    const hasZeroRecords = pageContent.includes('0 records') || pageContent.includes('No data');
    const hasProjectData = pageContent.includes('Project') && !hasZeroRecords;
    
    // Try to find specific elements that indicate data is loaded
    const dataElements = await page.$$('[data-testid*="project"], .project-row, .entity-row, .data-table-row');
    const dataCount = dataElements.length;
    
    // Look for loading indicators
    const isLoading = await page.locator('text=Loading').isVisible().catch(() => false);
    const hasSpinner = await page.locator('[data-testid="loading"], .spinner, .loading').isVisible().catch(() => false);
    
    console.log('\n📊 Project Data Check Results:');
    console.log('================================');
    console.log(`❓ Has "0 records" indicator: ${hasZeroRecords}`);
    console.log(`✅ Has project data indicators: ${hasProjectData}`);
    console.log(`🔢 Data elements found: ${dataCount}`);
    console.log(`⏳ Currently loading: ${isLoading || hasSpinner}`);
    
    // Try to extract the actual count if visible
    const countText = await page.textContent('body');
    const countMatch = countText.match(/(\d+)\s*(records?|projects?|items?)/i);
    if (countMatch) {
      console.log(`📈 Detected count: ${countMatch[1]} ${countMatch[2]}`);
    }
    
    // Check for error messages
    const hasError = countText.includes('Error') || countText.includes('Failed');
    if (hasError) {
      console.log('❌ Error detected on page');
    }
    
    console.log('\n🎯 Summary:');
    if (hasZeroRecords) {
      console.log('❌ ISSUE: Page shows "0 records" - data not loading correctly');
    } else if (dataCount > 0) {
      console.log(`✅ SUCCESS: Found ${dataCount} data elements - projects appear to be loading`);
    } else if (isLoading || hasSpinner) {
      console.log('⏳ WAITING: Page still loading data');
    } else {
      console.log('⚠️ UNCLEAR: Cannot determine data state definitively');
    }
    
    await context.close();
  } catch (error) {
    console.error('❌ Error checking project data:', error);
  } finally {
    await browser.close();
  }
}

checkProjectData();