#!/usr/bin/env tsx
import { getDb } from './apps/server/src/lib/drizzle.js';
import { tasks, projects, users } from './packages/dataforge/src/schema/index.js';
import { eq } from 'drizzle-orm';

async function testDrizzle() {
  console.log('🧪 Testing Drizzle Setup...\n');
  
  try {
    const db = getDb();
    
    // Test 1: Query tasks
    console.log('📋 Fetching tasks...');
    const allTasks = await db.select().from(tasks).limit(5);
    console.log(`✅ Found ${allTasks.length} tasks`);
    
    // Test 2: Query projects
    console.log('\n📁 Fetching projects...');
    const allProjects = await db.select().from(projects).limit(5);
    console.log(`✅ Found ${allProjects.length} projects`);
    
    // Test 3: Query users
    console.log('\n👥 Fetching users...');
    const allUsers = await db.select().from(users).limit(5);
    console.log(`✅ Found ${allUsers.length} users`);
    
    // Test 4: Join query
    console.log('\n🔗 Testing join query...');
    const tasksWithProjects = await db
      .select({
        taskTitle: tasks.title,
        projectName: projects.name,
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .limit(5);
    console.log(`✅ Found ${tasksWithProjects.length} tasks with projects`);
    
    // Test 5: Test generated CRUD operations
    console.log('\n🔧 Testing generated CRUD operations...');
    const { tasksQueries } = await import('./packages/dataforge/src/generated/tasks-operations.js');
    const taskResults = await tasksQueries.findAll(db);
    console.log(`✅ CRUD operations work! Found ${taskResults.length} tasks`);
    
    console.log('\n🎉 All tests passed! Drizzle is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testDrizzle().catch(console.error);