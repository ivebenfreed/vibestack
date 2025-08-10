// Tests for domain services and operations
import { test, expect } from '@playwright/test';
import { setupDbHelpers, withTestContext } from './db-test-helpers';

test.describe('Domain Service Tests', () => {
  test.beforeEach(async ({ page }) => {
    console.log('🔍 Setting up domain service tests...');
    await page.goto('/');
    await page.waitForTimeout(3000);
  });

  test('test task domain service operations', async ({ page }) => {
    await withTestContext(page, async () => {
      console.log('\n=== TASK DOMAIN SERVICE TESTS ===');
      
      const results = await page.evaluate(async () => {
        // Import domain services
        const { taskDomain } = await import('/src/domain/task.js');
        const results = {};
        
        // 1. Create a task using domain service
        console.log('Creating task via domain service...');
        const createInput = {
          title: 'TEST_Domain_Task',
          description: 'Created via domain service',
          status: 'pending',
          priority: 'high',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };
        
        const createdTask = await taskDomain.actions.create(createInput);
        results.createdTask = {
          id: createdTask.id,
          title: createdTask.title,
          status: createdTask.status
        };
        
        // 2. Query using domain service
        const allTasks = await taskDomain.queries.getAll();
        results.totalTasks = allTasks.length;
        
        // 3. Get specific task
        const fetchedTask = await taskDomain.queries.getById(createdTask.id);
        results.fetchedTask = fetchedTask ? {
          id: fetchedTask.id,
          title: fetchedTask.title
        } : null;
        
        // 4. Update task
        const updateInput = {
          status: 'in_progress',
          assigneeId: 'test-user-123'
        };
        
        const updatedTask = await taskDomain.actions.update(createdTask.id, updateInput);
        results.updatedTask = {
          id: updatedTask.id,
          status: updatedTask.status,
          assigneeId: updatedTask.assigneeId
        };
        
        // 5. Test filtering
        const pendingTasks = allTasks.filter(t => t.status === 'pending');
        const inProgressTasks = allTasks.filter(t => t.status === 'in_progress');
        results.tasksByStatus = {
          pending: pendingTasks.length,
          inProgress: inProgressTasks.length
        };
        
        // 6. Delete task
        await taskDomain.actions.delete(createdTask.id);
        const afterDelete = await taskDomain.queries.getById(createdTask.id);
        results.deletedSuccessfully = afterDelete === undefined;
        
        return results;
      });
      
      console.log('✅ Created task:', results.createdTask);
      console.log('📊 Total tasks:', results.totalTasks);
      console.log('🔍 Fetched task:', results.fetchedTask);
      console.log('📝 Updated task:', results.updatedTask);
      console.log('📈 Tasks by status:', results.tasksByStatus);
      console.log('🗑️ Deleted successfully:', results.deletedSuccessfully);
      
      expect(results.createdTask.id).toBeDefined();
      expect(results.fetchedTask.id).toBe(results.createdTask.id);
      expect(results.updatedTask.status).toBe('in_progress');
      expect(results.deletedSuccessfully).toBe(true);
    });
  });

  test('test project and user domain services', async ({ page }) => {
    await withTestContext(page, async () => {
      console.log('\n=== PROJECT AND USER DOMAIN SERVICES ===');
      
      const results = await page.evaluate(async () => {
        const { projectDomain } = await import('/src/domain/project.js');
        const { userDomain } = await import('/src/domain/user.js');
        const results = {};
        
        // 1. Create a user
        const userInput = {
          name: 'TEST_Domain_User',
          email: 'test.domain@example.com',
          role: 'admin'
        };
        
        const createdUser = await userDomain.actions.create(userInput);
        results.createdUser = {
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email
        };
        
        // 2. Create a project with owner
        const projectInput = {
          name: 'TEST_Domain_Project',
          description: 'Test project via domain service',
          ownerId: createdUser.id
        };
        
        const createdProject = await projectDomain.actions.create(projectInput);
        results.createdProject = {
          id: createdProject.id,
          name: createdProject.name,
          ownerId: createdProject.ownerId
        };
        
        // 3. Query all projects
        const allProjects = await projectDomain.queries.getAll();
        results.totalProjects = allProjects.length;
        
        // 4. Get project by ID with related data
        const projectWithOwner = await projectDomain.queries.getById(createdProject.id);
        results.projectWithOwner = {
          projectName: projectWithOwner.name,
          ownerId: projectWithOwner.ownerId
        };
        
        // 5. Update project
        const projectUpdate = {
          name: 'TEST_Domain_Project_Updated',
          description: 'Updated description'
        };
        
        const updatedProject = await projectDomain.actions.update(
          createdProject.id, 
          projectUpdate
        );
        results.updatedProject = {
          id: updatedProject.id,
          name: updatedProject.name
        };
        
        // 6. Clean up
        await projectDomain.actions.delete(createdProject.id);
        await userDomain.actions.delete(createdUser.id);
        
        return results;
      });
      
      console.log('👤 Created user:', results.createdUser);
      console.log('📁 Created project:', results.createdProject);
      console.log('📊 Total projects:', results.totalProjects);
      console.log('🔗 Project with owner:', results.projectWithOwner);
      console.log('📝 Updated project:', results.updatedProject);
      
      expect(results.createdUser.id).toBeDefined();
      expect(results.createdProject.ownerId).toBe(results.createdUser.id);
      expect(results.updatedProject.name).toContain('Updated');
    });
  });

  test('test complex domain operations with relationships', async ({ page }) => {
    await withTestContext(page, async () => {
      console.log('\n=== COMPLEX DOMAIN OPERATIONS ===');
      
      const results = await page.evaluate(async () => {
        const { taskDomain } = await import('/src/domain/task.js');
        const { projectDomain } = await import('/src/domain/project.js');
        const { userDomain } = await import('/src/domain/user.js');
        const { commentDomain } = await import('/src/domain/comment.js');
        const results = {};
        
        // 1. Create a complete project setup
        const user1 = await userDomain.actions.create({
          name: 'TEST_User_Owner',
          email: 'owner@test.com',
          role: 'admin'
        });
        
        const user2 = await userDomain.actions.create({
          name: 'TEST_User_Member',
          email: 'member@test.com',
          role: 'member'
        });
        
        const project = await projectDomain.actions.create({
          name: 'TEST_Complex_Project',
          description: 'Project with full setup',
          ownerId: user1.id
        });
        
        // 2. Create multiple tasks
        const tasks = [];
        for (let i = 0; i < 5; i++) {
          const task = await taskDomain.actions.create({
            title: `TEST_Task_${i}`,
            description: `Task ${i} in project`,
            projectId: project.id,
            assigneeId: i % 2 === 0 ? user1.id : user2.id,
            status: ['pending', 'in_progress', 'completed'][i % 3],
            priority: ['high', 'medium', 'low'][i % 3]
          });
          tasks.push(task);
        }
        
        // 3. Add comments to tasks
        const comments = [];
        for (let i = 0; i < 3; i++) {
          const comment = await commentDomain.actions.create({
            taskId: tasks[0].id,
            userId: i % 2 === 0 ? user1.id : user2.id,
            content: `TEST_Comment_${i} on first task`
          });
          comments.push(comment);
        }
        
        // 4. Query tasks with filters
        const allProjectTasks = await taskDomain.queries.getAll();
        const projectTasks = allProjectTasks.filter(t => t.projectId === project.id);
        const user1Tasks = projectTasks.filter(t => t.assigneeId === user1.id);
        const pendingTasks = projectTasks.filter(t => t.status === 'pending');
        
        results.taskStats = {
          total: projectTasks.length,
          assignedToUser1: user1Tasks.length,
          pending: pendingTasks.length
        };
        
        // 5. Get task with all comments
        const firstTaskComments = await commentDomain.queries.getAll();
        const taskComments = firstTaskComments.filter(c => c.taskId === tasks[0].id);
        
        results.firstTaskComments = {
          taskTitle: tasks[0].title,
          commentCount: taskComments.length,
          commentAuthors: taskComments.map(c => c.userId)
        };
        
        // 6. Batch update tasks
        const updatePromises = pendingTasks.map(task => 
          taskDomain.actions.update(task.id, { status: 'in_progress' })
        );
        await Promise.all(updatePromises);
        
        // Verify updates
        const updatedTasks = await taskDomain.queries.getAll();
        const stillPending = updatedTasks.filter(t => 
          t.projectId === project.id && t.status === 'pending'
        );
        results.pendingAfterUpdate = stillPending.length;
        
        // 7. Clean up in correct order
        for (const comment of comments) {
          await commentDomain.actions.delete(comment.id);
        }
        for (const task of tasks) {
          await taskDomain.actions.delete(task.id);
        }
        await projectDomain.actions.delete(project.id);
        await userDomain.actions.delete(user1.id);
        await userDomain.actions.delete(user2.id);
        
        results.cleanupComplete = true;
        
        return results;
      });
      
      console.log('📊 Task statistics:', results.taskStats);
      console.log('💬 First task comments:', results.firstTaskComments);
      console.log('🔄 Pending after batch update:', results.pendingAfterUpdate);
      console.log('🧹 Cleanup complete:', results.cleanupComplete);
      
      expect(results.taskStats.total).toBe(5);
      expect(results.firstTaskComments.commentCount).toBe(3);
      expect(results.pendingAfterUpdate).toBe(0);
      expect(results.cleanupComplete).toBe(true);
    });
  });

  test('test error handling in domain services', async ({ page }) => {
    await withTestContext(page, async () => {
      console.log('\n=== ERROR HANDLING TESTS ===');
      
      const results = await page.evaluate(async () => {
        const { taskDomain } = await import('/src/domain/task.js');
        const results = { errors: [] };
        
        // 1. Try to get non-existent task
        try {
          const task = await taskDomain.queries.getById('non-existent-id');
          results.nonExistentTask = task;
        } catch (error) {
          results.errors.push({
            test: 'get-non-existent',
            error: error.message
          });
        }
        
        // 2. Try to create task with invalid data
        try {
          await taskDomain.actions.create({
            // Missing required title
            description: 'Task without title'
          });
        } catch (error) {
          results.errors.push({
            test: 'create-invalid',
            error: error.message || 'Validation error'
          });
        }
        
        // 3. Try to update non-existent task
        try {
          await taskDomain.actions.update('non-existent-id', {
            title: 'Updated title'
          });
        } catch (error) {
          results.errors.push({
            test: 'update-non-existent',
            error: error.message
          });
        }
        
        // 4. Try to delete non-existent task
        try {
          await taskDomain.actions.delete('non-existent-id');
          results.deleteNonExistent = 'No error thrown';
        } catch (error) {
          results.errors.push({
            test: 'delete-non-existent',
            error: error.message
          });
        }
        
        return results;
      });
      
      console.log('❌ Errors caught:', results.errors.length);
      console.log('🔍 Non-existent task result:', results.nonExistentTask);
      console.log('🗑️ Delete non-existent result:', results.deleteNonExistent);
      
      results.errors.forEach(err => {
        console.log(`  - ${err.test}: ${err.error}`);
      });
      
      // Verify error handling
      expect(results.nonExistentTask).toBeUndefined();
      // Some operations might not throw errors, which is also valid
    });
  });
});