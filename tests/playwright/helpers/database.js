// Database test helpers for Playwright tests

/**
 * Create an entity using domain services
 * @param {Page} page - Playwright page object
 * @param {string} entityType - Type of entity (e.g., 'task', 'project', 'user')
 * @param {object} data - Entity data
 * @returns {Promise<object>} Created entity
 */
export async function createEntity(page, entityType, data) {
  return await page.evaluate(async ({ entityType, data }) => {
    const { domainServices } = await import('/src/domain/index.js');
    const service = domainServices[entityType];
    if (!service) {
      throw new Error(`No domain service found for entity type: ${entityType}`);
    }
    return await service.createUI(data);
  }, { entityType, data });
}

/**
 * Update an entity using domain services
 * @param {Page} page - Playwright page object
 * @param {string} entityType - Type of entity
 * @param {string} id - Entity ID
 * @param {object} updates - Update data
 * @returns {Promise<object>} Updated entity
 */
export async function updateEntity(page, entityType, id, updates) {
  return await page.evaluate(async ({ entityType, id, updates }) => {
    const { domainServices } = await import('/src/domain/index.js');
    const service = domainServices[entityType];
    if (!service) {
      throw new Error(`No domain service found for entity type: ${entityType}`);
    }
    return await service.updateUI(id, updates);
  }, { entityType, id, updates });
}

/**
 * Delete an entity using domain services
 * @param {Page} page - Playwright page object
 * @param {string} entityType - Type of entity
 * @param {string} id - Entity ID
 * @returns {Promise<void>}
 */
export async function deleteEntity(page, entityType, id) {
  return await page.evaluate(async ({ entityType, id }) => {
    const { domainServices } = await import('/src/domain/index.js');
    const service = domainServices[entityType];
    if (!service) {
      throw new Error(`No domain service found for entity type: ${entityType}`);
    }
    return await service.deleteUI(id);
  }, { entityType, id });
}

/**
 * Get a single entity by ID
 * @param {Page} page - Playwright page object
 * @param {string} entityType - Type of entity
 * @param {string} id - Entity ID
 * @returns {Promise<object|null>} Entity or null if not found
 */
export async function getEntity(page, entityType, id) {
  return await page.evaluate(async ({ entityType, id }) => {
    const { db } = await import('/src/domain/index.js');
    // Map entity type to table name (add 's' for plural)
    const tableName = entityType + 's';
    const table = db[tableName];
    if (!table) {
      throw new Error(`No table found for entity type: ${entityType}`);
    }
    return await table.get(id) || null;
  }, { entityType, id });
}

/**
 * Get all entities of a type with optional filters
 * @param {Page} page - Playwright page object
 * @param {string} entityType - Type of entity
 * @param {object} filters - Optional filters
 * @returns {Promise<array>} Array of entities
 */
export async function getAllEntities(page, entityType, filters = {}) {
  return await page.evaluate(async ({ entityType, filters }) => {
    const { db } = await import('/src/domain/index.js');
    // Map entity type to table name (add 's' for plural)
    const tableName = entityType + 's';
    const table = db[tableName];
    if (!table) {
      throw new Error(`No table found for entity type: ${entityType}`);
    }
    
    const allEntities = await table.toArray();
    
    // Apply filters
    return allEntities.filter(entity => {
      for (const [key, value] of Object.entries(filters)) {
        if (entity[key] !== value) return false;
      }
      return true;
    });
  }, { entityType, filters });
}

/**
 * Create multiple entities in bulk
 * @param {Page} page - Playwright page object
 * @param {string} entityType - Type of entity
 * @param {array} dataArray - Array of entity data
 * @returns {Promise<array>} Array of created entities
 */
export async function createBulkEntities(page, entityType, dataArray) {
  return await page.evaluate(async ({ entityType, dataArray }) => {
    const { domainServices } = await import('/src/domain/index.js');
    const service = domainServices[entityType];
    if (!service) {
      throw new Error(`No domain service found for entity type: ${entityType}`);
    }
    
    const results = [];
    for (const data of dataArray) {
      const entity = await service.createUI(data);
      results.push(entity);
    }
    return results;
  }, { entityType, dataArray });
}

/**
 * Get entity count from database
 * @param {Page} page - Playwright page object
 * @param {string} tableName - Table name (e.g., 'tasks', 'projects')
 * @returns {Promise<number>} Count
 */
export async function getEntityCount(page, tableName) {
  return await page.evaluate(async (tableName) => {
    const { db } = await import('/src/domain/index.js');
    const table = db[tableName];
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }
    return await table.count();
  }, tableName);
}

/**
 * Get entity directly from database (bypassing domain services)
 * @param {Page} page - Playwright page object
 * @param {string} tableName - Table name
 * @param {string} id - Entity ID
 * @returns {Promise<object|undefined>} Entity or undefined
 */
export async function getEntityFromDB(page, tableName, id) {
  return await page.evaluate(async ({ tableName, id }) => {
    const { db } = await import('/src/domain/index.js');
    const table = db[tableName];
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }
    return await table.get(id);
  }, { tableName, id });
}

/**
 * Set up database test utilities on the page
 */
export async function setupDbHelpers(page) {
  await page.evaluate(() => {
    window.dbHelpers = {
      // Clear all test data
      async clearTestData() {
        const { db } = await import('/src/domain/index.js');
        
        try {
          // Delete all test data (items with TEST_ prefix)
          // Check which tables exist and clear them
          const tablesToClear = [];
          
          if (db.tasks) {
            tablesToClear.push(db.tasks.where('title').startsWith('TEST_').delete());
          }
          if (db.projects) {
            tablesToClear.push(db.projects.where('name').startsWith('TEST_').delete());
          }
          if (db.users) {
            tablesToClear.push(db.users.where('name').startsWith('TEST_').delete());
          }
          if (db.comments) {
            tablesToClear.push(db.comments.where('content').startsWith('TEST_').delete());
          }
          if (db.tags) {
            tablesToClear.push(db.tags.where('name').startsWith('TEST_').delete());
          }
          
          await Promise.all(tablesToClear);
        } catch (error) {
          console.error('Error clearing test data:', error);
        }
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
 * Validate entity relationships
 * @param {Page} page - Playwright page object
 * @param {object} entity - Entity to validate
 * @param {object} relationships - Expected relationships { relationName: { entityType, id } }
 * @returns {Promise<object>} Validation results
 */
export async function validateEntityRelationships(page, entity, relationships) {
  return await page.evaluate(async ({ entity, relationships }) => {
    const { domainServices, db } = await import('/src/domain/index.js');
    const results = {};
    
    for (const [relationName, expected] of Object.entries(relationships)) {
      results[relationName] = {
        expected: expected,
        found: false,
        valid: false
      };
      
      // Handle different relationship patterns
      if (relationName.endsWith('Id')) {
        // Direct foreign key reference (e.g., projectId, ownerId)
        results[relationName].found = entity[relationName];
        results[relationName].valid = entity[relationName] === expected.id;
      } else if (relationName.endsWith('Ids')) {
        // Array of IDs (e.g., tagIds)
        const ids = entity[relationName] || [];
        results[relationName].found = ids;
        results[relationName].valid = ids.includes(expected.id);
      } else {
        // Try to fetch related entity
        const relatedTable = db[expected.entityType + 's'];
        if (relatedTable) {
          const relatedEntity = await relatedTable.get(expected.id);
          results[relationName].found = relatedEntity;
          results[relationName].valid = !!relatedEntity;
        }
      }
    }
    
    return results;
  }, { entity, relationships });
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