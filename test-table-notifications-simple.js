/**
 * Simple test to demonstrate table change notifications
 * Uses the API to create a project and monitors console logs for notifications
 */
const { chromium } = require('@playwright/test')

async function testTableNotifications() {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({ userDataDir: './.playwright/profiles/profile-main' })
  const page = await context.newPage()

  const receivedNotifications = []
  
  // Listen to console logs for table change notifications
  page.on('console', msg => {
    const text = msg.text()
    if (text.includes('srv_table_change_notification') || 
        text.includes('Table change notification') ||
        text.includes('📢') ||
        text.includes('Legend State')) {
      console.log(`[BROWSER NOTIFICATION] ${msg.type()}: ${text}`)
      receivedNotifications.push(text)
    }
  })

  console.log('Testing table change notifications...')
  
  try {
    // Navigate to sign-in page
    console.log('🔐 Logging in...')
    await page.goto('http://localhost:5173/sign-in')
    await page.fill('input[type="email"]', 'ceo@widecorp.com')
    await page.fill('input[type="password"]', 'WideCorp2024!CEO')
    await page.click('button[type="submit"]')
    
    // Wait for any redirect to complete
    await page.waitForTimeout(5000)
    console.log('Current URL:', page.url())
    
    // Wait for sync system to initialize
    console.log('⏳ Waiting for sync system to initialize...')
    await page.waitForTimeout(10000)
    
    // Check sync machine state
    const syncState = await page.evaluate(() => {
      return {
        syncMachineExists: !!window.pureLiveStoreSyncMachineActor,
        syncMachineState: window.pureLiveStoreSyncMachineActor?.getSnapshot().value,
        isConnected: window.pureLiveStoreSyncMachineActor?.getSnapshot().context.isConnected,
        syncPhase: window.pureLiveStoreSyncMachineActor?.getSnapshot().context.syncPhase
      }
    })
    console.log('📊 Sync state:', JSON.stringify(syncState, null, 2))
    
    if (syncState.syncMachineState === 'live_sync') {
      console.log('✅ Sync machine is in live_sync state - table notifications should work')
      
      // Navigate to the WebSocket POC page to set up our notification listener
      console.log('📄 Navigating to WebSocket POC page...')
      await page.goto('http://localhost:5173/debug/legend-state-websocket-poc')
      await page.waitForTimeout(3000)
      
      // Now use the API to create a project which should trigger a table notification
      console.log('🚀 Creating project via API to trigger table change notification...')
      
      // Get the organization ID and make API call directly
      const apiResponse = await page.evaluate(async () => {
        try {
          const response = await fetch('http://localhost:8787/api/archetype/orgs/01920000-1000-7000-8000-000000000001/data/Project', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: `API Test Project ${Date.now()}`,
              description: 'Created via API to test table notifications',
              status: 'planning',
              project_type: 'development',
              budget: 50000.00
            })
          })
          
          if (!response.ok) {
            throw new Error(`API call failed: ${response.status}`)
          }
          
          const result = await response.json()
          return { success: true, data: result }
          
        } catch (error) {
          return { success: false, error: error.message }
        }
      })
      
      console.log('📊 API response:', JSON.stringify(apiResponse, null, 2))
      
      if (apiResponse.success) {
        console.log('✅ Project created successfully via API')
        console.log('⏳ Waiting for table change notification...')
        
        // Wait for notification to be received
        await page.waitForTimeout(5000)
        
        // Check if we received any notifications
        if (receivedNotifications.length > 0) {
          console.log('✅ SUCCESS: Received table change notifications!')
          console.log('📢 Notifications received:')
          receivedNotifications.forEach((notification, index) => {
            console.log(`  ${index + 1}. ${notification}`)
          })
        } else {
          console.log('❌ No table change notifications received yet')
          console.log('⏳ Waiting a bit longer...')
          await page.waitForTimeout(10000)
          
          if (receivedNotifications.length > 0) {
            console.log('✅ SUCCESS: Received delayed table change notifications!')
            receivedNotifications.forEach((notification, index) => {
              console.log(`  ${index + 1}. ${notification}`)
            })
          } else {
            console.log('❌ No table change notifications received after waiting')
          }
        }
      } else {
        console.log('❌ Failed to create project via API:', apiResponse.error)
      }
      
    } else {
      console.log('❌ Sync machine not in live_sync state:', syncState.syncMachineState)
      console.log('Cannot test table notifications without active sync')
    }
    
    // Keep the browser open to observe any late notifications
    console.log('📺 Keeping browser open for observation...')
    await page.waitForTimeout(15000)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

testTableNotifications()