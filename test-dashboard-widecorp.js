/**
 * Test dashboard with Wide Corp organization specifically
 */

const { chromium } = require('playwright');

async function testWideCorp() {
  console.log('🏢 Testing dashboard with Wide Corp...');
  
  const context = await chromium.launchPersistentContext('./.playwright/profiles/profile-main', {
    headless: false
  });
  const page = await context.newPage();
  
  try {
    // Go to sign in page
    console.log('🔐 Going to sign in...');
    await page.goto('http://localhost:5173/sign-in');
    
    // Fill in Wide Corp CEO credentials
    await page.fill('input[type="email"]', 'ceo@widecorp.com');
    await page.fill('input[type="password"]', 'WideCorp2024!CEO');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    console.log('⏳ Waiting for dashboard redirect...');
    await page.waitForURL('**/');
    
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard-content"]', { timeout: 15000 });
    console.log('✅ Dashboard loaded');
    
    // Wait for initialization
    await page.waitForTimeout(5000);
    
    // Check states
    const result = await page.evaluate(() => {
      const authActor = window.authMachineActor;
      const appInitActor = window.appInitActor;
      
      return {
        auth: authActor ? {
          user: authActor.getSnapshot().context.user?.email,
          org: authActor.getSnapshot().context.currentOrganization?.name,
          orgId: authActor.getSnapshot().context.currentOrganization?.id
        } : 'not available',
        appInit: appInitActor ? {
          state: appInitActor.getSnapshot().value,
          isDatabaseInitialized: appInitActor.getSnapshot().context.isDatabaseInitialized,
          isLiveStoreReady: appInitActor.getSnapshot().context.isLiveStoreReady
        } : 'not available',
        liveStore: {
          LiveStore: !!window.LiveStore,
          globalLiveStore: !!window.globalLiveStore
        },
        localStorage: {
          orgId: localStorage.getItem('vibestack-last-organization-id')
        },
        entityCards: document.querySelectorAll('[data-testid="dashboard-content"] .grid > div').length
      };
    });
    
    console.log('\n🎯 Wide Corp Test Results:');
    console.log('User:', result.auth.user);
    console.log('Organization:', result.auth.org);
    console.log('Org ID:', result.auth.orgId);
    console.log('App Init State:', result.appInit.state);
    console.log('LiveStore Available:', result.liveStore);
    console.log('Entity Cards:', result.entityCards);
    
    if (result.auth.orgId === '01920000-1000-7000-8000-000000000001') {
      console.log('✅ Correct Wide Corp organization selected!');
      if (result.entityCards > 0) {
        console.log('✅ Dashboard showing entity cards - fix successful!');
      } else {
        console.log('⚠️ Wide Corp selected but no entity cards showing');
      }
    } else {
      console.log('⚠️ Wrong organization - not Wide Corp');
    }
    
    console.log('\n🔍 Browser will stay open for manual inspection...');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
  // Keep browser open
}

testWideCorp();