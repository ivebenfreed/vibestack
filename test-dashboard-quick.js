/**
 * Quick dashboard test to verify the fix
 */

const { chromium } = require('playwright');

async function testDashboard() {
  console.log('🚀 Quick dashboard test...');
  
  const context = await chromium.launchPersistentContext('./.playwright/profiles/profile-main', {
    headless: false
  });
  const page = await context.newPage();
  
  try {
    console.log('📍 Navigating to dashboard...');
    await page.goto('http://localhost:5173/#/');
    
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard-content"]', { timeout: 10000 });
    console.log('✅ Dashboard loaded');
    
    // Check LiveStore availability
    await page.waitForTimeout(3000);
    const liveStoreCheck = await page.evaluate(() => {
      return {
        hasLiveStore: !!window.LiveStore,
        hasGlobalLiveStore: !!window.globalLiveStore,
        authState: !!window.authMachineActor,
        appInitState: !!window.appInitActor
      };
    });
    
    console.log('🔍 LiveStore Status:', liveStoreCheck);
    
    // Check for entity cards
    const entityCards = await page.$$('[data-testid="dashboard-content"] .grid > div');
    console.log(`📊 Found ${entityCards.length} entity cards`);
    
    if (entityCards.length > 0) {
      console.log('✅ Dashboard showing entity cards - fix appears successful!');
    } else {
      console.log('⚠️ No entity cards found');
    }
    
    console.log('🎯 Test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await context.close();
  }
}

testDashboard();