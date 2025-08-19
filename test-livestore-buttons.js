#!/usr/bin/env node

/**
 * LiveStore Debug Buttons Test
 * 
 * Simple test that clicks the existing test buttons on the LiveStore debug page
 * to see if mutations are triggering sync messages
 */

const { chromium } = require('playwright');
const path = require('path');

async function testLiveStoreButtons() {
  console.log('🔄 Testing LiveStore Debug Buttons...');
  
  const userDataDir = path.resolve(process.cwd(), '.playwright', 'profiles', 'profile-main');
  
  let browser;
  
  try {
    browser = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      viewport: { width: 1280, height: 720 },
      args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
    });
    
    const page = await browser.newPage();
    
    console.log('🚀 Browser launched with persistent context');
    
    // Navigate to the LiveStore debug page
    console.log('📍 Navigating to LiveStore debug page...');
    await page.goto('http://localhost:5174/debug/livestore-test');
    await page.waitForTimeout(3000);
    
    // Set up network monitoring to catch API calls
    const networkRequests = [];
    const networkResponses = [];
    
    page.on('request', request => {
      if (request.url().includes('/api/') || request.url().includes('sync')) {
        networkRequests.push({
          timestamp: new Date().toISOString(),
          method: request.method(),
          url: request.url(),
          headers: request.headers()
        });
        console.log('📡 Network Request:', request.method(), request.url());
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('/api/') || response.url().includes('sync')) {
        networkResponses.push({
          timestamp: new Date().toISOString(),
          status: response.status(),
          url: response.url()
        });
        console.log('📡 Network Response:', response.status(), response.url());
      }
    });
    
    // Test 1: Click "Run All Tests" button
    console.log('\n🧪 Test 1: Clicking "Run All Tests" button...');
    
    try {
      const runAllButton = page.locator('button:has-text("Run All Tests")');
      await runAllButton.click();
      console.log('✅ Clicked "Run All Tests" button');
      
      // Wait for tests to complete
      await page.waitForTimeout(5000);
      
    } catch (error) {
      console.log('❌ Failed to click "Run All Tests":', error.message);
    }
    
    // Test 2: Click "Test Create Operations" button
    console.log('\n🧪 Test 2: Clicking "Test Create Operations" button...');
    
    try {
      const createOpsButton = page.locator('button:has-text("Test Create Operations")');
      await createOpsButton.click();
      console.log('✅ Clicked "Test Create Operations" button');
      
      // Wait for operations to complete
      await page.waitForTimeout(3000);
      
    } catch (error) {
      console.log('❌ Failed to click "Test Create Operations":', error.message);
    }
    
    // Test 3: Click "🔬 Full LiveStore Test" button
    console.log('\n🧪 Test 3: Clicking "🔬 Full LiveStore Test" button...');
    
    try {
      const fullTestButton = page.locator('button:has-text("🔬 Full LiveStore Test")');
      await fullTestButton.click();
      console.log('✅ Clicked "🔬 Full LiveStore Test" button');
      
      // Wait for full test to complete
      await page.waitForTimeout(7000);
      
    } catch (error) {
      console.log('❌ Failed to click "🔬 Full LiveStore Test":', error.message);
    }
    
    // Test 4: Click "Test Domain Services" button
    console.log('\n🧪 Test 4: Clicking "Test Domain Services" button...');
    
    try {
      const domainServicesButton = page.locator('button:has-text("Test Domain Services")');
      await domainServicesButton.click();
      console.log('✅ Clicked "Test Domain Services" button');
      
      // Wait for domain services test to complete
      await page.waitForTimeout(3000);
      
    } catch (error) {
      console.log('❌ Failed to click "Test Domain Services":', error.message);
    }
    
    // Test 5: Click "Test Sync Status" button
    console.log('\n🧪 Test 5: Clicking "Test Sync Status" button...');
    
    try {
      const syncStatusButton = page.locator('button:has-text("Test Sync Status")');
      await syncStatusButton.click();
      console.log('✅ Clicked "Test Sync Status" button');
      
      // Wait for sync status test to complete
      await page.waitForTimeout(3000);
      
    } catch (error) {
      console.log('❌ Failed to click "Test Sync Status":', error.message);
    }
    
    // Wait for all async operations to complete
    await page.waitForTimeout(5000);
    
    // Check the page for test results
    console.log('\n📊 Checking page for test results...');
    
    const pageContent = await page.evaluate(() => {
      // Look for test results on the page
      const resultElements = Array.from(document.querySelectorAll('[class*="result"], [class*="output"], pre, code'));
      
      return {
        pageText: document.body.innerText.substring(0, 2000),
        resultElements: resultElements.map(el => ({
          tag: el.tagName,
          text: el.textContent.substring(0, 200),
          className: el.className
        })),
        consoleMessages: window.console ? 'Console available' : 'No console',
        liveStoreDomain: !!window.liveStoreDomain,
        liveStore: !!window.liveStore
      };
    });
    
    console.log('📄 Page Content Analysis:');
    console.log('  LiveStore Domain Available:', pageContent.liveStoreDomain);
    console.log('  LiveStore Available:', pageContent.liveStore);
    console.log('  Result Elements Found:', pageContent.resultElements.length);
    
    if (pageContent.resultElements.length > 0) {
      console.log('\n📋 Test Result Elements:');
      pageContent.resultElements.forEach((element, index) => {
        console.log(`  ${index + 1}. <${element.tag}> ${element.text.substring(0, 100)}...`);
      });
    }
    
    // Look for specific success/error patterns in the page text
    const hasSuccessIndicators = pageContent.pageText.includes('✅') || 
                                pageContent.pageText.includes('SUCCESS') ||
                                pageContent.pageText.includes('created') ||
                                pageContent.pageText.includes('mutation');
    
    const hasErrorIndicators = pageContent.pageText.includes('❌') ||
                              pageContent.pageText.includes('ERROR') ||
                              pageContent.pageText.includes('failed');
    
    console.log('\n📈 Page Content Indicators:');
    console.log('  Success Indicators:', hasSuccessIndicators ? '✅ FOUND' : '❌ NOT FOUND');
    console.log('  Error Indicators:', hasErrorIndicators ? '⚠️ FOUND' : '✅ NOT FOUND');
    
    // Summarize network activity
    console.log('\n🌐 Network Activity Summary:');
    console.log('  API Requests:', networkRequests.length);
    console.log('  API Responses:', networkResponses.length);
    
    if (networkRequests.length > 0) {
      console.log('\n📡 Network Requests Captured:');
      networkRequests.forEach((req, index) => {
        console.log(`  ${index + 1}. ${req.method} ${req.url}`);
      });
    }
    
    if (networkResponses.length > 0) {
      console.log('\n📡 Network Responses Captured:');
      networkResponses.forEach((res, index) => {
        console.log(`  ${index + 1}. ${res.status} ${res.url}`);
      });
    }
    
    // Take a screenshot
    console.log('\n📸 Taking verification screenshot...');
    await page.screenshot({ 
      path: 'livestore-buttons-test.png',
      fullPage: true 
    });
    
    // Final assessment
    const hasMutationActivity = hasSuccessIndicators || networkRequests.length > 0;
    const hasSyncActivity = networkRequests.some(req => 
      req.url.includes('sync') || 
      req.url.includes('mutation') ||
      req.url.includes('livestore')
    );
    
    console.log('\n🎉 LIVESTORE BUTTONS TEST SUMMARY:');
    console.log('='.repeat(60));
    console.log('  🔄 Mutation Activity:', hasMutationActivity ? '✅ DETECTED' : '❌ NOT DETECTED');
    console.log('  📡 Sync Activity:', hasSyncActivity ? '✅ DETECTED' : '❌ NOT DETECTED');
    console.log('  🌐 Network Requests:', networkRequests.length);
    console.log('  📊 Test Results Found:', pageContent.resultElements.length);
    console.log('='.repeat(60));
    
    if (hasMutationActivity) {
      console.log('🎯 LIVESTORE FUNCTIONALITY CONFIRMED! ✅');
      console.log('   Test buttons are triggering LiveStore operations');
      
      if (hasSyncActivity) {
        console.log('   🔄 Sync messages are being generated');
      } else {
        console.log('   ⚠️ Limited sync message activity detected');
      }
    } else {
      console.log('⚠️ LIMITED LIVESTORE ACTIVITY');
      console.log('   Check LiveStore integration and test implementations');
    }
    
    console.log('\n📍 Screenshot saved as: livestore-buttons-test.png');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (browser) {
      console.log('\n🔒 Closing browser...');
      await browser.close();
    }
  }
}

// Run the test
testLiveStoreButtons()
  .then(() => {
    console.log('\n✅ LiveStore buttons test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ LiveStore buttons test failed:', error);
    process.exit(1);
  });