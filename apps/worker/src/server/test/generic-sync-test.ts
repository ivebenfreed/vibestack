/**
 * Test the generic sync engine
 * 
 * This demonstrates how the sync engine can handle any entity
 * without domain-specific code.
 */

import { GenericSyncEngine, type LocalChange } from '../sync/generic-sync-engine.js';
import * as schema from '/home/benfreed/vibestack/packages/dataforge-next/src/generated/drizzle-schema.js';
import { syncMetadata, junctionTables } from '/home/benfreed/vibestack/packages/dataforge-next/src/generated/sync-metadata.js';

async function testGenericSync() {
  console.log('🧪 Testing Generic Sync Engine...\n');

  // Initialize engine (would use real DATABASE_URL in production)
  const engine = new GenericSyncEngine(
    process.env.DATABASE_URL || '',
    schema,
    syncMetadata,
    junctionTables
  );

  // Example 1: Create a new task
  console.log('Test 1: Creating a new task');
  const createTaskChange: LocalChange = {
    id: crypto.randomUUID(),
    tableName: 'task',
    recordId: 'task-1',
    operationType: 'INSERT',
    data: {
      id: 'task-1',
      clientId: 'client-task-1',
      title: 'Test Task from Generic Sync',
      description: 'This task was created by the generic sync engine',
      status: 'pending',
      priority: 'high',
      version: 1,
      deleted: false,
      estimatedHours: 5,
      actualHours: 0,
      completionPercentage: 0,
    },
    clientSequence: 1,
  };

  // Example 2: Update a project
  console.log('Test 2: Updating a project');
  const updateProjectChange: LocalChange = {
    id: crypto.randomUUID(),
    tableName: 'project',
    recordId: 'project-1',
    operationType: 'UPDATE',
    data: {
      id: 'project-1',
      clientId: 'client-project-1',
      name: 'Updated Project Name',
      description: 'Updated by generic sync engine',
      status: 'active',
      version: 2,
    },
    clientSequence: 2,
  };

  // Example 3: Create a comment (different domain entity)
  console.log('Test 3: Creating a comment');
  const createCommentChange: LocalChange = {
    id: crypto.randomUUID(),
    tableName: 'comment',
    recordId: 'comment-1',
    operationType: 'INSERT',
    data: {
      id: 'comment-1',
      clientId: 'client-comment-1',
      content: 'This is a test comment',
      taskId: 'task-1',
      authorId: 'user-1',
      version: 1,
      deleted: false,
    },
    clientSequence: 3,
  };

  // Example 4: Add a tag to a task (junction table)
  console.log('Test 4: Adding task-tag relationship');
  const addTaskTagChange: LocalChange = {
    id: crypto.randomUUID(),
    tableName: 'task_tag_entities',
    recordId: 'junction-1',
    operationType: 'INSERT',
    data: {
      task_id: 'task-1',
      tag_id: 'tag-1',
    },
    clientSequence: 4,
  };

  // Example 5: Soft delete a task
  console.log('Test 5: Soft deleting a task');
  const deleteTaskChange: LocalChange = {
    id: crypto.randomUUID(),
    tableName: 'task',
    recordId: 'task-2',
    operationType: 'DELETE',
    data: {
      id: 'task-2',
      clientId: 'client-task-2',
    },
    clientSequence: 5,
  };

  // Process all changes
  const allChanges = [
    createTaskChange,
    updateProjectChange,
    createCommentChange,
    addTaskTagChange,
    deleteTaskChange,
  ];

  console.log(`\n📤 Processing ${allChanges.length} changes...`);
  
  try {
    await engine.processLocalChanges(allChanges);
    console.log('✅ All changes processed successfully!\n');
  } catch (error) {
    console.error('❌ Error processing changes:', error);
    return;
  }

  // Test getting changes for sync
  console.log('📥 Getting changes for client sync...');
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  try {
    const serverChanges = await engine.getChangesForClient(oneHourAgo);
    console.log(`Found changes in ${Object.keys(serverChanges).length} tables:`);
    
    for (const [table, records] of Object.entries(serverChanges)) {
      console.log(`  - ${table}: ${records.length} records`);
    }
    
    console.log('\n✅ Generic sync engine test completed!');
  } catch (error) {
    console.error('❌ Error getting changes:', error);
  }
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testGenericSync().catch(console.error);
}

export { testGenericSync };