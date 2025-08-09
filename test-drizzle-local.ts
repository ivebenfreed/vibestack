#!/usr/bin/env tsx
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import * as schema from './packages/dataforge/src/schema/index.js';
import { eq } from 'drizzle-orm';

async function testDrizzleLocal() {
  console.log('🧪 Testing Drizzle with Local PostgreSQL...\n');
  
  // Create PostgreSQL client for local database
  const client = new Client({
    host: 'localhost',
    port: 6072,
    user: 'postgres',
    password: 'postgres',
    database: 'vibestack_dev_issue_64',
  });
  
  try {
    await client.connect();
    const db = drizzle(client, { schema });
    
    // Test 1: Query tasks
    console.log('📋 Fetching tasks...');
    const allTasks = await db.select().from(schema.tasks).limit(5);
    console.log(`✅ Found ${allTasks.length} tasks`);
    if (allTasks.length > 0) {
      console.log('   Sample task:', allTasks[0]?.title);
    }
    
    // Test 2: Query projects
    console.log('\n📁 Fetching projects...');
    const allProjects = await db.select().from(schema.projects).limit(5);
    console.log(`✅ Found ${allProjects.length} projects`);
    if (allProjects.length > 0) {
      console.log('   Sample project:', allProjects[0]?.name);
    }
    
    // Test 3: Query users
    console.log('\n👥 Fetching users...');
    const allUsers = await db.select().from(schema.users).limit(5);
    console.log(`✅ Found ${allUsers.length} users`);
    if (allUsers.length > 0) {
      console.log('   Sample user:', allUsers[0]?.name);
    }
    
    // Test 4: Join query
    console.log('\n🔗 Testing join query...');
    const tasksWithProjects = await db
      .select({
        taskTitle: schema.tasks.title,
        projectName: schema.projects.name,
      })
      .from(schema.tasks)
      .leftJoin(schema.projects, eq(schema.tasks.projectId, schema.projects.id))
      .limit(5);
    console.log(`✅ Found ${tasksWithProjects.length} tasks with projects`);
    
    // Test 5: Test generated CRUD operations
    console.log('\n🔧 Testing generated CRUD operations...');
    const { tasksQueries } = await import('./packages/dataforge/src/generated/tasks-operations.js');
    const taskResults = await tasksQueries.findAll(db);
    console.log(`✅ CRUD operations work! Found ${taskResults.length} tasks`);
    
    // Test 6: CRDT operation
    console.log('\n🔄 Testing CRDT operation...');
    const testTask = {
      id: crypto.randomUUID(),
      title: 'Test CRDT Task',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await db.insert(schema.tasks)
      .values(testTask)
      .onConflictDoUpdate({
        target: schema.tasks.id,
        set: { 
          title: testTask.title,
          updatedAt: testTask.updatedAt 
        },
      });
    
    // Verify insertion
    const inserted = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, testTask.id))
      .limit(1);
    
    if (inserted.length > 0) {
      console.log(`✅ CRDT insert successful: ${inserted[0].title}`);
      
      // Clean up
      await db.delete(schema.tasks).where(eq(schema.tasks.id, testTask.id));
      console.log('   Cleaned up test data');
    }
    
    console.log('\n🎉 All tests passed! Drizzle with local PostgreSQL is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the test
testDrizzleLocal().catch(console.error);