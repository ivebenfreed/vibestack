/**
 * Debug sync issue by navigating to dashboard and checking logs
 */
const { chromium } = require('@playwright/test')

async function debugSync() {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({ userDataDir: './.playwright/profiles/profile-main' })
  const page = await context.newPage()

  // Listen to console logs
  page.on('console', msg => {
    if (msg.text().includes('AppInitMachine') || msg.text().includes('PureLiveStoreSyncMachine') || msg.text().includes('auth machine')) {
      console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`)
    }
  })

  console.log('Navigating to dashboard...')
  
  try {
    // Navigate to the dashboard
    await page.goto('http://localhost:5173/')
    await page.waitForTimeout(2000)
    
    // Check if we're on login page
    const isLoginPage = await page.locator('text=Sign in').count() > 0
    
    if (isLoginPage) {
      console.log('Not logged in - need to authenticate first')
      
      // Login with Wide Corp CEO
      await page.fill('input[type="email"]', 'ceo@widecorp.com')
      await page.fill('input[type="password"]', 'WideCorp2024!CEO')
      await page.click('button[type="submit"]')
      
      // Wait for dashboard
      await page.waitForURL('**/dashboard', { timeout: 10000 })
      await page.waitForTimeout(3000)
    } else {
      console.log('Already logged in')
    }
    
    // Wait longer and check console logs
    await page.waitForTimeout(10000)
    console.log('Checking app state...')
    
    // Check machine states
    const appStates = await page.evaluate(() => {
      return {
        authMachine: window.authMachineActor ? window.authMachineActor.getSnapshot().value : 'not found',
        appInitActor: window.appInitActor ? window.appInitActor.getSnapshot().value : 'not found',
        syncMachine: window.pureLiveStoreSyncMachineActor ? window.pureLiveStoreSyncMachineActor.getSnapshot().value : 'not found'
      }
    })
    
    console.log('Machine states:', appStates)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

debugSync()