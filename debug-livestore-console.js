/**
 * Debug LiveStore initialization by checking console logs
 */

const { chromium } = require('playwright');

async function debugLiveStore() {
  console.log('🔍 Debugging LiveStore initialization...');
  
  const context = await chromium.launchPersistentContext('./.playwright/profiles/profile-main', {
    headless: false
  });
  const page = await context.newPage();
  
  // Capture console logs
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    if (text.includes('LiveStore') || text.includes('Database') || text.includes('Dashboard') || text.includes('Auth') || text.includes('App init')) {
      console.log('📝', text);
    }
  });
  
  try {
    console.log('📍 Navigating to dashboard...');
    await page.goto('http://localhost:5173/#/');
    
    // Wait for things to initialize
    await page.waitForTimeout(5000);
    
    // Check states
    const states = await page.evaluate(() => {
      const authActor = window.authMachineActor;
      const appInitActor = window.appInitActor;
      
      return {
        auth: authActor ? {
          state: authActor.getSnapshot().value,
          user: authActor.getSnapshot().context.user?.email,
          org: authActor.getSnapshot().context.currentOrganization?.name
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
          orgId: localStorage.getItem('vibestack-last-organization-id'),
          authState: localStorage.getItem('vibestack-auth-state') ? 'present' : 'missing'
        }
      };
    });
    
    console.log('\n🎯 State Summary:');
    console.log('Auth:', states.auth);
    console.log('App Init:', states.appInit);
    console.log('LiveStore:', states.liveStore);
    console.log('localStorage:', states.localStorage);
    
    console.log('\n📋 Key logs (last 20):');
    logs.slice(-20).forEach(log => {
      if (log.includes('LiveStore') || log.includes('Database') || log.includes('Dashboard')) {
        console.log('   ', log);
      }
    });
    
    console.log('\n🔍 Browser will stay open for manual inspection...');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
  // Don't close browser for manual inspection
}

debugLiveStore();