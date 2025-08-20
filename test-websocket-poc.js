/**
 * Test the WebSocket POC page to demonstrate table change notifications
 */
const { chromium } = require('@playwright/test')

async function testWebSocketPOC() {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({ userDataDir: './.playwright/profiles/profile-main' })
  const page = await context.newPage()

  // Listen to console logs to monitor table change notifications
  page.on('console', msg => {
    const text = msg.text()
    if (text.includes('Legend State') || text.includes('srv_table_change_notification') || text.includes('Table change')) {
      console.log(`[BROWSER] ${msg.type()}: ${text}`)
    }
  })

  console.log('Testing WebSocket POC page for table change notifications...')
  
  try {
    // First navigate to sign-in and login to initialize the sync system
    console.log('🔐 Logging in...')
    await page.goto('http://localhost:5173/sign-in')
    await page.fill('input[type="email"]', 'ceo@widecorp.com')
    await page.fill('input[type="password"]', 'WideCorp2024!CEO')
    await page.click('button[type="submit"]')
    
    // Wait for dashboard and sync system to initialize
    console.log('⏳ Waiting for dashboard and sync system to initialize...')
    await page.waitForURL('**/dashboard', { timeout: 15000 })
    await page.waitForTimeout(10000) // Wait for sync to reach live_sync state
    
    // Check that sync is working before going to POC page
    const syncStateAfterLogin = await page.evaluate(() => {
      return {
        syncMachineExists: !!window.pureLiveStoreSyncMachineActor,
        syncMachineState: window.pureLiveStoreSyncMachineActor?.getSnapshot().value,
        isConnected: window.pureLiveStoreSyncMachineActor?.getSnapshot().context.isConnected
      }
    })
    console.log('📊 Sync state after login:', JSON.stringify(syncStateAfterLogin, null, 2))
    
    // Now navigate to the WebSocket POC page
    console.log('📄 Navigating to WebSocket POC page...')
    await page.goto('http://localhost:5173/debug/legend-state-websocket-poc')
    
    // Wait for the POC page to load and connect to sync system
    console.log('⏳ Waiting for POC page to connect to sync system...')
    await page.waitForTimeout(5000)
    
    // Check initial state
    const initialState = await page.evaluate(() => {
      return {
        syncMachineExists: !!window.pureLiveStoreSyncMachineActor,
        syncMachineState: window.pureLiveStoreSyncMachineActor?.getSnapshot().value,
        legendStateConnected: document.querySelector('[data-testid="websocket-status"]')?.textContent?.includes('Connected') || false
      }
    })
    
    console.log('📊 Initial state:', JSON.stringify(initialState, null, 2))
    
    // Wait a bit more for Legend State system to connect
    await page.waitForTimeout(3000)
    
    // Check projects count before
    const projectsCountBefore = await page.evaluate(() => {
      const projectsCard = document.querySelector('[data-testid="projects-count"]') || 
                          Array.from(document.querySelectorAll('h3')).find(h => h.textContent?.includes('Projects'))
      return projectsCard?.textContent || 'Projects count not found'
    })
    console.log('📊 Projects before:', projectsCountBefore)
    
    // Now create a sample project to trigger a table change notification
    console.log('🚀 Creating sample project to test table change notifications...')
    await page.click('button:has-text("Create Sample Project")')
    
    // Wait for the API call to complete and table notification to be received
    console.log('⏳ Waiting for table change notification...')
    await page.waitForTimeout(3000)
    
    // Check projects count after
    const projectsCountAfter = await page.evaluate(() => {
      const projectsCard = document.querySelector('[data-testid="projects-count"]') || 
                          Array.from(document.querySelectorAll('h3')).find(h => h.textContent?.includes('Projects'))
      return projectsCard?.textContent || 'Projects count not found'
    })
    console.log('📊 Projects after:', projectsCountAfter)
    
    // Try updating a project if any exist
    const hasProjects = await page.evaluate(() => {
      return document.querySelector('button:has-text("Update Random Project")')?.disabled === false
    })
    
    if (hasProjects) {
      console.log('🔄 Updating random project to test table change notifications...')
      await page.click('button:has-text("Update Random Project")')
      await page.waitForTimeout(3000)
      
      const projectsCountAfterUpdate = await page.evaluate(() => {
        const projectsCard = document.querySelector('[data-testid="projects-count"]') || 
                            Array.from(document.querySelectorAll('h3')).find(h => h.textContent?.includes('Projects'))
        return projectsCard?.textContent || 'Projects count not found'
      })
      console.log('📊 Projects after update:', projectsCountAfterUpdate)
    }
    
    // Check final Legend State connection status
    const finalConnectionStatus = await page.evaluate(() => {
      const badge = Array.from(document.querySelectorAll('.badge')).find(b => 
        b.textContent?.includes('WebSocket')
      )
      return badge?.textContent || 'WebSocket status not found'
    })
    
    console.log('📊 Final WebSocket status:', finalConnectionStatus)
    
    if (finalConnectionStatus.includes('Connected')) {
      console.log('✅ SUCCESS: WebSocket POC page is connected to sync system!')
      console.log('🎯 Table change notifications should be working')
      
      // Keep the browser open for a bit to observe real-time updates
      console.log('📺 Keeping browser open to observe table change notifications...')
      await page.waitForTimeout(10000)
    } else {
      console.log('❌ ISSUE: WebSocket POC page not connected to sync system')
    }
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

testWebSocketPOC()