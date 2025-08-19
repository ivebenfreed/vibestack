/**
 * Debug LiveStore Initialization - Why isn't window.LiveStore available?
 */

import { test, expect } from '../fixtures/persistent-context.js'

test.describe('Debug LiveStore Initialization', () => {
  
  test('Debug why LiveStore client is not initializing after auth', async ({ page }) => {
    console.log('🔍 Going to home page...')
    await page.goto('/')
    
    // Check auth state first
    console.log('🔐 Checking authentication state...')
    const authState = await page.evaluate(() => {
      return {
        isOnSignInPage: window.location.pathname.includes('sign-in'),
        isOnRootDashboard: window.location.pathname === '/',
        pathname: window.location.pathname,
        authActor: !!window.authMachineActor,
        syncActor: !!window.pureLiveStoreSyncMachineActor,
        hasAuthSession: !!localStorage.getItem('auth_session')
      }
    })
    
    console.log('📊 Auth State:', JSON.stringify(authState, null, 2))
    
    if (authState.isOnSignInPage) {
      console.log('❌ User not authenticated - on sign-in page')
      console.log('🔐 This explains why LiveStore is not initialized')
      return
    }
    
    if (authState.isOnRootDashboard) {
      console.log('✅ User is on dashboard (root path)')
      
      // Wait for LiveStore to potentially initialize
      console.log('⏳ Waiting for LiveStore initialization...')
      await page.waitForTimeout(5000)
      
      // Check if LiveStore becomes available
      const liveStoreCheck = await page.evaluate(() => {
        return {
          hasLiveStore: !!window.LiveStore,
          liveStoreType: typeof window.LiveStore,
          liveStoreReady: window.LiveStore ? (typeof window.LiveStore.ready === 'function') : false
        }
      })
      
      console.log('📊 LiveStore Check:', JSON.stringify(liveStoreCheck, null, 2))
      
      if (!liveStoreCheck.hasLiveStore) {
        console.log('❌ LiveStore still not available after 5 seconds')
        
        // Check for any initialization errors in console
        console.log('🔍 Checking for LiveStore initialization errors...')
        
        // Try to manually trigger initialization
        console.log('🔧 Attempting manual LiveStore initialization...')
        const initResult = await page.evaluate(async () => {
          try {
            // Check if we can manually load the schema client
            const { liveStoreSchemaClient } = await import('/src/lib/livestore-schema-client.js')
            
            // Try to get auth info
            const authData = localStorage.getItem('auth_session')
            if (!authData) {
              return { success: false, error: 'No auth session in localStorage' }
            }
            
            const session = JSON.parse(authData)
            const organizationId = session.organization?.id
            const userId = session.user?.id
            
            if (!organizationId) {
              return { success: false, error: 'No organization ID in session', session }
            }
            
            console.log('🔧 Manual init - Org ID:', organizationId, 'User ID:', userId)
            
            // Try to load schema
            const schemaResult = await liveStoreSchemaClient.loadLiveStoreSchema(organizationId)
            return {
              success: true,
              organizationId,
              userId,
              schemaSuccess: schemaResult.success,
              schemaError: schemaResult.error
            }
            
          } catch (error) {
            return {
              success: false,
              error: error.message,
              stack: error.stack
            }
          }
        })
        
        console.log('🔧 Manual Init Result:', JSON.stringify(initResult, null, 2))
        
      } else {
        console.log('✅ LiveStore is available!')
        
        // Test basic functionality
        if (liveStoreCheck.liveStoreReady) {
          const basicTest = await page.evaluate(async () => {
            try {
              await window.LiveStore.ready()
              const tables = await window.LiveStore.query(
                "SELECT name FROM sqlite_master WHERE type='table'"
              )
              return {
                success: true,
                tablesCount: tables.length,
                sampleTables: tables.slice(0, 3)
              }
            } catch (error) {
              return {
                success: false,
                error: error.message
              }
            }
          })
          
          console.log('🧪 Basic LiveStore Test:', JSON.stringify(basicTest, null, 2))
        }
      }
    }
    
    console.log('🔍 LiveStore initialization debug complete')
  })
  
})