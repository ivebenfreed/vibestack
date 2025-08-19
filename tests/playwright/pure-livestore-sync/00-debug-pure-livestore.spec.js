/**
 * Debug Pure LiveStore Integration
 * 
 * Simple debug test to identify what's wrong with the pure LiveStore system
 */

import { test, expect } from '../fixtures/persistent-context.js'

test.describe('Debug Pure LiveStore System', () => {
  
  test('Debug - Check what exists in browser', async ({ page }) => {
    console.log('🔍 Debugging what exists in the browser...')
    
    await page.goto('/')
    await page.waitForTimeout(3000)
    
    // Check what's available in the browser
    const debugInfo = await page.evaluate(() => {
      return {
        // Check if new pure LiveStore files are loaded
        pureLiveStoreSyncMachine: typeof window.pureLiveStoreSyncMachineActor,
        oldSyncMachine: typeof window.syncMachineActor,
        
        // Check LiveStore functions
        getLiveStoreClient: typeof window.getLiveStoreClient,
        getOrgSchema: typeof window.getOrgSchema,
        testPureLiveStoreSystem: typeof window.testPureLiveStoreSystem,
        
        // Check for auth
        authActor: typeof window.authMachineActor,
        appInitActor: typeof window.appInitActor,
        
        // Check what modules are available
        modules: {
          livestoreHooks: typeof window.import ? 'importable' : 'not available',
          livestoreEventGenerator: typeof window.import ? 'importable' : 'not available'
        },
        
        // Check current URL and state
        currentUrl: window.location.href,
        localStorage: Object.keys(localStorage),
        
        // Check if we're signed in
        userVisible: document.querySelector('[data-testid="user-menu"]') ? 'yes' : 'no'
      }
    })
    
    console.log('🔍 Debug Info:', JSON.stringify(debugInfo, null, 2))
    
    // Check if the sign-in page has the right elements
    if (debugInfo.userVisible === 'no') {
      console.log('🔍 Checking sign-in page elements...')
      
      await page.goto('/sign-in')
      await page.waitForTimeout(2000)
      
      const signInElements = await page.evaluate(() => {
        return {
          emailInput: document.querySelector('input[type="email"]') ? 'found' : 'not found',
          passwordInput: document.querySelector('input[type="password"]') ? 'found' : 'not found',
          submitButton: document.querySelector('button[type="submit"]') ? 'found' : 'not found',
          allInputs: Array.from(document.querySelectorAll('input')).map(input => ({
            type: input.type,
            placeholder: input.placeholder,
            name: input.name
          })),
          allButtons: Array.from(document.querySelectorAll('button')).map(button => ({
            type: button.type,
            textContent: button.textContent
          }))
        }
      })
      
      console.log('🔍 Sign-in elements:', JSON.stringify(signInElements, null, 2))
    }
    
    // Test if we can import our new modules
    console.log('🔍 Testing module imports...')
    
    const moduleTest = await page.evaluate(async () => {
      try {
        // Try to import our pure LiveStore hooks
        const hooksModule = await import('/src/lib/livestore-hooks.js')
        const eventGenModule = await import('/src/lib/livestore-event-generator.js')
        const syncModule = await import('/src/lib/livestore-native-sync.js')
        
        return {
          success: true,
          hooks: typeof hooksModule.useLiveStoreQuery,
          eventGen: typeof eventGenModule.liveStoreEventGenerator,
          sync: typeof syncModule.createLiveStoreNativeSync
        }
      } catch (error) {
        return {
          success: false,
          error: error.message,
          stack: error.stack
        }
      }
    })
    
    console.log('🔍 Module test result:', JSON.stringify(moduleTest, null, 2))
    
    // Check if the pure LiveStore sync machine exists
    const syncMachineCheck = await page.evaluate(() => {
      try {
        if (window.pureLiveStoreSyncMachineActor) {
          const snapshot = window.pureLiveStoreSyncMachineActor.getSnapshot()
          return {
            exists: true,
            state: snapshot.value,
            context: {
              organizationId: snapshot.context.organizationId,
              clientId: snapshot.context.clientId,
              isConnected: snapshot.context.isConnected
            }
          }
        } else {
          return { exists: false }
        }
      } catch (error) {
        return { exists: false, error: error.message }
      }
    })
    
    console.log('🔍 Sync machine check:', JSON.stringify(syncMachineCheck, null, 2))
    
    // Check console errors
    const consoleErrors = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })
    
    await page.waitForTimeout(2000)
    
    if (consoleErrors.length > 0) {
      console.log('🚨 Console errors found:', consoleErrors)
    }
    
    console.log('🔍 Debug complete - check logs above for issues')
  })
  
})