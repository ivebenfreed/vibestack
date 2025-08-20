/**
 * Simple test to verify sync is working and get machine state
 */
const { chromium } = require('@playwright/test')

async function testSyncSuccess() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ userDataDir: './.playwright/profiles/profile-main' })
  const page = await context.newPage()

  try {
    // Navigate and login
    await page.goto('http://localhost:5173/sign-in')
    await page.fill('input[type="email"]', 'ceo@widecorp.com')
    await page.fill('input[type="password"]', 'WideCorp2024!CEO')
    await page.click('button[type="submit"]')
    
    // Wait for dashboard (be more flexible with URL matching)
    await page.waitForTimeout(15000)  // Wait long enough for sync to complete
    
    // Check final sync machine state
    const syncState = await page.evaluate(() => {
      if (window.pureLiveStoreSyncMachineActor) {
        const snapshot = window.pureLiveStoreSyncMachineActor.getSnapshot()
        return {
          state: snapshot.value,
          isConnected: snapshot.context.isConnected,
          syncPhase: snapshot.context.syncPhase,
          organizationId: snapshot.context.organizationId,
          userId: snapshot.context.userId,
          currentLSN: snapshot.context.currentLSN,
          error: snapshot.context.error
        }
      }
      return null
    })
    
    // Check app init state
    const appInitState = await page.evaluate(() => {
      if (window.appInitActor) {
        const snapshot = window.appInitActor.getSnapshot()
        return {
          state: snapshot.value,
          isSyncReady: snapshot.context.isSyncReady,
          organizationId: snapshot.context.organizationId
        }
      }
      return null
    })
    
    console.log('\n🎯 SYNC STATE:', JSON.stringify(syncState, null, 2))
    console.log('\n🎯 APP INIT STATE:', JSON.stringify(appInitState, null, 2))
    
    if (syncState?.state === 'live_sync' && syncState?.isConnected === true) {
      console.log('\n✅ SUCCESS: Sync system is fully operational!')
      console.log('🔥 Ready to receive table change notifications!')
    } else {
      console.log('\n❌ ISSUE: Sync not in expected state')
    }
    
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await browser.close()
  }
}

testSyncSuccess()