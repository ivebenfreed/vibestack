/**
 * Test LiveStore Schema Client - Debug schema initialization
 */

import { test, expect } from '../fixtures/persistent-context.js'

test.describe('Test LiveStore Schema Client', () => {
  
  test('Debug LiveStore schema client initialization', async ({ page }) => {
    console.log('🔍 Testing LiveStore schema client directly...')
    
    await page.goto('/')
    await page.waitForTimeout(3000)
    
    console.log('📋 Step 1: Test schema client loading')
    const schemaTest = await page.evaluate(async () => {
      try {
        // Try to import the schema client
        const { liveStoreSchemaClient } = await import('/src/lib/livestore-schema-client.js')
        
        return {
          success: true,
          hasSchemaClient: !!liveStoreSchemaClient,
          methods: Object.getOwnPropertyNames(Object.getPrototypeOf(liveStoreSchemaClient))
        }
      } catch (error) {
        return {
          success: false,
          error: error.message,
          stack: error.stack
        }
      }
    })
    
    console.log('📊 Schema client test:', JSON.stringify(schemaTest, null, 2))
    
    if (!schemaTest.success) {
      console.log('❌ Cannot import schema client')
      return
    }
    
    console.log('📋 Step 2: Test schema loading for Wide Corp')
    const schemaLoadTest = await page.evaluate(async () => {
      try {
        const { liveStoreSchemaClient } = await import('/src/lib/livestore-schema-client.js')
        
        console.log('🧪 Loading schema for Wide Corp org...')
        const result = await liveStoreSchemaClient.loadLiveStoreSchema('01920000-1000-7000-8000-000000000001')
        
        return {
          success: true,
          result: result
        }
      } catch (error) {
        return {
          success: false,
          error: error.message,
          stack: error.stack
        }
      }
    })
    
    console.log('📊 Schema load test:', JSON.stringify(schemaLoadTest, null, 2))
    
    if (schemaLoadTest.success && schemaLoadTest.result.success) {
      console.log('✅ Schema loading works!')
      
      console.log('📋 Step 3: Test LiveStore initialization')
      const liveStoreInitTest = await page.evaluate(async () => {
        try {
          const { liveStoreSchemaClient } = await import('/src/lib/livestore-schema-client.js')
          
          console.log('🧪 Initializing LiveStore for Wide Corp...')
          const liveStore = await liveStoreSchemaClient.initializeLiveStore(
            '01920000-1000-7000-8000-000000000001',
            'test-client-debug'
          )
          
          if (!liveStore) {
            return {
              success: false,
              error: 'initializeLiveStore returned null'
            }
          }
          
          console.log('🧪 Waiting for LiveStore to be ready...')
          await liveStore.ready()
          
          console.log('🧪 Testing basic query...')
          const tables = await liveStore.query("SELECT name FROM sqlite_master WHERE type='table'")
          
          return {
            success: true,
            tablesCount: tables.length,
            hasLiveStore: true,
            sampleTables: tables.slice(0, 5).map(t => t.name)
          }
          
        } catch (error) {
          return {
            success: false,
            error: error.message,
            stack: error.stack
          }
        }
      })
      
      console.log('📊 LiveStore init test:', JSON.stringify(liveStoreInitTest, null, 2))
      
      if (liveStoreInitTest.success) {
        console.log('🎉 SUCCESS: LiveStore initialization working!')
        console.log(`   📊 Found ${liveStoreInitTest.tablesCount} tables`)
        console.log(`   📋 Sample tables: ${liveStoreInitTest.sampleTables.join(', ')}`)
        
        // Test if this matches what window.LiveStore should be
        const globalLiveStoreTest = await page.evaluate(() => {
          return {
            hasGlobalLiveStore: !!window.LiveStore,
            globalLiveStoreType: typeof window.LiveStore
          }
        })
        
        console.log('📊 Global LiveStore comparison:', JSON.stringify(globalLiveStoreTest, null, 2))
        
        if (!globalLiveStoreTest.hasGlobalLiveStore) {
          console.log('🔍 LiveStore init works manually but window.LiveStore not set')
          console.log('   This explains why sync machine initialization fails')
          console.log('   The issue is in the integration between schema client and global LiveStore')
        }
        
      } else {
        console.log('❌ LiveStore initialization failed:', liveStoreInitTest.error)
      }
      
    } else {
      console.log('❌ Schema loading failed')
      if (schemaLoadTest.result?.error) {
        console.log(`   Error: ${schemaLoadTest.result.error}`)
      }
    }
    
    console.log('📋 Step 4: Summary')
    console.log('')
    console.log('🔍 LIVESTORE SCHEMA CLIENT ANALYSIS:')
    console.log(`   ✅ Schema client import: ${schemaTest.success ? 'WORKING' : 'FAILED'}`)
    console.log(`   ✅ Schema loading: ${schemaLoadTest.success && schemaLoadTest.result?.success ? 'WORKING' : 'FAILED'}`)
    
    if (typeof liveStoreInitTest !== 'undefined') {
      console.log(`   ✅ LiveStore initialization: ${liveStoreInitTest.success ? 'WORKING' : 'FAILED'}`)
      if (liveStoreInitTest.success) {
        console.log(`   📊 Database tables: ${liveStoreInitTest.tablesCount}`)
      }
    }
    
    console.log('')
    console.log('🎯 PURE LIVESTORE SYSTEM DIAGNOSIS:')
    if (schemaTest.success && schemaLoadTest.success && (typeof liveStoreInitTest === 'undefined' || liveStoreInitTest.success)) {
      console.log('   ✅ Core LiveStore functionality: WORKING')
      console.log('   ✅ Schema loading: WORKING')
      console.log('   ❓ Issue likely in sync machine service integration')
    } else {
      console.log('   ❌ Core LiveStore issue found')
    }
  })
  
})