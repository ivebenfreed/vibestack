/**
 * Check Window Functions - Debug what LiveStore functions are available
 */

import { test, expect } from '../fixtures/persistent-context.js'

test.describe('Check Window Functions', () => {
  
  test('Check what LiveStore functions are available on window', async ({ page }) => {
    console.log('🔍 Going to home page...')
    await page.goto('/')
    
    // Wait for app to load
    await page.waitForTimeout(5000)
    
    console.log('🔍 Checking window object for LiveStore functions...')
    
    const windowFunctions = await page.evaluate(() => {
      const functions = {}
      
      // Check for LiveStore client
      functions.hasLiveStore = !!window.LiveStore
      functions.liveStoreType = typeof window.LiveStore
      
      // Check for test functions
      functions.hasTestLiveStoreInBrowser = typeof window.testLiveStoreInBrowser
      functions.hasTestLiveStoreNativeSystem = typeof window.testLiveStoreNativeSystem
      functions.hasQuickBrowserTest = typeof window.quickBrowserTest
      functions.hasGetLiveStoreClient = typeof window.getLiveStoreClient
      
      // Check for other LiveStore-related functions
      const liveStoreFunctions = []
      for (const key in window) {
        if (key.toLowerCase().includes('livestore') || key.toLowerCase().includes('test')) {
          liveStoreFunctions.push({
            name: key,
            type: typeof window[key]
          })
        }
      }
      functions.allLiveStoreFunctions = liveStoreFunctions
      
      // Check console for any recent messages
      return functions
    })
    
    console.log('📊 Window Functions Analysis:')
    console.log('  LiveStore client:', windowFunctions.hasLiveStore ? '✅ Available' : '❌ Missing')
    console.log('  Type:', windowFunctions.liveStoreType)
    console.log('  testLiveStoreInBrowser:', windowFunctions.hasTestLiveStoreInBrowser)
    console.log('  testLiveStoreNativeSystem:', windowFunctions.hasTestLiveStoreNativeSystem)
    console.log('  quickBrowserTest:', windowFunctions.hasQuickBrowserTest)
    console.log('  getLiveStoreClient:', windowFunctions.hasGetLiveStoreClient)
    
    if (windowFunctions.allLiveStoreFunctions.length > 0) {
      console.log('🔍 All LiveStore/Test functions found:')
      windowFunctions.allLiveStoreFunctions.forEach(fn => {
        console.log(`  - ${fn.name} (${fn.type})`)
      })
    } else {
      console.log('❌ No LiveStore/Test functions found on window')
    }
    
    // Try to see if we can manually call the LiveStore client
    if (windowFunctions.hasLiveStore) {
      console.log('🧪 Testing LiveStore client functionality...')
      
      const liveStoreTest = await page.evaluate(async () => {
        try {
          if (window.LiveStore && window.LiveStore.query) {
            const tables = await window.LiveStore.query(
              "SELECT name FROM sqlite_master WHERE type='table'"
            )
            return {
              success: true,
              tablesCount: tables.length,
              tables: tables.slice(0, 3) // First 3 tables
            }
          } else {
            return {
              success: false,
              error: 'LiveStore.query not available'
            }
          }
        } catch (error) {
          return {
            success: false,
            error: error.message
          }
        }
      })
      
      console.log('📊 LiveStore Test Result:', JSON.stringify(liveStoreTest, null, 2))
    }
    
    console.log('🔍 Window functions analysis complete')
  })
  
})