/**
 * Test Auth and Sync Initialization - Debug why CONNECT event isn't sent
 */

import { test, expect } from '../fixtures/persistent-context.js'

test.describe('Test Auth and Sync Initialization', () => {
  
  test('Debug auth state and sync machine initialization', async ({ page }) => {
    console.log('🔍 Testing auth state and sync machine initialization...')
    
    await page.goto('/')
    await page.waitForTimeout(3000)
    
    console.log('📋 Step 1: Check current auth state')
    const authState = await page.evaluate(() => {
      const authActor = window.authMachineActor
      if (!authActor) return { error: 'No auth actor' }
      
      const snapshot = authActor.getSnapshot()
      return {
        state: snapshot.value,
        isAuthenticated: snapshot.matches('authenticated'),
        context: {
          hasUser: !!snapshot.context.user,
          userId: snapshot.context.user?.id,
          hasCurrentOrg: !!snapshot.context.currentOrganization,
          orgId: snapshot.context.currentOrganization?.id
        }
      }
    })
    
    console.log('📊 Auth State:', JSON.stringify(authState, null, 2))
    
    console.log('📋 Step 2: Check sync machine state after auth')
    const syncState = await page.evaluate(() => {
      const syncActor = window.pureLiveStoreSyncMachineActor
      if (!syncActor) return { error: 'No sync actor' }
      
      const snapshot = syncActor.getSnapshot()
      return {
        state: snapshot.value,
        context: {
          organizationId: snapshot.context.organizationId,
          userId: snapshot.context.userId,
          isConnected: snapshot.context.isConnected,
          clientId: snapshot.context.clientId
        }
      }
    })
    
    console.log('📊 Sync State:', JSON.stringify(syncState, null, 2))
    
    if (!authState.isAuthenticated) {
      console.log('🔐 User not authenticated, attempting login...')
      
      await page.goto('/sign-in')
      await page.waitForTimeout(2000)
      
      // Check if sign-in form is available
      const hasSignInForm = await page.locator('input[type="email"]').isVisible().catch(() => false)
      
      if (hasSignInForm) {
        console.log('🔐 Signing in with Wide Corp CEO...')
        await page.fill('input[type="email"]', 'ceo@widecorp.com')
        await page.fill('input[type="password"]', 'WideCorp2024!CEO')
        await page.click('button[type="submit"]')
        
        // Wait for auth to complete
        await page.waitForTimeout(5000)
        
        // Check auth state after login
        const postLoginAuthState = await page.evaluate(() => {
          const authActor = window.authMachineActor
          if (!authActor) return { error: 'No auth actor' }
          
          const snapshot = authActor.getSnapshot()
          return {
            state: snapshot.value,
            isAuthenticated: snapshot.matches('authenticated'),
            context: {
              hasUser: !!snapshot.context.user,
              userId: snapshot.context.user?.id,
              hasCurrentOrg: !!snapshot.context.currentOrganization,
              orgId: snapshot.context.currentOrganization?.id
            }
          }
        })
        
        console.log('📊 Post-Login Auth State:', JSON.stringify(postLoginAuthState, null, 2))
        
        // Check sync state after login
        const postLoginSyncState = await page.evaluate(() => {
          const syncActor = window.pureLiveStoreSyncMachineActor
          if (!syncActor) return { error: 'No sync actor' }
          
          const snapshot = syncActor.getSnapshot()
          return {
            state: snapshot.value,
            context: {
              organizationId: snapshot.context.organizationId,
              userId: snapshot.context.userId,
              isConnected: snapshot.context.isConnected
            }
          }
        })
        
        console.log('📊 Post-Login Sync State:', JSON.stringify(postLoginSyncState, null, 2))
        
        if (postLoginSyncState.context.organizationId) {
          console.log('🎉 Organization ID successfully passed to sync machine!')
        } else {
          console.log('❌ Organization ID still not passed to sync machine')
          
          // Try manually sending CONNECT event for testing
          console.log('🔧 Manually sending CONNECT event...')
          const manualConnectResult = await page.evaluate(() => {
            const syncActor = window.pureLiveStoreSyncMachineActor
            const authActor = window.authMachineActor
            
            if (!syncActor || !authActor) {
              return { error: 'Missing actors' }
            }
            
            const authSnapshot = authActor.getSnapshot()
            const orgId = authSnapshot.context.currentOrganization?.id || '01920000-1000-7000-8000-000000000001'
            const userId = authSnapshot.context.user?.id || 'test-user'
            
            console.log('Manual CONNECT with:', { orgId, userId })
            
            syncActor.send({
              type: 'CONNECT',
              organizationId: orgId,
              userId: userId
            })
            
            // Wait a moment and check state
            return new Promise((resolve) => {
              setTimeout(() => {
                const newSnapshot = syncActor.getSnapshot()
                resolve({
                  success: true,
                  newState: newSnapshot.value,
                  newContext: {
                    organizationId: newSnapshot.context.organizationId,
                    userId: newSnapshot.context.userId
                  }
                })
              }, 1000)
            })
          })
          
          console.log('📊 Manual Connect Result:', JSON.stringify(manualConnectResult, null, 2))
        }
        
      } else {
        console.log('✅ Already signed in (no sign-in form visible)')
      }
    } else {
      console.log('✅ User already authenticated')
      
      // If authenticated but sync machine doesn't have org ID, try manual connect
      if (!syncState.context.organizationId) {
        console.log('🔧 Authenticated but sync machine missing org ID, trying manual CONNECT...')
        
        const manualConnectResult = await page.evaluate(() => {
          const syncActor = window.pureLiveStoreSyncMachineActor
          const authActor = window.authMachineActor
          
          if (!syncActor || !authActor) {
            return { error: 'Missing actors' }
          }
          
          const authSnapshot = authActor.getSnapshot()
          const orgId = authSnapshot.context.currentOrganization?.id || '01920000-1000-7000-8000-000000000001'
          const userId = authSnapshot.context.user?.id || 'test-user'
          
          console.log('Manual CONNECT with:', { orgId, userId })
          
          syncActor.send({
            type: 'CONNECT',
            organizationId: orgId,
            userId: userId
          })
          
          return {
            success: true,
            sentEvent: { orgId, userId }
          }
        })
        
        console.log('📊 Manual Connect Result:', JSON.stringify(manualConnectResult, null, 2))
        
        // Wait and check final state
        await page.waitForTimeout(2000)
        
        const finalSyncState = await page.evaluate(() => {
          const syncActor = window.pureLiveStoreSyncMachineActor
          const snapshot = syncActor.getSnapshot()
          return {
            state: snapshot.value,
            organizationId: snapshot.context.organizationId,
            userId: snapshot.context.userId
          }
        })
        
        console.log('📊 Final Sync State:', JSON.stringify(finalSyncState, null, 2))
      }
    }
    
    console.log('🔍 Auth and sync initialization test complete!')
  })
  
})