/**
 * Debug Sync Progression - Check why sync isn't progressing
 */

import { test, expect } from '../fixtures/persistent-context.js'

test.describe('Debug Sync Progression', () => {
  
  test('Debug why sync machine isnt progressing', async ({ page }) => {
    console.log('🔍 Debugging sync machine progression...')
    
    await page.goto('/')
    await page.waitForTimeout(3000)
    
    console.log('📋 Step 1: Check initial sync state')
    const initialState = await page.evaluate(() => {
      const syncActor = window.pureLiveStoreSyncMachineActor
      if (!syncActor) return { error: 'No sync actor' }
      
      const snapshot = syncActor.getSnapshot()
      return {
        state: snapshot.value,
        context: {
          organizationId: snapshot.context.organizationId,
          userId: snapshot.context.userId,
          isConnected: snapshot.context.isConnected,
          error: snapshot.context.error,
          serviceCoordinator: !!snapshot.context.serviceCoordinator
        }
      }
    })
    
    console.log('📊 Initial state:', JSON.stringify(initialState, null, 2))
    
    console.log('📋 Step 2: Send CONNECT and observe immediate response')
    const connectResult = await page.evaluate(() => {
      const syncActor = window.pureLiveStoreSyncMachineActor
      if (!syncActor) return { error: 'No sync actor' }
      
      console.log('🔧 Sending CONNECT event...')
      syncActor.send({
        type: 'CONNECT',
        organizationId: '01920000-1000-7000-8000-000000000001',
        userId: 'debug-user'
      })
      
      // Check immediate state change
      const newSnapshot = syncActor.getSnapshot()
      return {
        success: true,
        newState: newSnapshot.value,
        newContext: {
          organizationId: newSnapshot.context.organizationId,
          userId: newSnapshot.context.userId,
          error: newSnapshot.context.error
        }
      }
    })
    
    console.log('📊 Connect result:', JSON.stringify(connectResult, null, 2))
    
    console.log('📋 Step 3: Wait 5 seconds and check progress')
    await page.waitForTimeout(5000)
    
    const progressState = await page.evaluate(() => {
      const syncActor = window.pureLiveStoreSyncMachineActor
      if (!syncActor) return { error: 'No sync actor' }
      
      const snapshot = syncActor.getSnapshot()
      return {
        state: snapshot.value,
        context: {
          organizationId: snapshot.context.organizationId,
          userId: snapshot.context.userId,
          isConnected: snapshot.context.isConnected,
          error: snapshot.context.error,
          serviceCoordinator: !!snapshot.context.serviceCoordinator,
          serverUrl: snapshot.context.serverUrl
        }
      }
    })
    
    console.log('📊 Progress state after 5s:', JSON.stringify(progressState, null, 2))
    
    console.log('📋 Step 4: Check if services are available')
    const servicesCheck = await page.evaluate(() => {
      // Check what services/functions are available
      return {
        hasWebSocketService: typeof window.WebSocketService,
        hasLiveStoreSync: typeof window.LiveStoreSync, 
        hasGlobalServices: typeof window.getGlobalPureLiveStoreServices,
        globalServicesResult: window.getGlobalPureLiveStoreServices ? window.getGlobalPureLiveStoreServices() : null
      }
    })
    
    console.log('📊 Services check:', JSON.stringify(servicesCheck, null, 2))
    
    console.log('📋 Step 5: Check browser console for errors')
    const consoleErrors = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
        console.log(`[BROWSER ERROR]: ${msg.text()}`)
      }
    })
    
    // Wait a bit more to catch any async errors
    await page.waitForTimeout(3000)
    
    const finalState = await page.evaluate(() => {
      const syncActor = window.pureLiveStoreSyncMachineActor
      if (!syncActor) return { error: 'No sync actor' }
      
      const snapshot = syncActor.getSnapshot()
      return {
        state: snapshot.value,
        context: {
          organizationId: snapshot.context.organizationId,
          error: snapshot.context.error,
          isConnected: snapshot.context.isConnected
        }
      }
    })
    
    console.log('📊 Final state:', JSON.stringify(finalState, null, 2))
    console.log(`📊 Console errors captured: ${consoleErrors.length}`)
    
    if (consoleErrors.length > 0) {
      console.log('❌ Browser console errors:')
      consoleErrors.forEach((error, i) => console.log(`  ${i+1}. ${error}`))
    }
    
    console.log('')
    console.log('🔍 SYNC PROGRESSION ANALYSIS:')
    console.log(`   Initial state: ${initialState.state}`)
    console.log(`   After CONNECT: ${connectResult.newState}`)
    console.log(`   After 5 seconds: ${progressState.state}`)
    console.log(`   Final state: ${finalState.state}`)
    console.log(`   Has error: ${!!finalState.context.error}`)
    if (finalState.context.error) {
      console.log(`   Error message: ${finalState.context.error}`)
    }
    console.log(`   Organization set: ${!!finalState.context.organizationId}`)
    console.log(`   Connected: ${finalState.context.isConnected}`)
    
    // Determine likely issue
    if (finalState.state === 'initializing_services') {
      console.log('')
      console.log('🔍 DIAGNOSIS: Stuck in initializing_services state')
      console.log('   This suggests an issue with service initialization')
      console.log('   Possible causes:')
      console.log('   - WebSocket service not starting')
      console.log('   - LiveStore service not initializing')
      console.log('   - Network connectivity issues')
      console.log('   - Missing service dependencies')
    } else if (finalState.state === 'error') {
      console.log('')
      console.log('🔍 DIAGNOSIS: Sync machine in error state')
      console.log(`   Error: ${finalState.context.error}`)
    } else if (finalState.state === 'idle') {
      console.log('')
      console.log('🔍 DIAGNOSIS: Still in idle state after CONNECT')
      console.log('   This suggests CONNECT event was not processed correctly')
    }
  })
  
})