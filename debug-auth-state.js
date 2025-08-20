/**
 * Debug auth state specifically
 */
const { chromium } = require('@playwright/test')

async function debugAuth() {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({ userDataDir: './.playwright/profiles/profile-main' })
  const page = await context.newPage()

  // Listen to console logs
  page.on('console', msg => {
    if (msg.text().includes('Auth') || msg.text().includes('session') || msg.text().includes('user')) {
      console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`)
    }
  })

  console.log('Navigating to check auth state...')
  
  try {
    // Navigate to the dashboard
    await page.goto('http://localhost:5173/')
    await page.waitForTimeout(3000)
    
    // Check session via API
    const sessionResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/auth/get-session', {
          credentials: 'include'
        })
        const data = await response.json()
        return { status: response.status, data }
      } catch (error) {
        return { error: error.message }
      }
    })
    
    console.log('Session API response:', sessionResponse)
    
    // Check auth machine state
    const authState = await page.evaluate(() => {
      if (window.authMachineActor) {
        const snapshot = window.authMachineActor.getSnapshot()
        return {
          state: snapshot.value,
          context: {
            user: snapshot.context.user,
            authToken: snapshot.context.authToken,
            authError: snapshot.context.authError
          }
        }
      }
      return 'Auth machine not found'
    })
    
    console.log('Auth machine state:', authState)
    
    // Wait and check again
    await page.waitForTimeout(5000)
    
    const authState2 = await page.evaluate(() => {
      if (window.authMachineActor) {
        const snapshot = window.authMachineActor.getSnapshot()
        return {
          state: snapshot.value,
          context: {
            user: snapshot.context.user,
            authToken: snapshot.context.authToken,
            authError: snapshot.context.authError
          }
        }
      }
      return 'Auth machine not found'
    })
    
    console.log('Auth machine state after 5s:', authState2)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

debugAuth()