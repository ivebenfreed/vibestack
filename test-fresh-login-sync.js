/**
 * Test sync flow with a fresh login to establish proper session
 */
const { chromium } = require('@playwright/test')

async function testFreshLoginSync() {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({ userDataDir: './.playwright/profiles/profile-main' })
  const page = await context.newPage()

  // Listen to console logs
  page.on('console', msg => {
    if (msg.text().includes('Auth') || msg.text().includes('Sync') || msg.text().includes('AppInit') || msg.text().includes('Starting')) {
      console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`)
    }
  })

  console.log('Testing sync flow with fresh login...')
  
  try {
    // Navigate to the app
    await page.goto('http://localhost:5173/sign-in')
    await page.waitForTimeout(2000)
    
    console.log('Logging in with Wide Corp CEO...')
    
    // Clear any existing inputs and login
    await page.fill('input[type="email"]', '')
    await page.fill('input[type="password"]', '')
    await page.fill('input[type="email"]', 'ceo@widecorp.com')
    await page.fill('input[type="password"]', 'WideCorp2024!CEO')
    await page.click('button[type="submit"]')
    
    // Wait for navigation to complete
    console.log('Waiting for login to complete...')
    await page.waitForURL('**/dashboard', { timeout: 15000 })
    console.log('Login successful - now on dashboard')
    
    // Wait for auth machine to settle
    console.log('\n=== Step 1: Checking Auth State After Login ===')
    await page.waitForTimeout(3000)
    
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
    
    // Wait longer for app initialization
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

testFreshLoginSync()