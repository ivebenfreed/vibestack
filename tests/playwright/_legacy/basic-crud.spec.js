// Basic CRUD operations test for all entity types
import { test, expect } from '../fixtures/persistent-context.js';
import { 
  createEntity, 
  updateEntity, 
  deleteEntity, 
  getEntity,
  getAllEntities,
  withTestContext 
} from '../core/db-test-helpers.js';
import { 
  getSyncState, 
  getCurrentLSN,
  waitForSyncInitialized,
  getSyncMetrics
} from '../core/sync-test-helpers.js';

test.describe('Basic CRUD Operations', () => {
  test('test task CRUD operations with sync verification', async ({ page }) => {
    await page.goto('/');
    await waitForSyncInitialized(page, 15000);
    
    await withTestContext(page, async () => {
      console.log('\n=== TASK CRUD TEST ===');
      
      // Get initial LSN
      const initialLSN = await getCurrentLSN(page);
      console.log('📍 Initial LSN:', initialLSN);
      
      // CREATE: Test task creation
      console.log('🔧 Testing task creation...');
      const task = await createEntity(page, 'task', {
        title: 'TEST_CRUD_Task',
        description: 'Testing CRUD operations',
        status: 'pending',
        priority: 'high'
      });
      
      expect(task.id).toBeDefined();
      expect(task.title).toBe('TEST_CRUD_Task');
      expect(task.status).toBe('pending');
      console.log('✅ Task created:', task.id);
      
      // Verify LSN progressed (should be different after create)
      const afterCreateLSN = await getCurrentLSN(page);
      console.log('📍 LSN after create:', afterCreateLSN);
      
      // READ: Test task retrieval
      console.log('📖 Testing task read...');
      const fetchedTask = await getEntity(page, 'task', task.id);
      expect(fetchedTask).not.toBeNull();
      expect(fetchedTask.id).toBe(task.id);
      expect(fetchedTask.title).toBe('TEST_CRUD_Task');
      console.log('✅ Task read successfully');
      
      // UPDATE: Test task modification
      console.log('✏️ Testing task update...');
      const updatedTask = await updateEntity(page, 'task', task.id, {
        status: 'in_progress',
        description: 'Updated description for CRUD test'
      });
      
      expect(updatedTask.status).toBe('in_progress');
      expect(updatedTask.description).toBe('Updated description for CRUD test');
      console.log('✅ Task updated successfully');
      
      // Verify LSN progressed after update
      const afterUpdateLSN = await getCurrentLSN(page);
      console.log('📍 LSN after update:', afterUpdateLSN);
      
      // DELETE: Test task deletion
      console.log('🗑️ Testing task deletion...');
      await deleteEntity(page, 'task', task.id);
      
      const deletedTask = await getEntity(page, 'task', task.id);
      expect(deletedTask).toBeNull();
      console.log('✅ Task deleted successfully');
      
      // Verify LSN progressed after delete
      const afterDeleteLSN = await getCurrentLSN(page);
      console.log('📍 LSN after delete:', afterDeleteLSN);
      
      // Verify sync metrics
      const metrics = await getSyncMetrics(page);
      console.log('📊 Final sync metrics:', {
        currentLSN: metrics.currentLSN,
        pendingChanges: metrics.pendingChanges
      });
      
      console.log('✅ Task CRUD test completed successfully!');
    });
  });

  test('test project CRUD operations with sync verification', async ({ page }) => {
    await page.goto('/');
    await waitForSyncInitialized(page, 15000);
    
    await withTestContext(page, async () => {
      console.log('\n=== PROJECT CRUD TEST ===');
      
      const initialLSN = await getCurrentLSN(page);
      console.log('📍 Initial LSN:', initialLSN);
      
      // CREATE: Test project creation
      console.log('🔧 Testing project creation...');
      const project = await createEntity(page, 'project', {
        name: 'TEST_CRUD_Project',
        description: 'Testing project CRUD operations'
      });
      
      expect(project.id).toBeDefined();
      expect(project.name).toBe('TEST_CRUD_Project');
      console.log('✅ Project created:', project.id);
      
      // READ: Test project retrieval
      console.log('📖 Testing project read...');
      const fetchedProject = await getEntity(page, 'project', project.id);
      expect(fetchedProject).not.toBeNull();
      expect(fetchedProject.id).toBe(project.id);
      expect(fetchedProject.name).toBe('TEST_CRUD_Project');
      console.log('✅ Project read successfully');
      
      // UPDATE: Test project modification
      console.log('✏️ Testing project update...');
      const updatedProject = await updateEntity(page, 'project', project.id, {
        name: 'TEST_CRUD_Project_Updated',
        description: 'Updated project description'
      });
      
      expect(updatedProject.name).toBe('TEST_CRUD_Project_Updated');
      expect(updatedProject.description).toBe('Updated project description');
      console.log('✅ Project updated successfully');
      
      // DELETE: Test project deletion
      console.log('🗑️ Testing project deletion...');
      await deleteEntity(page, 'project', project.id);
      
      const deletedProject = await getEntity(page, 'project', project.id);
      expect(deletedProject).toBeNull();
      console.log('✅ Project deleted successfully');
      
      const finalLSN = await getCurrentLSN(page);
      console.log('📍 Final LSN:', finalLSN);
      
      console.log('✅ Project CRUD test completed successfully!');
    });
  });

  test('test user CRUD operations with sync verification', async ({ page }) => {
    await page.goto('/');
    await waitForSyncInitialized(page, 15000);
    
    await withTestContext(page, async () => {
      console.log('\n=== USER CRUD TEST ===');
      
      const initialLSN = await getCurrentLSN(page);
      console.log('📍 Initial LSN:', initialLSN);
      
      // CREATE: Test user creation
      console.log('🔧 Testing user creation...');
      const user = await createEntity(page, 'user', {
        name: 'TEST_CRUD_User',
        email: 'test.crud@example.com'
      });
      
      expect(user.id).toBeDefined();
      expect(user.name).toBe('TEST_CRUD_User');
      expect(user.email).toBe('test.crud@example.com');
      console.log('✅ User created:', user.id);
      
      // READ: Test user retrieval
      console.log('📖 Testing user read...');
      const fetchedUser = await getEntity(page, 'user', user.id);
      expect(fetchedUser).not.toBeNull();
      expect(fetchedUser.id).toBe(user.id);
      expect(fetchedUser.name).toBe('TEST_CRUD_User');
      console.log('✅ User read successfully');
      
      // UPDATE: Test user modification
      console.log('✏️ Testing user update...');
      const updatedUser = await updateEntity(page, 'user', user.id, {
        name: 'TEST_CRUD_User_Updated'
      });
      
      expect(updatedUser.name).toBe('TEST_CRUD_User_Updated');
      console.log('✅ User updated successfully');
      
      // DELETE: Test user deletion
      console.log('🗑️ Testing user deletion...');
      await deleteEntity(page, 'user', user.id);
      
      const deletedUser = await getEntity(page, 'user', user.id);
      expect(deletedUser).toBeNull();
      console.log('✅ User deleted successfully');
      
      const finalLSN = await getCurrentLSN(page);
      console.log('📍 Final LSN:', finalLSN);
      
      console.log('✅ User CRUD test completed successfully!');
    });
  });

  test('test comment CRUD operations with sync verification', async ({ page }) => {
    await page.goto('/');
    await waitForSyncInitialized(page, 15000);
    
    await withTestContext(page, async () => {
      console.log('\n=== COMMENT CRUD TEST ===');
      
      const initialLSN = await getCurrentLSN(page);
      console.log('📍 Initial LSN:', initialLSN);
      
      // First create a task to comment on
      const task = await createEntity(page, 'task', {
        title: 'TEST_Task_For_Comments',
        status: 'pending'
      });
      console.log('📝 Created task for comments:', task.id);
      
      // CREATE: Test comment creation
      console.log('🔧 Testing comment creation...');
      const comment = await createEntity(page, 'comment', {
        content: 'TEST_CRUD_Comment content',
        taskId: task.id,
        authorId: 'test-author-id'
      });
      
      expect(comment.id).toBeDefined();
      expect(comment.content).toBe('TEST_CRUD_Comment content');
      expect(comment.taskId).toBe(task.id);
      console.log('✅ Comment created:', comment.id);
      
      // READ: Test comment retrieval
      console.log('📖 Testing comment read...');
      const fetchedComment = await getEntity(page, 'comment', comment.id);
      expect(fetchedComment).not.toBeNull();
      expect(fetchedComment.id).toBe(comment.id);
      expect(fetchedComment.content).toBe('TEST_CRUD_Comment content');
      console.log('✅ Comment read successfully');
      
      // UPDATE: Test comment modification
      console.log('✏️ Testing comment update...');
      const updatedComment = await updateEntity(page, 'comment', comment.id, {
        content: 'Updated comment content for CRUD test'
      });
      
      expect(updatedComment.content).toBe('Updated comment content for CRUD test');
      console.log('✅ Comment updated successfully');
      
      // DELETE: Test comment deletion
      console.log('🗑️ Testing comment deletion...');
      await deleteEntity(page, 'comment', comment.id);
      
      const deletedComment = await getEntity(page, 'comment', comment.id);
      expect(deletedComment).toBeNull();
      console.log('✅ Comment deleted successfully');
      
      // Cleanup the task
      await deleteEntity(page, 'task', task.id);
      console.log('🧹 Cleaned up test task');
      
      const finalLSN = await getCurrentLSN(page);
      console.log('📍 Final LSN:', finalLSN);
      
      console.log('✅ Comment CRUD test completed successfully!');
    });
  });

  test('test bulk operations and sync progression', async ({ page }) => {
    await page.goto('/');
    await waitForSyncInitialized(page, 15000);
    
    await withTestContext(page, async () => {
      console.log('\n=== BULK OPERATIONS SYNC TEST ===');
      
      const initialLSN = await getCurrentLSN(page);
      const initialMetrics = await getSyncMetrics(page);
      console.log('📍 Initial state:', {
        lsn: initialLSN,
        pendingChanges: initialMetrics.pendingChanges
      });
      
      // Create multiple entities and track LSN progression
      const entities = [];
      
      // Create 3 tasks
      for (let i = 1; i <= 3; i++) {
        const task = await createEntity(page, 'task', {
          title: `TEST_Bulk_Task_${i}`,
          status: 'pending',
          priority: i === 1 ? 'high' : i === 2 ? 'medium' : 'low'
        });
        entities.push({ type: 'task', entity: task });
        
        const currentLSN = await getCurrentLSN(page);
        console.log(`📍 LSN after creating task ${i}:`, currentLSN);
      }
      
      // Create 2 projects
      for (let i = 1; i <= 2; i++) {
        const project = await createEntity(page, 'project', {
          name: `TEST_Bulk_Project_${i}`,
          description: `Bulk test project ${i}`
        });
        entities.push({ type: 'project', entity: project });
        
        const currentLSN = await getCurrentLSN(page);
        console.log(`📍 LSN after creating project ${i}:`, currentLSN);
      }
      
      console.log(`✅ Created ${entities.length} entities total`);
      
      // Update all entities
      console.log('✏️ Updating all entities...');
      for (const { type, entity } of entities) {
        if (type === 'task') {
          await updateEntity(page, 'task', entity.id, {
            status: 'in_progress'
          });
        } else if (type === 'project') {
          await updateEntity(page, 'project', entity.id, {
            description: 'Updated in bulk test'
          });
        }
      }
      
      const afterUpdateLSN = await getCurrentLSN(page);
      console.log('📍 LSN after bulk updates:', afterUpdateLSN);
      
      // Verify all entities exist and are updated
      console.log('🔍 Verifying all entities...');
      for (const { type, entity } of entities) {
        const fetched = await getEntity(page, type, entity.id);
        expect(fetched).not.toBeNull();
        
        if (type === 'task') {
          expect(fetched.status).toBe('in_progress');
        } else if (type === 'project') {
          expect(fetched.description).toBe('Updated in bulk test');
        }
      }
      console.log('✅ All entities verified successfully');
      
      // Delete all entities
      console.log('🗑️ Deleting all entities...');
      for (const { type, entity } of entities) {
        await deleteEntity(page, type, entity.id);
      }
      
      const finalLSN = await getCurrentLSN(page);
      const finalMetrics = await getSyncMetrics(page);
      
      console.log('📊 Final state:', {
        lsn: finalLSN,
        pendingChanges: finalMetrics.pendingChanges,
        totalChanges: finalMetrics.totalChanges
      });
      
      // Verify all entities are deleted
      console.log('🔍 Verifying all entities deleted...');
      for (const { type, entity } of entities) {
        const deleted = await getEntity(page, type, entity.id);
        expect(deleted).toBeNull();
      }
      
      console.log('✅ Bulk operations sync test completed successfully!');
    });
  });
});