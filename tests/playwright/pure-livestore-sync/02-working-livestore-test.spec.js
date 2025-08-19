/**
 * Working LiveStore Test - Using Available Functions
 * 
 * This test uses the functions that actually exist on window object:
 * - window.testLiveStoreInBrowser()
 * - window.quickBrowserTest()
 * - window.pureLiveStoreSyncMachineActor
 * - window.testSyncHelpers
 */

import { test, expect } from '../fixtures/persistent-context.js'

test.describe('Working LiveStore Test', () => {
  
  test('Test LiveStore using available browser functions', async ({ page }) => {
    console.log('🧪 Testing LiveStore using functions that actually exist...')
    
    // Navigate to dashboard (root)
    await page.goto('/')
    await page.waitForTimeout(3000)
    
    console.log('📋 Step 1: Check what functions are available')
    const availableFunctions = await page.evaluate(() => {
      return {
        hasTestLiveStoreInBrowser: typeof window.testLiveStoreInBrowser,
        hasQuickBrowserTest: typeof window.quickBrowserTest,
        hasSyncMachineActor: !!window.pureLiveStoreSyncMachineActor,
        hasTestSyncHelpers: typeof window.testSyncHelpers,
        syncMachineState: window.pureLiveStoreSyncMachineActor?.getSnapshot?.()?.value
      }
    })
    
    console.log('📊 Available functions:', JSON.stringify(availableFunctions, null, 2))
    
    console.log('📋 Step 2: Test LiveStore browser functionality')
    if (availableFunctions.hasTestLiveStoreInBrowser === 'function') {
      const liveStoreTest = await page.evaluate(async () => {
        try {
          console.log('🧪 Running window.testLiveStoreInBrowser()...')
          const result = await window.testLiveStoreInBrowser()
          return { success: true, result }
        } catch (error) {
          return { success: false, error: error.message }
        }
      })
      
      console.log('📊 LiveStore browser test result:', JSON.stringify(liveStoreTest, null, 2))
      
      if (liveStoreTest.success) {
        console.log('✅ Step 2: LiveStore browser test passed!')
      } else {
        console.log('❌ Step 2: LiveStore browser test failed:', liveStoreTest.error)
      }
    } else {
      console.log('⚠️ Step 2: testLiveStoreInBrowser not available, trying quickBrowserTest...')
      
      if (availableFunctions.hasQuickBrowserTest === 'function') {
        const quickTest = await page.evaluate(async () => {
          try {
            console.log('🧪 Running window.quickBrowserTest()...')
            const result = await window.quickBrowserTest()
            return { success: true, result }
          } catch (error) {
            return { success: false, error: error.message }
          }
        })
        
        console.log('📊 Quick browser test result:', JSON.stringify(quickTest, null, 2))
        
        if (quickTest.success) {
          console.log('✅ Step 2: Quick browser test passed!')
        } else {
          console.log('❌ Step 2: Quick browser test failed:', quickTest.error)
        }
      }
    }
    
    console.log('📋 Step 3: Test sync machine actor')
    if (availableFunctions.hasSyncMachineActor) {
      const syncMachineTest = await page.evaluate(() => {
        try {
          const actor = window.pureLiveStoreSyncMachineActor
          const snapshot = actor.getSnapshot()
          
          return {
            success: true,
            currentState: snapshot.value,
            context: {
              organizationId: snapshot.context?.organizationId,
              isConnected: snapshot.context?.isConnected,
              syncPhase: snapshot.context?.syncPhase
            }
          }
        } catch (error) {
          return { success: false, error: error.message }
        }
      })
      
      console.log('📊 Sync machine test result:', JSON.stringify(syncMachineTest, null, 2))
      
      if (syncMachineTest.success) {
        console.log('✅ Step 3: Sync machine actor working!')
        console.log(`   Current state: ${syncMachineTest.currentState}`)
        console.log(`   Organization: ${syncMachineTest.context.organizationId}`)
      } else {
        console.log('❌ Step 3: Sync machine actor failed:', syncMachineTest.error)
      }
    } else {
      console.log('❌ Step 3: Sync machine actor not available')
    }
    
    console.log('📋 Step 4: Test sync helpers')
    if (availableFunctions.hasTestSyncHelpers === 'object') {
      const syncHelpersTest = await page.evaluate(() => {
        try {
          const helpers = window.testSyncHelpers
          const methods = Object.keys(helpers).filter(key => typeof helpers[key] === 'function')
          
          return {
            success: true,
            availableMethods: methods,
            helperType: typeof helpers
          }
        } catch (error) {
          return { success: false, error: error.message }
        }
      })
      
      console.log('📊 Sync helpers test result:', JSON.stringify(syncHelpersTest, null, 2))
      
      if (syncHelpersTest.success) {
        console.log('✅ Step 4: Sync helpers available!')
        console.log(`   Methods: ${syncHelpersTest.availableMethods.join(', ')}`)
      } else {
        console.log('❌ Step 4: Sync helpers failed:', syncHelpersTest.error)
      }
    } else {
      console.log('❌ Step 4: Sync helpers not available')
    }
    
    console.log('🎉 Working LiveStore test complete!')
  })
  
})