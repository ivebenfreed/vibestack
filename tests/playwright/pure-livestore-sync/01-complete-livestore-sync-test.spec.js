/**
 * Complete Pure LiveStore Sync Test with Wide Corp Authentication
 * 
 * This test validates the entire pure LiveStore system end-to-end:
 * 1. Authentication with Wide Corp CEO account
 * 2. Pure LiveStore initialization and sync machine startup
 * 3. Initial sync from server to LiveStore
 * 4. Bidirectional sync testing
 * 5. Data consistency validation
 * 
 * NO WORKAROUNDS ALLOWED - Everything must work with real auth and sync.
 */

import { test, expect } from '../fixtures/persistent-context.js'

// Wide Corp test credentials
const WIDE_CORP_ORG_ID = '01920000-1000-7000-8000-000000000001'
const CEO_EMAIL = 'ceo@widecorp.com'
const CEO_PASSWORD = 'WideCorp2024!CEO'

test.describe('Pure LiveStore Complete Sync System', () => {
  
  test('01 - Complete Auth to Live Sync Flow', async ({ page }) => {
    console.log('🧪 Starting complete pure LiveStore sync test with Wide Corp CEO...')
    
    // Step 1: Navigate and ensure clean state
    await page.goto('/')
    await page.waitForTimeout(2000)
    
    console.log('📋 Step 1: Clean state and navigation complete')
    
    // Step 2: Authenticate with Wide Corp CEO
    console.log('📋 Step 2: Authenticating with Wide Corp CEO...')
    
    // Check if already signed in
    const isSignedIn = await page.locator('[data-testid="user-menu"]').isVisible().catch(() => false)
    
    if (!isSignedIn) {
      // Navigate to sign-in
      await page.goto('/sign-in')
      await page.waitForLoadState('networkidle')
      
      // Fill credentials
      await page.fill('input[type="email"]', CEO_EMAIL)
      await page.fill('input[type="password"]', CEO_PASSWORD)
      
      // Sign in
      await page.click('button[type="submit"]')
      await page.waitForLoadState('networkidle')
      
      // Wait for redirect to dashboard
      await page.waitForURL(/\/dashboard/, { timeout: 30000 })
    }
    
    console.log('✅ Step 2: Wide Corp CEO authenticated successfully')
    
    // Step 3: Wait for pure LiveStore sync machine initialization
    console.log('📋 Step 3: Waiting for pure LiveStore sync machine...')
    
    await page.waitForFunction(() => {
      return window.pureLiveStoreSyncMachineActor && 
             window.pureLiveStoreSyncMachineActor.getSnapshot
    }, { timeout: 30000 })
    
    // Monitor sync machine state progression
    const syncStates = []
    await page.evaluateHandle(() => {
      return new Promise((resolve) => {
        const syncActor = window.pureLiveStoreSyncMachineActor
        if (!syncActor) {
          resolve('No sync actor found')
          return
        }
        
        let stateCount = 0
        const maxStates = 10
        const states = []
        
        const unsubscribe = syncActor.subscribe((snapshot) => {
          states.push({
            state: snapshot.value,
            context: {
              organizationId: snapshot.context.organizationId,
              isConnected: snapshot.context.isConnected,
              syncPhase: snapshot.context.syncPhase,
              currentLSN: snapshot.context.currentLSN
            },
            timestamp: new Date().toISOString()
          })
          
          console.log(`🔄 Pure LiveStore Sync State: ${snapshot.value}`, snapshot.context)
          
          stateCount++
          if (snapshot.value === 'live_sync' || stateCount >= maxStates) {
            unsubscribe()
            window.syncTestStates = states
            resolve(states)
          }
        })
        
        // Trigger sync if not already started
        if (syncActor.getSnapshot().value === 'idle') {
          console.log('🚀 Triggering sync machine connection...')
          syncActor.send({ 
            type: 'CONNECT', 
            organizationId: '${WIDE_CORP_ORG_ID}',
            userId: 'ceo-user-id' 
          })
        }
      })
    })
    
    console.log('✅ Step 3: Pure LiveStore sync machine initialized')
    
    // Step 4: Validate sync reached live_sync state
    console.log('📋 Step 4: Validating sync reached live_sync state...')
    
    const finalSyncState = await page.evaluate(() => {
      const syncActor = window.pureLiveStoreSyncMachineActor
      return syncActor ? syncActor.getSnapshot().value : 'No actor'
    })
    
    expect(finalSyncState).toBe('live_sync')
    console.log('✅ Step 4: Sync machine reached live_sync state')
    
    // Step 5: Validate LiveStore initialization
    console.log('📋 Step 5: Validating LiveStore initialization...')
    
    const liveStoreStatus = await page.evaluate(async () => {
      // Wait for LiveStore to be available
      let retries = 0
      while (retries < 10) {
        try {
          if (window.getLiveStoreClient) {
            const liveStore = await window.getLiveStoreClient('${WIDE_CORP_ORG_ID}')
            if (liveStore && liveStore.store) {
              // Test basic query
              const testQuery = await liveStore.store.query('SELECT 1 as test')
              return {
                available: true,
                canQuery: testQuery.length > 0,
                orgId: '${WIDE_CORP_ORG_ID}'
              }
            }
          }
        } catch (error) {
          console.log('LiveStore not ready yet, retrying...', error.message)
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000))
        retries++
      }
      
      return { available: false, error: 'LiveStore not available after retries' }
    })
    
    expect(liveStoreStatus.available).toBe(true)
    expect(liveStoreStatus.canQuery).toBe(true)
    console.log('✅ Step 5: LiveStore initialized and can execute queries')
    
    // Step 6: Test data loading from server via sync
    console.log('📋 Step 6: Testing data loading via pure LiveStore sync...')
    
    const syncedData = await page.evaluate(async () => {
      const orgId = '${WIDE_CORP_ORG_ID}'
      const liveStore = await window.getLiveStoreClient(orgId)
      
      if (!liveStore) {
        throw new Error('LiveStore not available')
      }
      
      try {
        // Query Wide Corp data that should have synced from server
        const projects = await liveStore.store.query(
          `SELECT * FROM org_01920000_1000_7000_8000_000000000001_projects LIMIT 10`
        )
        
        const tasks = await liveStore.store.query(
          `SELECT * FROM org_01920000_1000_7000_8000_000000000001_tasks LIMIT 10`  
        )
        
        const users = await liveStore.store.query(
          `SELECT * FROM org_01920000_1000_7000_8000_000000000001_users LIMIT 10`
        )
        
        return {
          projects: projects.length,
          tasks: tasks.length,
          users: users.length,
          sampleProject: projects[0] || null,
          sampleTask: tasks[0] || null
        }
      } catch (error) {
        return { error: error.message }
      }
    })
    
    // Validate we have synced data
    expect(syncedData.error).toBeUndefined()
    expect(syncedData.projects).toBeGreaterThan(0)
    console.log(`✅ Step 6: Data synced - Projects: ${syncedData.projects}, Tasks: ${syncedData.tasks}, Users: ${syncedData.users}`)
    
    // Step 7: Test pure LiveStore mutations
    console.log('📋 Step 7: Testing pure LiveStore mutations...')
    
    const mutationResult = await page.evaluate(async () => {
      try {
        // Import LiveStore hooks
        const { liveStoreEventGenerator } = await import('/src/lib/livestore-event-generator.js')
        
        const orgId = '${WIDE_CORP_ORG_ID}'
        const liveStore = await window.getLiveStoreClient(orgId)
        
        if (!liveStore) {
          throw new Error('LiveStore not available for mutations')
        }
        
        // Get organization schema
        const orgSchema = await window.getOrgSchema ? window.getOrgSchema(orgId) : null
        if (!orgSchema) {
          throw new Error('Organization schema not available')
        }
        
        // Create mutations
        const mutations = await liveStoreEventGenerator.createMutations(
          orgId,
          liveStore.store,
          orgSchema
        )
        
        if (!mutations || !mutations.projects) {
          throw new Error('Mutations not generated correctly')
        }
        
        // Create a test project
        const testProject = await mutations.projects.create({
          name: 'Playwright Pure LiveStore Test Project',
          description: 'Testing pure LiveStore mutations from Playwright',
          status: 'active',
          organization_id: orgId
        })
        
        // Create a test task
        const testTask = await mutations.tasks.create({
          title: 'Playwright Test Task',
          description: 'Testing pure LiveStore task creation',
          project_id: testProject.id,
          completed: false,
          organization_id: orgId
        })
        
        return {
          success: true,
          projectId: testProject.id,
          taskId: testTask.id,
          projectName: testProject.name || 'Playwright Pure LiveStore Test Project'
        }
        
      } catch (error) {
        return { 
          success: false, 
          error: error.message,
          stack: error.stack
        }
      }
    })
    
    expect(mutationResult.success).toBe(true)
    expect(mutationResult.projectId).toBeTruthy()
    expect(mutationResult.taskId).toBeTruthy()
    console.log(`✅ Step 7: Pure LiveStore mutations successful - Project: ${mutationResult.projectId}`)
    
    // Step 8: Validate data appears in UI (real-time reactivity)
    console.log('📋 Step 8: Validating real-time UI updates...')
    
    // Navigate to projects page to see if our data appears
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
    
    // Look for our test project in the UI
    const projectVisible = await page.locator('text=Playwright Pure LiveStore Test Project').isVisible({ timeout: 10000 })
    expect(projectVisible).toBe(true)
    
    console.log('✅ Step 8: Test project visible in UI - real-time reactivity working')
    
    // Step 9: Test bidirectional sync by modifying data and checking sync
    console.log('📋 Step 9: Testing bidirectional sync...')
    
    const bidirectionalResult = await page.evaluate(async () => {
      try {
        const orgId = '${WIDE_CORP_ORG_ID}'
        const { liveStoreEventGenerator } = await import('/src/lib/livestore-event-generator.js')
        const liveStore = await window.getLiveStoreClient(orgId)
        const orgSchema = await window.getOrgSchema(orgId)
        
        const mutations = await liveStoreEventGenerator.createMutations(
          orgId,
          liveStore.store,
          orgSchema
        )
        
        // Find our test project
        const projects = await liveStore.store.query(
          `SELECT * FROM org_01920000_1000_7000_8000_000000000001_projects WHERE name = 'Playwright Pure LiveStore Test Project'`
        )
        
        if (projects.length === 0) {
          throw new Error('Test project not found for bidirectional test')
        }
        
        const testProject = projects[0]
        
        // Update the project
        await mutations.projects.update(testProject.id, {
          description: 'Updated via bidirectional sync test',
          status: 'in_progress'
        })
        
        // Wait a moment for sync
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Query the updated data
        const updatedProjects = await liveStore.store.query(
          `SELECT * FROM org_01920000_1000_7000_8000_000000000001_projects WHERE id = '${testProject.id}'`
        )
        
        return {
          success: true,
          originalStatus: testProject.status,
          updatedStatus: updatedProjects[0]?.status,
          updatedDescription: updatedProjects[0]?.description
        }
        
      } catch (error) {
        return {
          success: false,
          error: error.message
        }
      }
    })
    
    expect(bidirectionalResult.success).toBe(true)
    expect(bidirectionalResult.updatedStatus).toBe('in_progress')
    console.log('✅ Step 9: Bidirectional sync working - status updated from', bidirectionalResult.originalStatus, 'to', bidirectionalResult.updatedStatus)
    
    // Step 10: Final validation - Run pure LiveStore system test
    console.log('📋 Step 10: Running comprehensive pure LiveStore system test...')
    
    const systemTestResult = await page.evaluate(async () => {
      if (window.testPureLiveStoreSystem) {
        try {
          const results = await window.testPureLiveStoreSystem()
          const passed = results.every(r => r.status === 'success')
          return {
            success: passed,
            results: results,
            summary: {
              total: results.length,
              passed: results.filter(r => r.status === 'success').length,
              failed: results.filter(r => r.status === 'error').length
            }
          }
        } catch (error) {
          return {
            success: false,
            error: error.message
          }
        }
      } else {
        return {
          success: false,
          error: 'testPureLiveStoreSystem function not available'
        }
      }
    })
    
    expect(systemTestResult.success).toBe(true)
    console.log(`✅ Step 10: Pure LiveStore system test passed - ${systemTestResult.summary.passed}/${systemTestResult.summary.total} tests successful`)
    
    // Final success report
    console.log('🎉 COMPLETE PURE LIVESTORE SYNC TEST PASSED!')
    console.log('✅ Authentication: Wide Corp CEO')
    console.log('✅ Sync Machine: Pure LiveStore system')
    console.log('✅ Initial Sync: Server data loaded')
    console.log('✅ Mutations: Create/Update working')
    console.log('✅ Real-time UI: Reactive updates')
    console.log('✅ Bidirectional Sync: Working correctly')
    console.log('✅ System Test: All components validated')
  })
  
  test('02 - Multi-User Sync Test', async ({ page, context }) => {
    console.log('🧪 Testing multi-user sync with CEO and CTO accounts...')
    
    // Test with CEO account (already authenticated in persistent context)
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
    
    // Create a project as CEO
    const ceoProjectResult = await page.evaluate(async () => {
      try {
        const orgId = '${WIDE_CORP_ORG_ID}'
        const { liveStoreEventGenerator } = await import('/src/lib/livestore-event-generator.js')
        const liveStore = await window.getLiveStoreClient(orgId)
        const orgSchema = await window.getOrgSchema(orgId)
        
        const mutations = await liveStoreEventGenerator.createMutations(orgId, liveStore.store, orgSchema)
        
        const multiUserProject = await mutations.projects.create({
          name: 'Multi-User Sync Test Project',
          description: 'Testing sync between CEO and CTO',
          status: 'planning',
          organization_id: orgId
        })
        
        return {
          success: true,
          projectId: multiUserProject.id,
          projectName: multiUserProject.name
        }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })
    
    expect(ceoProjectResult.success).toBe(true)
    console.log('✅ CEO created multi-user test project:', ceoProjectResult.projectId)
    
    // Open new page for CTO
    const ctoPage = await context.newPage()
    await ctoPage.goto('/sign-in')
    await ctoPage.waitForLoadState('networkidle')
    
    // Sign in as CTO
    await ctoPage.fill('input[type="email"]', 'cto@widecorp.com')
    await ctoPage.fill('input[type="password"]', 'WideCorp2024!CTO')
    await ctoPage.click('button[type="submit"]')
    await ctoPage.waitForURL(/\/dashboard/, { timeout: 30000 })
    
    // Wait for CTO sync to be ready
    await ctoPage.waitForFunction(() => {
      return window.pureLiveStoreSyncMachineActor && 
             window.pureLiveStoreSyncMachineActor.getSnapshot().value === 'live_sync'
    }, { timeout: 30000 })
    
    console.log('✅ CTO authenticated and sync ready')
    
    // Check if CTO can see CEO's project
    await ctoPage.goto('/projects')
    await ctoPage.waitForLoadState('networkidle')
    
    const ctoCanSeeProject = await ctoPage.locator('text=Multi-User Sync Test Project').isVisible({ timeout: 10000 })
    expect(ctoCanSeeProject).toBe(true)
    
    console.log('✅ CTO can see CEO project - multi-user sync working')
    
    // CTO modifies the project
    const ctoModificationResult = await ctoPage.evaluate(async () => {
      try {
        const orgId = '${WIDE_CORP_ORG_ID}'
        const { liveStoreEventGenerator } = await import('/src/lib/livestore-event-generator.js')
        const liveStore = await window.getLiveStoreClient(orgId)
        const orgSchema = await window.getOrgSchema(orgId)
        
        const mutations = await liveStoreEventGenerator.createMutations(orgId, liveStore.store, orgSchema)
        
        // Find the project
        const projects = await liveStore.store.query(
          `SELECT * FROM org_01920000_1000_7000_8000_000000000001_projects WHERE name = 'Multi-User Sync Test Project'`
        )
        
        if (projects.length === 0) {
          throw new Error('Multi-user test project not found')
        }
        
        const project = projects[0]
        
        // CTO updates the project
        await mutations.projects.update(project.id, {
          status: 'in_progress',
          description: 'Updated by CTO via multi-user sync'
        })
        
        return { success: true, projectId: project.id }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })
    
    expect(ctoModificationResult.success).toBe(true)
    console.log('✅ CTO modified project successfully')
    
    // Check if CEO sees CTO's changes
    await page.reload()
    await page.waitForLoadState('networkidle')
    
    const ceoSeesChanges = await page.locator('text=Updated by CTO via multi-user sync').isVisible({ timeout: 10000 })
    expect(ceoSeesChanges).toBe(true)
    
    console.log('✅ CEO sees CTO changes - bidirectional multi-user sync confirmed')
    
    await ctoPage.close()
  })
  
  test('03 - Performance and Data Integrity', async ({ page }) => {
    console.log('🧪 Testing performance and data integrity...')
    
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
    
    const performanceResults = await page.evaluate(async () => {
      const orgId = '${WIDE_CORP_ORG_ID}'
      const liveStore = await window.getLiveStoreClient(orgId)
      
      if (!liveStore) {
        throw new Error('LiveStore not available for performance test')
      }
      
      // Test query performance
      const startTime = performance.now()
      
      const results = await Promise.all([
        liveStore.store.query(`SELECT COUNT(*) as count FROM org_01920000_1000_7000_8000_000000000001_projects`),
        liveStore.store.query(`SELECT COUNT(*) as count FROM org_01920000_1000_7000_8000_000000000001_tasks`),
        liveStore.store.query(`SELECT COUNT(*) as count FROM org_01920000_1000_7000_8000_000000000001_users`),
        // Complex join query
        liveStore.store.query(`
          SELECT p.name, COUNT(t.id) as task_count 
          FROM org_01920000_1000_7000_8000_000000000001_projects p
          LEFT JOIN org_01920000_1000_7000_8000_000000000001_tasks t ON p.id = t.project_id
          GROUP BY p.id, p.name
          LIMIT 10
        `)
      ])
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      return {
        duration,
        projectCount: results[0][0]?.count || 0,
        taskCount: results[1][0]?.count || 0,
        userCount: results[2][0]?.count || 0,
        joinResults: results[3].length
      }
    })
    
    expect(performanceResults.duration).toBeLessThan(1000) // Should complete in under 1 second
    expect(performanceResults.projectCount).toBeGreaterThan(0)
    
    console.log(`✅ Performance test passed - ${performanceResults.duration}ms for complex queries`)
    console.log(`📊 Data counts - Projects: ${performanceResults.projectCount}, Tasks: ${performanceResults.taskCount}, Users: ${performanceResults.userCount}`)
    
    console.log('🎉 ALL PURE LIVESTORE SYNC TESTS PASSED!')
  })
  
})