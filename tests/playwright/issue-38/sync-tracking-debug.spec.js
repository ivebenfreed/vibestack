// Debug sync tracking inconsistencies - Issue #38
import { test, expect } from '../fixtures/persistent-context.js';
import { 
  waitForSyncInitialized,
  getCurrentLSN 
} from '../core/sync-test-helpers.js';
import { 
  createEntity, 
  deleteEntity,
  withTestContext 
} from '../core/db-test-helpers.js';

test.describe('Sync Tracking Debug - Issue #38', () => {
  
  test('test individual entity sync tracking - tasks', async ({ page }) => {
    await page.goto('/');
    await waitForSyncInitialized(page, 20000);
    
    await withTestContext(page, async () => {
      console.log('\n🔍 TESTING TASKS SYNC TRACKING...');
      
      // Create a task
      const task = await createEntity(page, 'task', {
        title: 'Debug Sync Test Task',
        status: 'pending'
      });
      
      console.log('✅ Created task:', task.id);
      
      // Wait a bit for sync to process
      await page.waitForTimeout(2000);
      
      // Check localChanges table for sync tracking
      const hasChanges = await page.evaluate(async ({ entityName, recordId }) => {
        const { db } = await import('/src/domain/index.js');
        
        console.log('🔍 Checking localChanges for:', entityName, recordId);
        
        // Get all changes for debugging
        const allChanges = await db.localChanges.toArray();
        console.log('📊 Total changes in localChanges:', allChanges.length);
        
        if (allChanges.length > 0) {
          console.log('📋 Sample changes:', allChanges.slice(0, 3));
        }
        
        // Look for matching changes
        const matchingChanges = allChanges.filter(change => 
          change.table === entityName && 
          change.data && 
          change.data.id === recordId
        );
        
        console.log('🎯 Matching changes found:', matchingChanges.length);
        if (matchingChanges.length > 0) {
          console.log('📝 Matching change details:', matchingChanges[0]);
        }
        
        return matchingChanges.length > 0;
      }, { entityName: 'tasks', recordId: task.id });
      
      console.log(`📊 Sync tracking result for tasks: ${hasChanges ? 'SUCCESS' : 'FAILED'}`);
      
      // Clean up
      await deleteEntity(page, 'task', task.id);
      console.log('🧹 Cleaned up test task');
    });
  });
  
  test('test individual entity sync tracking - comments', async ({ page }) => {
    await page.goto('/');
    await waitForSyncInitialized(page, 20000);
    
    await withTestContext(page, async () => {
      console.log('\n🔍 TESTING COMMENTS SYNC TRACKING...');
      
      // Get authenticated user ID
      const currentUserId = await page.evaluate(() => {
        const authState = JSON.parse(localStorage.getItem('auth-machine-state') || '{}');
        return authState.context?.user?.id;
      });
      
      // Create a project first (comments need taskId or projectId)
      const project = await createEntity(page, 'project', {
        name: 'Debug Test Project',
        description: 'Test project for comment'
      });
      
      // Create a comment with proper authorId and projectId
      const comment = await createEntity(page, 'comment', {
        content: 'Debug sync test comment',
        authorId: currentUserId,
        projectId: project.id
      });
      
      console.log('✅ Created comment:', comment.id);
      
      // Wait a bit for sync to process
      await page.waitForTimeout(2000);
      
      // Check localChanges table for sync tracking
      const hasChanges = await page.evaluate(async ({ entityName, recordId }) => {
        const { db } = await import('/src/domain/index.js');
        
        console.log('🔍 Checking localChanges for:', entityName, recordId);
        
        // Get all changes for debugging
        const allChanges = await db.localChanges.toArray();
        console.log('📊 Total changes in localChanges:', allChanges.length);
        
        if (allChanges.length > 0) {
          console.log('📋 Sample changes:', allChanges.slice(0, 3));
        }
        
        // Look for matching changes
        const matchingChanges = allChanges.filter(change => 
          change.table === entityName && 
          change.data && 
          change.data.id === recordId
        );
        
        console.log('🎯 Matching changes found:', matchingChanges.length);
        if (matchingChanges.length > 0) {
          console.log('📝 Matching change details:', matchingChanges[0]);
        }
        
        return matchingChanges.length > 0;
      }, { entityName: 'comments', recordId: comment.id });
      
      console.log(`📊 Sync tracking result for comments: ${hasChanges ? 'SUCCESS' : 'FAILED'}`);
      
      // Clean up
      await deleteEntity(page, 'comment', comment.id);
      await deleteEntity(page, 'project', project.id);
      console.log('🧹 Cleaned up test comment and project');
    });
  });
  
  test('compare sync tracking between full suite and individual tests', async ({ page }) => {
    await page.goto('/');
    await waitForSyncInitialized(page, 20000);
    
    await withTestContext(page, async () => {
      console.log('\n🔍 COMPARING SYNC TRACKING IN SEQUENCE...');
      
      // Get authenticated user ID
      const currentUserId = await page.evaluate(() => {
        const authState = JSON.parse(localStorage.getItem('auth-machine-state') || '{}');
        return authState.context?.user?.id;
      });
      
      const entities = ['projects', 'tasks', 'comments']; // Better dependency order
      const results = {};
      const createdEntities = {};
      
      for (const entityType of entities) {
        console.log(`\n📝 Testing ${entityType}...`);
        
        // Create entity
        let entity;
        try {
          if (entityType === 'projects') {
            entity = await createEntity(page, 'project', {
              name: `Sequential Test Project`,
              description: 'Test project'
            });
            createdEntities.project = entity;
          } else if (entityType === 'tasks') {
            entity = await createEntity(page, 'task', {
              title: `Sequential Test Task`,
              status: 'pending',
              projectId: createdEntities.project?.id
            });
            createdEntities.task = entity;
          } else if (entityType === 'comments') {
            entity = await createEntity(page, 'comment', {
              content: `Sequential Test Comment`,
              authorId: currentUserId,
              projectId: createdEntities.project?.id
            });
          }
          
          console.log(`✅ Created ${entityType}:`, entity.id);
          
          // Wait for sync processing
          await page.waitForTimeout(1000);
          
          // Check sync tracking
          const hasChanges = await page.evaluate(async ({ entityName, recordId }) => {
            const { db } = await import('/src/domain/index.js');
            const allChanges = await db.localChanges.toArray();
            const matchingChanges = allChanges.filter(change => 
              change.table === entityName && 
              change.data && 
              change.data.id === recordId
            );
            return matchingChanges.length > 0;
          }, { entityName: entityType, recordId: entity.id });
          
          results[entityType] = hasChanges;
          console.log(`📊 ${entityType}: ${hasChanges ? 'SUCCESS' : 'FAILED'}`);
          
          // Clean up
          const serviceName = entityType === 'tasks' ? 'task' : 
                             entityType === 'comments' ? 'comment' : 'project';
          await deleteEntity(page, serviceName, entity.id);
          
        } catch (error) {
          console.log(`❌ ${entityType}: ERROR - ${error.message}`);
          results[entityType] = 'ERROR';
        }
      }
      
      console.log('\n📊 SEQUENTIAL TEST RESULTS:');
      console.log('=' .repeat(40));
      for (const [entity, result] of Object.entries(results)) {
        console.log(`${entity}: ${result === true ? '✅ SUCCESS' : result === false ? '❌ FAILED' : '⚠️  ERROR'}`);
      }
    });
  });
});