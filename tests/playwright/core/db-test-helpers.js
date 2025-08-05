// Database test helpers for Playwright tests

/**
 * Set up database test utilities on the page
 */
export async function setupDbHelpers(page) {
  await page.evaluate(() => {
    window.dbHelpers = {
      // Clear all test data
      async clearTestData() {
        const { db } = await import('/src/domain/index.js');
        
        // Delete all test data (items with TEST_ prefix)
        await db.transaction('rw', 
          db.tasks, db.projects, db.users, db.comments, db.tags,
          async () => {
            await db.tasks.where('title').startsWith('TEST_').delete();
            await db.projects.where('name').startsWith('TEST_').delete();
            await db.users.where('name').startsWith('TEST_').delete();
            await db.comments.where('content').startsWith('TEST_').delete();
            await db.tags.where('name').startsWith('TEST_').delete();
          }
        );
      },
      
      // Get counts for all tables
      async getTableCounts() {
        const { db } = await import('/src/domain/index.js');
        const counts = {};
        
        for (const table of db.tables) {
          counts[table.name] = await table.count();
        }
        
        return counts;
      },
      
      // Get sync metrics
      async getSyncMetrics() {
        const { db } = await import('/src/domain/index.js');
        
        const totalChanges = await db.change_history.count();
        const outgoingCount = await db.outgoing_change_queue.count();
        
        const changesByOperation = {};
        await db.change_history.each(change => {
          changesByOperation[change.operation] = 
            (changesByOperation[change.operation] || 0) + 1;
        });
        
        const lastChange = await db.change_history
          .orderBy('hlc')
          .last();
        
        return {
          totalChanges,
          outgoingCount,
          changesByOperation,
          lastChangeHLC: lastChange?.hlc,
          lastChangeTime: lastChange?.createdAt
        };
      },
      
      // Create test data with relationships
      async createTestDataSet() {
        const { db } = await import('/src/domain/index.js');
        const ids = {};
        
        await db.transaction('rw', 
          db.users, db.projects, db.tasks, db.comments, db.tags,
          async () => {
            // Create users
            ids.users = [];
            for (let i = 0; i < 3; i++) {
              const userId = crypto.randomUUID();
              await db.users.add({
                id: userId,
                name: `TEST_User_${i}`,
                email: `test${i}@example.com`,
                role: i === 0 ? 'admin' : 'member',
                createdAt: new Date().toISOString()
              });
              ids.users.push(userId);
            }
            
            // Create projects
            ids.projects = [];
            for (let i = 0; i < 2; i++) {
              const projectId = crypto.randomUUID();
              await db.projects.add({
                id: projectId,
                name: `TEST_Project_${i}`,
                description: `Test project ${i}`,
                ownerId: ids.users[0],
                createdAt: new Date().toISOString()
              });
              ids.projects.push(projectId);
            }
            
            // Create tasks
            ids.tasks = [];
            for (let i = 0; i < 10; i++) {
              const taskId = crypto.randomUUID();
              await db.tasks.add({
                id: taskId,
                title: `TEST_Task_${i}`,
                description: `Test task ${i} description`,
                status: ['pending', 'in_progress', 'completed'][i % 3],
                priority: ['high', 'medium', 'low'][i % 3],
                projectId: ids.projects[i % 2],
                assigneeId: ids.users[i % 3],
                createdAt: new Date().toISOString()
              });
              ids.tasks.push(taskId);
            }
            
            // Create comments
            ids.comments = [];
            for (let i = 0; i < 5; i++) {
              const commentId = crypto.randomUUID();
              await db.comments.add({
                id: commentId,
                taskId: ids.tasks[i % 10],
                userId: ids.users[i % 3],
                content: `TEST_Comment_${i}`,
                createdAt: new Date().toISOString()
              });
              ids.comments.push(commentId);
            }
            
            // Create tags
            ids.tags = [];
            const tagNames = ['TEST_Urgent', 'TEST_Bug', 'TEST_Feature'];
            for (const name of tagNames) {
              const tagId = crypto.randomUUID();
              await db.tags.add({
                id: tagId,
                name: name,
                color: '#' + Math.floor(Math.random()*16777215).toString(16),
                createdAt: new Date().toISOString()
              });
              ids.tags.push(tagId);
            }
          }
        );
        
        return ids;
      },
      
      // Execute a raw query and return results
      async executeQuery(tableName, queryFn) {
        const { db } = await import('/src/domain/index.js');
        const table = db[tableName];
        if (!table) throw new Error(`Table ${tableName} not found`);
        
        // queryFn receives the table and should return a query
        const query = queryFn(table);
        return await query.toArray();
      },
      
      // Get database schema info
      async getSchemaInfo() {
        const { db } = await import('/src/domain/index.js');
        const schema = {};
        
        db.tables.forEach(table => {
          schema[table.name] = {
            primaryKey: table.schema.primKey.name,
            indexes: table.schema.indexes.map(idx => ({
              name: idx.name,
              unique: idx.unique,
              multi: idx.multi
            }))
          };
        });
        
        return schema;
      }
    };
  });
}

/**
 * Wait for sync to complete
 */
export async function waitForSync(page, timeout = 10000) {
  await page.waitForFunction(
    () => {
      const syncState = JSON.parse(localStorage.getItem('sync-machine-state') || '{}');
      return syncState.currentLSN && syncState.currentLSN !== '0/0';
    },
    { timeout }
  );
}

/**
 * Monitor database changes during a test
 */
export async function monitorChanges(page, callback) {
  // Set up change listener
  await page.evaluate(() => {
    window.dbChangeLog = [];
    window.dbChangeListener = (changes) => {
      window.dbChangeLog.push({
        timestamp: new Date().toISOString(),
        changes: changes.map(c => ({
          table: c.table,
          key: c.key,
          type: c.type,
          obj: c.obj
        }))
      });
    };
  });
  
  // Execute callback
  await callback();
  
  // Get and return changes
  const changes = await page.evaluate(() => window.dbChangeLog);
  
  // Clean up
  await page.evaluate(() => {
    delete window.dbChangeLog;
    delete window.dbChangeListener;
  });
  
  return changes;
}

/**
 * Create a test context with automatic cleanup
 */
export async function withTestContext(page, testFn) {
  // Setup
  await setupDbHelpers(page);
  await page.evaluate(() => window.dbHelpers.clearTestData());
  
  try {
    // Run test
    await testFn();
  } finally {
    // Cleanup
    await page.evaluate(() => window.dbHelpers.clearTestData());
  }
}