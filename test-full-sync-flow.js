/**
 * Test the full sync flow by properly logging in and checking each step
 */
const { chromium } = require('@playwright/test')

async function testFullSyncFlow() {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({ userDataDir: './.playwright/profiles/profile-main' })
  const page = await context.newPage()

  // Listen to console logs
  page.on('console', msg => {
    console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`)
  })

  console.log('Testing full sync flow...')
  
  try {
    // Navigate to the app
    await page.goto('http://localhost:5173/')
    await page.waitForTimeout(2000)
    
    // Check if we're on login page and login if needed
    const isLoginPage = await page.locator('text=Sign in').count() > 0
    
    if (isLoginPage) {
      console.log('Logging in with Wide Corp CEO...')
      
      // Login with Wide Corp CEO
      await page.fill('input[type="email"]', 'ceo@widecorp.com')
      await page.fill('input[type="password"]', 'WideCorp2024!CEO')
      await page.click('button[type="submit"]')
      
      // Wait for navigation to complete
      console.log('Waiting for login to complete...')
      await page.waitForURL('**/dashboard', { timeout: 15000 })
      console.log('Login successful - now on dashboard')
    } else {
      console.log('Already on dashboard - checking auth...')
    }
    
    // Wait for auth to settle
    await page.waitForTimeout(3000)
    
    // Check auth state step by step
    console.log('\n=== Step 1: Checking Auth State ===')
    const authState = await page.evaluate(() => {
      if (window.authMachineActor) {
        const snapshot = window.authMachineActor.getSnapshot()
        return {
          state: snapshot.value,
          user: snapshot.context.user ? 
            { id: snapshot.context.user.id, email: snapshot.context.user.email } : null,
          currentOrganization: snapshot.context.currentOrganization ? 
            { id: snapshot.context.currentOrganization.id, name: snapshot.context.currentOrganization.name } : null
        }
      }
      return 'Auth machine not found'
    })
    console.log('Auth machine state:', JSON.stringify(authState, null, 2))
    
    // Wait longer for full initialization
    console.log('\n=== Step 2: Waiting for App Initialization ===')
    await page.waitForTimeout(5000)
    
    const appInitState = await page.evaluate(() => {
      if (window.appInitActor) {
        const snapshot = window.appInitActor.getSnapshot()
        return {
          state: snapshot.value,
          organizationId: snapshot.context.organizationId,
          isSyncReady: snapshot.context.isSyncReady
        }
      }
      return 'App init actor not found'
    })
    console.log('App init state:', JSON.stringify(appInitState, null, 2))
    
    console.log('\n=== Step 3: Checking Sync Machine State ===')
    const syncState = await page.evaluate(() => {
      if (window.pureLiveStoreSyncMachineActor) {
        const snapshot = window.pureLiveStoreSyncMachineActor.getSnapshot()
        return {
          state: snapshot.value,
          organizationId: snapshot.context.organizationId,
          userId: snapshot.context.userId,
          currentLSN: snapshot.context.currentLSN,
          isConnected: snapshot.context.isConnected,
          error: snapshot.context.error
        }
      }
      return 'Sync machine not found'
    })
    console.log('Sync machine state:', JSON.stringify(syncState, null, 2))
    
    // Wait even longer to see if sync starts
    console.log('\n=== Step 4: Waiting for Sync Connection ===')
    await page.waitForTimeout(10000)
    
    const finalSyncState = await page.evaluate(() => {
      if (window.pureLiveStoreSyncMachineActor) {
        const snapshot = window.pureLiveStoreSyncMachineActor.getSnapshot()
        return {
          state: snapshot.value,
          organizationId: snapshot.context.organizationId,
          userId: snapshot.context.userId,
          currentLSN: snapshot.context.currentLSN,
          isConnected: snapshot.context.isConnected,
          error: snapshot.context.error
        }
      }
      return 'Sync machine not found'
    })
    console.log('Final sync machine state:', JSON.stringify(finalSyncState, null, 2))
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

testFullSyncFlow()