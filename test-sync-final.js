/**
 * Final sync test - should work with our fixes
 */
const { chromium } = require('@playwright/test')

async function testSyncFinal() {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({ userDataDir: './.playwright/profiles/profile-main' })
  const page = await context.newPage()

  // Listen to console logs
  page.on('console', msg => {
    if (msg.text().includes('Sync') || msg.text().includes('live') || msg.text().includes('srv_')) {
      console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`)
    }
  })

  console.log('Testing final sync flow...')
  
  try {
    // Navigate and login
    await page.goto('http://localhost:5173/sign-in')
    await page.fill('input[type="email"]', 'ceo@widecorp.com')
    await page.fill('input[type="password"]', 'WideCorp2024!CEO')
    await page.click('button[type="submit"]')
    
    // Wait for dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 })
    
    // Wait for sync to complete
    await page.waitForTimeout(10000)
    
    // Check final sync machine state
    const finalState = await page.evaluate(() => {
      if (window.pureLiveStoreSyncMachineActor) {
        const snapshot = window.pureLiveStoreSyncMachineActor.getSnapshot()
        return {
          state: snapshot.value,
          isConnected: snapshot.context.isConnected,
          syncPhase: snapshot.context.syncPhase,
          error: snapshot.context.error
        }
      }
      return 'Sync machine not found'
    })
    
    console.log('\n🎯 FINAL SYNC STATE:', JSON.stringify(finalState, null, 2))
    
    if (finalState.state === 'live_sync') {
      console.log('\n✅ SUCCESS: Sync machine reached live_sync state!')
    } else {
      console.log('\n❌ FAILED: Sync machine not in live_sync state')
    }
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

testSyncFinal()