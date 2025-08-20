/**
 * Trigger table change notification using browser session
 */
const { chromium } = require('@playwright/test')

async function triggerTableNotification() {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({ userDataDir: './.playwright/profiles/profile-main' })
  const page = await context.newPage()

  try {
    console.log('🚀 Using persistent browser context to create project...')
    
    // Just make an API call using the existing session
    const apiResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('http://localhost:8787/api/archetype/orgs/01920000-1000-7000-8000-000000000001/data/Project', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Notification Test Project ${Date.now()}`,
            description: 'Created to test table change notifications',
            status: 'planning',
            project_type: 'development',
            budget: 50000.00
          })
        })
        
        if (!response.ok) {
          throw new Error(`API call failed: ${response.status} - ${await response.text()}`)
        }
        
        const result = await response.json()
        return { success: true, data: result }
        
      } catch (error) {
        return { success: false, error: error.message }
      }
    })
    
    console.log('📊 API Response:', JSON.stringify(apiResponse, null, 2))
    
    if (apiResponse.success) {
      console.log('✅ Project created successfully!')
      console.log('🔍 Check server logs for srv_table_change_notification messages')
      console.log('🎯 Should see notification for client_1755610419715_9fku46 and other connected clients')
    } else {
      console.log('❌ Failed to create project:', apiResponse.error)
    }
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

triggerTableNotification()