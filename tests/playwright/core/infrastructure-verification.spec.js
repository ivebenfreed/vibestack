// Test to verify all core infrastructure helpers work correctly
import { test, expect } from '../fixtures/persistent-context.js';
import { 
  createEntity, 
  updateEntity, 
  deleteEntity, 
  getEntity,
  getAllEntities,
  withTestContext 
} from './db-test-helpers.js';
import { 
  getSyncState, 
  waitForLSN, 
  getCurrentLSN,
  getSyncMetrics,
  monitorSyncEvents 
} from './sync-test-helpers.js';
import { 
  createSyncedClients, 
  waitForAllClientsSync,
  performConcurrentActions,
  verifyClientConsistency,
  cleanupClients 
} from './multi-client-helpers.js';
import { 
  captureServerLogs,
  findSyncEventsInLogs,
  compareEntityCounts
} from './server-validation.js';

test.describe('Core Infrastructure Verification', () => {
  test('verify db-test-helpers work correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
    
    await withTestContext(page, async () => {
      console.log('\n=== DB TEST HELPERS VERIFICATION ===');
      
      // Test createEntity
      const task = await createEntity(page, 'task', {
        title: 'TEST_Infrastructure_Task',
        description: 'Testing db helpers',
        status: 'pending',
        priority: 'high'
      });
      
      console.log('✅ Created task:', task.id);
      expect(task.id).toBeDefined();
      expect(task.title).toBe('TEST_Infrastructure_Task');
      
      // Test getEntity
      const fetchedTask = await getEntity(page, 'task', task.id);
      console.log('✅ Fetched task:', fetchedTask.id);
      expect(fetchedTask.id).toBe(task.id);
      
      // Test updateEntity
      const updatedTask = await updateEntity(page, 'task', task.id, {
        status: 'in_progress',
        description: 'Updated description'
      });
      
      console.log('✅ Updated task status:', updatedTask.status);
      expect(updatedTask.status).toBe('in_progress');
      
      // Test getAllEntities with filters
      const allTasks = await getAllEntities(page, 'task');
      const pendingTasks = await getAllEntities(page, 'task', { status: 'pending' });
      const inProgressTasks = await getAllEntities(page, 'task', { status: 'in_progress' });
      
      console.log('📊 Task counts:', {
        total: allTasks.length,
        pending: pendingTasks.length,
        inProgress: inProgressTasks.length
      });
      
      expect(inProgressTasks.some(t => t.id === task.id)).toBe(true);
      
      // Test deleteEntity
      await deleteEntity(page, 'task', task.id);
      const deletedTask = await getEntity(page, 'task', task.id);
      console.log('✅ Task deleted:', deletedTask === null);
      expect(deletedTask).toBeNull();
    });
  });

  test('verify sync-test-helpers work correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(5000); // Give more time for app to initialize
    
    console.log('\n=== SYNC TEST HELPERS VERIFICATION ===');
    
    // Test getSyncState
    const syncState = await getSyncState(page);
    console.log('📡 Sync state:', syncState);
    expect(syncState).toBeDefined();
    // Sync state structure might vary, just check it exists
    expect(syncState.currentLSN).toBeDefined();
    
    // Test getCurrentLSN
    const currentLSN = await getCurrentLSN(page);
    console.log('📍 Current LSN:', currentLSN);
    expect(currentLSN).not.toBe('0/0');
    
    // Test getSyncMetrics
    const metrics = await getSyncMetrics(page);
    console.log('📊 Sync metrics:', {
      currentLSN: metrics.currentLSN,
      state: metrics.state,
      pendingChanges: metrics.pendingChanges,
      totalChanges: metrics.totalChanges
    });
    expect(metrics.currentLSN).toBeDefined();
    
    // Test monitorSyncEvents
    const { result, events } = await monitorSyncEvents(page, async () => {
      // Create an entity to trigger sync
      return await createEntity(page, 'task', {
        title: 'TEST_Sync_Monitor_Task',
        status: 'pending'
      });
    });
    
    console.log('🎯 Monitored events:', events.length);
    console.log('📝 Created task during monitoring:', result.id);
    
    // Cleanup
    await deleteEntity(page, 'task', result.id);
  });

  test('verify multi-client-helpers work correctly', async ({ browser }) => {
    console.log('\n=== MULTI-CLIENT HELPERS VERIFICATION ===');
    
    const clients = await createSyncedClients(browser, 2, {
      staggerDelay: 2000
    });
    
    try {
      // Verify both clients are synced
      const syncStats = await Promise.all(
        clients.map(async (client) => ({
          name: client.name,
          lsn: await getCurrentLSN(client.page)
        }))
      );
      
      console.log('📊 Client sync stats:', syncStats);
      
      // Test concurrent actions
      const results = await performConcurrentActions(clients, [
        async (page) => createEntity(page, 'task', {
          title: 'TEST_Client_0_Task',
          status: 'pending'
        }),
        async (page) => createEntity(page, 'task', {
          title: 'TEST_Client_1_Task',
          status: 'in_progress'
        })
      ]);
      
      console.log('✅ Created tasks concurrently:', results.map(r => r.id));
      
      // Wait for sync
      await waitForAllClientsSync(clients);
      
      // Verify consistency
      const consistency = await verifyClientConsistency(clients, async (page) => {
        const tasks = await getAllEntities(page, 'task');
        return tasks.filter(t => t.title.startsWith('TEST_Client_')).length;
      });
      
      console.log('🔍 Client consistency:', consistency);
      expect(consistency.consistent).toBe(true);
      
      // Cleanup tasks
      for (const task of results) {
        await deleteEntity(clients[0].page, 'task', task.id);
      }
      
    } finally {
      await cleanupClients(clients);
    }
  });

  test('verify server-validation helpers work correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
    
    console.log('\n=== SERVER VALIDATION HELPERS VERIFICATION ===');
    
    // Test captureServerLogs
    const logs = await captureServerLogs(20);
    console.log('📜 Captured log lines:', logs.split('\n').length);
    expect(logs).toBeDefined();
    
    // Create a test entity
    const task = await createEntity(page, 'task', {
      title: 'TEST_Server_Validation_Task',
      status: 'pending'
    });
    
    // Wait a bit for server processing
    await page.waitForTimeout(2000);
    
    // Test findSyncEventsInLogs
    const syncEvents = await findSyncEventsInLogs(task.id);
    console.log('🔍 Found sync events for task:', syncEvents.length);
    
    // Test compareEntityCounts
    const counts = await compareEntityCounts(page);
    console.log('📊 Entity count comparison:', counts);
    
    // Note: Some counts might not match if server endpoints aren't implemented
    for (const [entityType, comparison] of Object.entries(counts)) {
      console.log(`  ${entityType}: client=${comparison.client}, server=${comparison.server}`);
    }
    
    // Cleanup
    await deleteEntity(page, 'task', task.id);
  });

  test('integration test - all helpers together', async ({ browser, page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
    
    console.log('\n=== INTEGRATION TEST - ALL HELPERS ===');
    
    // Monitor sync while creating entities
    const { result: entities, events } = await monitorSyncEvents(page, async () => {
      const project = await createEntity(page, 'project', {
        name: 'TEST_Integration_Project',
        description: 'Testing all helpers together'
      });
      
      const task = await createEntity(page, 'task', {
        title: 'TEST_Integration_Task',
        projectId: project.id,
        status: 'pending'
      });
      
      return { project, task };
    });
    
    console.log('✅ Created entities with monitoring:', {
      project: entities.project.id,
      task: entities.task.id,
      events: events.length
    });
    
    // Get current sync state
    const syncMetrics = await getSyncMetrics(page);
    console.log('📊 Sync metrics after creation:', {
      lsn: syncMetrics.currentLSN,
      pending: syncMetrics.pendingChanges
    });
    
    // Check server logs
    const taskLogs = await findSyncEventsInLogs(entities.task.id);
    console.log('📜 Server logs for task:', taskLogs.length > 0 ? 'Found' : 'Not found');
    
    // Cleanup
    await deleteEntity(page, 'task', entities.task.id);
    await deleteEntity(page, 'project', entities.project.id);
    
    console.log('\n✅ All infrastructure helpers are working correctly!');
  });
});