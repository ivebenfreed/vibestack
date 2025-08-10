// Tests for executing queries against local Dexie database
import { test, expect } from '@playwright/test';

test.describe('Database Query Tests', () => {
  test.beforeEach(async ({ page }) => {
    console.log('🔍 Setting up DB query tests...');
    
    // Navigate to app
    await page.goto('/');
    await page.waitForTimeout(3000); // Let app initialize
    
    // Clean up any previous test data
    await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      
      // Delete all test data (items with TEST_ prefix)
      await db.tasks.where('title').startsWith('TEST_').delete();
      await db.projects.where('name').startsWith('TEST_').delete();
      await db.users.where('name').startsWith('TEST_').delete();
      
      console.log('DB: Cleaned up test data');
    });
  });

  test('basic table queries and counts', async ({ page }) => {
    console.log('\n=== BASIC TABLE QUERIES ===');
    
    const results = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      
      // Get table counts
      const counts = {
        tasks: await db.tasks.count(),
        projects: await db.projects.count(),
        users: await db.users.count(),
        tags: await db.tags.count(),
        comments: await db.comments.count()
      };
      
      // Get first item from each table
      const firstItems = {
        firstTask: await db.tasks.orderBy('createdAt').first(),
        firstProject: await db.projects.orderBy('createdAt').first(),
        firstUser: await db.users.orderBy('createdAt').first()
      };
      
      // Get table names
      const tableNames = db.tables.map(t => t.name);
      
      return { counts, firstItems, tableNames };
    });
    
    console.log('📊 Table counts:', results.counts);
    console.log('📋 Available tables:', results.tableNames);
    console.log('🔍 First task:', results.firstItems.firstTask?.title);
    
    // Verify we have tables
    expect(results.tableNames).toContain('tasks');
    expect(results.tableNames).toContain('change_history');
    expect(results.tableNames).toContain('outgoing_change_queue');
  });

  test('create and query test data', async ({ page }) => {
    console.log('\n=== CREATE AND QUERY TEST DATA ===');
    
    const testResults = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const results = {};
      
      // 1. Create a test project
      const projectId = crypto.randomUUID();
      await db.projects.add({
        id: projectId,
        name: 'TEST_Project_' + Date.now(),
        description: 'Test project from Playwright',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      results.projectId = projectId;
      
      // 2. Create multiple test tasks
      const taskIds = [];
      for (let i = 0; i < 5; i++) {
        const taskId = crypto.randomUUID();
        await db.tasks.add({
          id: taskId,
          title: `TEST_Task_${i}`,
          description: `Test task ${i} description`,
          status: i % 2 === 0 ? 'pending' : 'in_progress',
          priority: i < 2 ? 'high' : 'medium',
          projectId: projectId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        taskIds.push(taskId);
      }
      results.taskIds = taskIds;
      
      // 3. Query tasks by status
      const pendingTasks = await db.tasks
        .where('status').equals('pending')
        .and(task => task.title.startsWith('TEST_'))
        .toArray();
      results.pendingCount = pendingTasks.length;
      
      // 4. Query tasks by project
      const projectTasks = await db.tasks
        .where('projectId').equals(projectId)
        .toArray();
      results.projectTaskCount = projectTasks.length;
      
      // 5. Complex query with sorting
      const highPriorityTasks = await db.tasks
        .where('priority').equals('high')
        .and(task => task.title.startsWith('TEST_'))
        .sortBy('createdAt');
      results.highPriorityCount = highPriorityTasks.length;
      
      return results;
    });
    
    console.log('✅ Created project:', testResults.projectId);
    console.log('✅ Created tasks:', testResults.taskIds.length);
    console.log('📊 Pending tasks:', testResults.pendingCount);
    console.log('📊 Project tasks:', testResults.projectTaskCount);
    console.log('📊 High priority tasks:', testResults.highPriorityCount);
    
    expect(testResults.taskIds).toHaveLength(5);
    expect(testResults.pendingCount).toBe(3); // Tasks 0, 2, 4
    expect(testResults.projectTaskCount).toBe(5);
    expect(testResults.highPriorityCount).toBe(2); // Tasks 0, 1
  });

  test('test change history tracking', async ({ page }) => {
    console.log('\n=== CHANGE HISTORY TRACKING ===');
    
    const changeResults = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const results = {};
      
      // 1. Create a task
      const taskId = crypto.randomUUID();
      await db.tasks.add({
        id: taskId,
        title: 'TEST_Change_Tracking_Task',
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      
      // 2. Check INSERT change
      const insertChanges = await db.change_history
        .where('entity_id').equals(taskId)
        .and(change => change.operation === 'INSERT')
        .toArray();
      results.insertChangeCount = insertChanges.length;
      results.insertChange = insertChanges[0];
      
      // 3. Update the task
      await db.tasks.update(taskId, { 
        status: 'completed',
        updatedAt: new Date().toISOString()
      });
      
      // 4. Check UPDATE change
      const updateChanges = await db.change_history
        .where('entity_id').equals(taskId)
        .and(change => change.operation === 'UPDATE')
        .toArray();
      results.updateChangeCount = updateChanges.length;
      
      // 5. Get all changes for this task
      const allChanges = await db.change_history
        .where('entity_id').equals(taskId)
        .toArray();
      results.totalChanges = allChanges.length;
      
      // 6. Check outgoing queue
      const outgoingChanges = await db.outgoing_change_queue
        .where('entity_id').equals(taskId)
        .toArray();
      results.outgoingCount = outgoingChanges.length;
      
      return results;
    });
    
    console.log('📝 Insert changes:', changeResults.insertChangeCount);
    console.log('📝 Update changes:', changeResults.updateChangeCount);
    console.log('📝 Total changes:', changeResults.totalChanges);
    console.log('📤 Outgoing queue:', changeResults.outgoingCount);
    console.log('🔍 First change:', changeResults.insertChange);
    
    expect(changeResults.insertChangeCount).toBeGreaterThan(0);
    expect(changeResults.totalChanges).toBeGreaterThan(1);
  });

  test('test relationships and joins', async ({ page }) => {
    console.log('\n=== RELATIONSHIPS AND JOINS ===');
    
    const relationshipResults = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const results = {};
      
      // 1. Create a user
      const userId = crypto.randomUUID();
      await db.users.add({
        id: userId,
        name: 'TEST_User_' + Date.now(),
        email: 'test@example.com',
        role: 'member',
        createdAt: new Date().toISOString()
      });
      
      // 2. Create tasks assigned to user
      const taskIds = [];
      for (let i = 0; i < 3; i++) {
        const taskId = crypto.randomUUID();
        await db.tasks.add({
          id: taskId,
          title: `TEST_User_Task_${i}`,
          assigneeId: userId,
          status: 'pending',
          createdAt: new Date().toISOString()
        });
        taskIds.push(taskId);
      }
      
      // 3. Query tasks by assignee
      const userTasks = await db.tasks
        .where('assigneeId').equals(userId)
        .toArray();
      results.userTaskCount = userTasks.length;
      
      // 4. Create comments on tasks
      for (const taskId of taskIds.slice(0, 2)) {
        await db.comments.add({
          id: crypto.randomUUID(),
          taskId: taskId,
          userId: userId,
          content: 'Test comment on task',
          createdAt: new Date().toISOString()
        });
      }
      
      // 5. Query comments by task
      const firstTaskComments = await db.comments
        .where('taskId').equals(taskIds[0])
        .toArray();
      results.firstTaskCommentCount = firstTaskComments.length;
      
      // 6. Complex query: Get all data for a task
      const taskWithRelations = await db.transaction('r', 
        db.tasks, db.comments, db.users, 
        async () => {
          const task = await db.tasks.get(taskIds[0]);
          const comments = await db.comments
            .where('taskId').equals(taskIds[0])
            .toArray();
          const assignee = task.assigneeId ? 
            await db.users.get(task.assigneeId) : null;
          
          return { task, comments, assignee };
        }
      );
      results.taskWithRelations = {
        taskTitle: taskWithRelations.task.title,
        commentCount: taskWithRelations.comments.length,
        assigneeName: taskWithRelations.assignee?.name
      };
      
      return results;
    });
    
    console.log('👤 User tasks:', relationshipResults.userTaskCount);
    console.log('💬 Task comments:', relationshipResults.firstTaskCommentCount);
    console.log('🔗 Task with relations:', relationshipResults.taskWithRelations);
    
    expect(relationshipResults.userTaskCount).toBe(3);
    expect(relationshipResults.firstTaskCommentCount).toBe(1);
    expect(relationshipResults.taskWithRelations.assigneeName).toContain('TEST_User_');
  });

  test('test bulk operations and transactions', async ({ page }) => {
    console.log('\n=== BULK OPERATIONS AND TRANSACTIONS ===');
    
    const bulkResults = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const results = {};
      
      // 1. Bulk insert
      const bulkTasks = [];
      for (let i = 0; i < 10; i++) {
        bulkTasks.push({
          id: crypto.randomUUID(),
          title: `TEST_Bulk_Task_${i}`,
          status: 'pending',
          priority: i < 5 ? 'high' : 'low',
          createdAt: new Date().toISOString()
        });
      }
      
      const startTime = Date.now();
      await db.tasks.bulkAdd(bulkTasks);
      results.bulkInsertTime = Date.now() - startTime;
      results.bulkInsertCount = bulkTasks.length;
      
      // 2. Bulk query and update
      const highPriorityTasks = await db.tasks
        .where('priority').equals('high')
        .and(task => task.title.startsWith('TEST_Bulk_'))
        .toArray();
      
      // Update all high priority to medium
      await db.transaction('rw', db.tasks, async () => {
        for (const task of highPriorityTasks) {
          await db.tasks.update(task.id, { priority: 'medium' });
        }
      });
      results.bulkUpdateCount = highPriorityTasks.length;
      
      // 3. Verify updates
      const remainingHighPriority = await db.tasks
        .where('priority').equals('high')
        .and(task => task.title.startsWith('TEST_Bulk_'))
        .count();
      results.remainingHighPriority = remainingHighPriority;
      
      // 4. Bulk delete
      const deleteCount = await db.tasks
        .where('title').startsWith('TEST_Bulk_')
        .delete();
      results.bulkDeleteCount = deleteCount;
      
      return results;
    });
    
    console.log('⚡ Bulk insert time:', bulkResults.bulkInsertTime, 'ms');
    console.log('📦 Bulk insert count:', bulkResults.bulkInsertCount);
    console.log('🔄 Bulk update count:', bulkResults.bulkUpdateCount);
    console.log('🗑️ Bulk delete count:', bulkResults.bulkDeleteCount);
    console.log('✅ Remaining high priority:', bulkResults.remainingHighPriority);
    
    expect(bulkResults.bulkInsertCount).toBe(10);
    expect(bulkResults.bulkUpdateCount).toBe(5);
    expect(bulkResults.remainingHighPriority).toBe(0);
    expect(bulkResults.bulkDeleteCount).toBe(10);
  });

  test('test advanced queries with filters', async ({ page }) => {
    console.log('\n=== ADVANCED QUERIES WITH FILTERS ===');
    
    const advancedResults = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const results = {};
      
      // Setup test data with various attributes
      const testData = [];
      const now = new Date();
      
      for (let i = 0; i < 20; i++) {
        const createdDate = new Date(now);
        createdDate.setDate(now.getDate() - i); // Different dates
        
        testData.push({
          id: crypto.randomUUID(),
          title: `TEST_Advanced_${i}`,
          status: ['pending', 'in_progress', 'completed'][i % 3],
          priority: ['high', 'medium', 'low'][i % 3],
          dueDate: i < 10 ? new Date(now.getTime() + i * 24 * 60 * 60 * 1000).toISOString() : null,
          createdAt: createdDate.toISOString(),
          tags: i % 2 === 0 ? ['urgent', 'important'] : ['normal']
        });
      }
      
      await db.tasks.bulkAdd(testData);
      
      // 1. Query with multiple conditions
      const urgentPending = await db.tasks
        .where('status').equals('pending')
        .filter(task => 
          task.title.startsWith('TEST_Advanced_') &&
          task.priority === 'high'
        )
        .toArray();
      results.urgentPendingCount = urgentPending.length;
      
      // 2. Date range query
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const dueSoon = await db.tasks
        .filter(task => {
          if (!task.dueDate || !task.title.startsWith('TEST_Advanced_')) return false;
          const dueDate = new Date(task.dueDate);
          return dueDate >= now && dueDate <= nextWeek;
        })
        .toArray();
      results.dueSoonCount = dueSoon.length;
      
      // 3. Aggregate query (count by status)
      const statusCounts = {};
      await db.tasks
        .where('title').startsWith('TEST_Advanced_')
        .each(task => {
          statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
        });
      results.statusCounts = statusCounts;
      
      // 4. Pagination query
      const page1 = await db.tasks
        .where('title').startsWith('TEST_Advanced_')
        .offset(0)
        .limit(5)
        .toArray();
      
      const page2 = await db.tasks
        .where('title').startsWith('TEST_Advanced_')
        .offset(5)
        .limit(5)
        .toArray();
      
      results.page1Count = page1.length;
      results.page2Count = page2.length;
      results.page1First = page1[0]?.title;
      results.page2First = page2[0]?.title;
      
      // 5. Clean up
      await db.tasks.where('title').startsWith('TEST_Advanced_').delete();
      
      return results;
    });
    
    console.log('🚨 Urgent pending tasks:', advancedResults.urgentPendingCount);
    console.log('📅 Due soon:', advancedResults.dueSoonCount);
    console.log('📊 Status counts:', advancedResults.statusCounts);
    console.log('📄 Page 1:', advancedResults.page1Count, 'items, first:', advancedResults.page1First);
    console.log('📄 Page 2:', advancedResults.page2Count, 'items, first:', advancedResults.page2First);
    
    expect(advancedResults.statusCounts.pending).toBeGreaterThan(0);
    expect(advancedResults.statusCounts.completed).toBeGreaterThan(0);
    expect(advancedResults.page1Count).toBe(5);
    expect(advancedResults.page2Count).toBe(5);
  });

  test('test sync state queries', async ({ page }) => {
    console.log('\n=== SYNC STATE QUERIES ===');
    
    const syncResults = await page.evaluate(async () => {
      const { db } = await import('/src/domain/index.js');
      const results = {};
      
      // 1. Get current sync state
      const syncState = JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
      results.syncState = {
        clientId: syncState.clientId,
        currentLSN: syncState.currentLSN
      };
      
      // 2. Query recent changes
      const recentChanges = await db.change_history
        .orderBy('hlc')
        .reverse()
        .limit(10)
        .toArray();
      
      results.recentChanges = recentChanges.map(c => ({
        id: c.id,
        table: c.table_name,
        operation: c.operation,
        entity_id: c.entity_id,
        hlc: c.hlc
      }));
      
      // 3. Count changes by table
      const changesByTable = {};
      await db.change_history.each(change => {
        changesByTable[change.table_name] = (changesByTable[change.table_name] || 0) + 1;
      });
      results.changesByTable = changesByTable;
      
      // 4. Check outgoing queue
      const outgoingQueue = await db.outgoing_change_queue.toArray();
      results.outgoingQueueCount = outgoingQueue.length;
      
      // 5. Get last processed change
      const lastChange = await db.change_history
        .orderBy('hlc')
        .last();
      results.lastChangeHLC = lastChange?.hlc;
      
      return results;
    });
    
    console.log('🔄 Sync state:', syncResults.syncState);
    console.log('📜 Recent changes:', syncResults.recentChanges.length);
    console.log('📊 Changes by table:', syncResults.changesByTable);
    console.log('📤 Outgoing queue:', syncResults.outgoingQueueCount);
    console.log('⏰ Last change HLC:', syncResults.lastChangeHLC);
    
    expect(syncResults.syncState.clientId).toBeDefined();
    expect(syncResults.syncState.currentLSN).toBeDefined();
  });
});