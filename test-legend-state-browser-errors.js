/**
 * Check what browser errors occur when loading the Legend State page
 */

const { chromium } = require('playwright');

async function checkLegendStateErrors() {
  console.log('🔍 Checking Legend State page for browser errors...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Collect all console messages and errors
  const consoleMessages = [];
  const pageErrors = [];
  
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    
    consoleMessages.push({ type, text });
    
    if (type === 'error') {
      console.log(`❌ [Console Error] ${text}`);
    } else if (type === 'warn') {
      console.log(`⚠️ [Console Warning] ${text}`);
    }
  });
  
  page.on('pageerror', error => {
    pageErrors.push(error.message);
    console.error(`💥 [Page Error] ${error.message}`);
  });
  
  try {
    console.log('🚀 Navigating to Legend State integration page...');
    await page.goto('http://localhost:5173/_authenticated/debug/legend-state-full-integration', {
      waitUntil: 'networkidle'
    });
    
    console.log('✅ Page loaded, waiting for any dynamic errors...');
    await page.waitForTimeout(5000);
    
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);
    
    // Check if there are any visible error messages
    const errorElements = await page.$$('text=/error/i');
    if (errorElements.length > 0) {
      console.log(`🚨 Found ${errorElements.length} error elements on page`);
      for (let i = 0; i < errorElements.length; i++) {
        const text = await errorElements[i].textContent();
        console.log(`   Error ${i + 1}: ${text}`);
      }
    }
    
    // Check page content
    const bodyText = await page.textContent('body');
    if (bodyText.includes('Initialize VibeStack Legend State')) {
      console.log('✅ Found Legend State initialization button - page loaded correctly');
    } else if (bodyText.includes('sign')) {
      console.log('ℹ️ Page seems to be showing sign-in form (not authenticated)');
    } else {
      console.log('⚠️ Unexpected page content');
    }
    
    console.log('\n📊 Summary:');
    console.log(`   Console Errors: ${consoleMessages.filter(m => m.type === 'error').length}`);
    console.log(`   Console Warnings: ${consoleMessages.filter(m => m.type === 'warn').length}`);
    console.log(`   Page Errors: ${pageErrors.length}`);
    
    if (pageErrors.length === 0 && consoleMessages.filter(m => m.type === 'error').length === 0) {
      console.log('🎉 No browser errors found! The page loads successfully.');
    }
    
  } catch (error) {
    console.error(`💀 Navigation failed: ${error.message}`);
  }
  
  // Keep browser open for manual inspection
  console.log('\n🔍 Browser will remain open for manual inspection...');
  console.log('   Check the browser console for any additional errors');
  console.log('   Press Ctrl+C to close when done');
  
  // Don't close automatically
  // await browser.close();
}

checkLegendStateErrors().catch(console.error);