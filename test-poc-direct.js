/**
 * Test WebSocket POC page directly using persistent context
 */
const { chromium } = require('@playwright/test')

async function testPOCDirect() {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({ userDataDir: './.playwright/profiles/profile-main' })
  const page = await context.newPage()

  // Listen for WebSocket notifications
  page.on('console', msg => {
    const text = msg.text()
    if (text.includes('Table change') || text.includes('srv_table_change_notification') || text.includes('Legend State') || text.includes('📢')) {
      console.log(`[BROWSER] ${text}`)
    }
  })

  try {
    console.log('🚀 Going directly to WebSocket POC page...')
    await page.goto('http://localhost:5173/debug/legend-state-websocket-poc')
    
    console.log('⏳ Waiting for page to load...')
    await page.waitForTimeout(5000)
    
    console.log('🎯 Creating a project to test notifications...')
    await page.click('button:has-text("Create Sample Project")')
    
    console.log('⏳ Waiting for table change notification...')
    await page.waitForTimeout(5000)
    
    console.log('✅ Test complete - check browser logs above for notifications!')
    console.log('📺 Keeping browser open...')
    await page.waitForTimeout(10000)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

testPOCDirect()