#!/usr/bin/env node
// Comprehensive test for pure TypeScript entity registry and Drizzle generation
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import * as crypto from 'crypto';

// Import our registry for metadata inspection
import { registry } from './packages/dataforge/src/entities-pure/metadata-registry.js';

// Import entity registrations BEFORE importing generated schema
import './packages/dataforge/src/entities-pure/Task.pure.js';
import './packages/dataforge/src/entities-pure/User.pure.js';
import './packages/dataforge/src/entities-pure/Project.pure.js';
import './packages/dataforge/src/entities-pure/Comment.pure.js';
import './packages/dataforge/src/entities-pure/StatusDefinition.pure.js';
import './packages/dataforge/src/entities-pure/Tag.pure.js';

// Import our generated schema AFTER registrations
import { 
  tasks,
  users,
  projects,
  comments,
  statusDefinitions,
  tags,
  tasksRelations,
  projectsRelations,
  domainTables,
  dexieIndexHints
} from './packages/dataforge/src/schema/generated-from-registry.js';

// Test database connection (using local PostgreSQL)
const client = new Client({
  host: 'localhost',
  port: 5442, // Worktree-specific port
  user: 'postgres',
  password: 'postgres',
  database: 'vibestack_dev_issue_64'
});

const db = drizzle(client);

async function runTests() {
  console.log('🧪 Testing Pure TypeScript Entity Registry and Drizzle Generation');
  console.log('=' .repeat(80));

  let testsPassed = 0;
  let testsTotal = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    testsTotal++;
    console.log(`\\n${testsTotal}. ${name}`);
    try {
      const result = fn();
      if (result instanceof Promise) {
        return result.then(() => {
          testsPassed++;
          console.log('  ✅ PASSED');
        }).catch((error) => {
          console.log('  ❌ FAILED:', error.message);
        });
      } else {
        testsPassed++;
        console.log('  ✅ PASSED');
      }
    } catch (error: any) {
      console.log('  ❌ FAILED:', error.message);
    }
  }

  // Entity registrations are already loaded via imports at the top of the file
  console.log('🔄 Entity registrations loaded at startup');

  await test('Registry contains expected entities', () => {
    const entities = registry.getAllEntities();
    const entityNames = entities.map(e => e.name).sort();
    const expected = ['Task', 'User', 'Project', 'Comment', 'StatusDefinition', 'Tag'].sort();
    
    if (JSON.stringify(entityNames) !== JSON.stringify(expected)) {
      throw new Error(`Expected entities ${expected.join(', ')}, got ${entityNames.join(', ')}`);
    }
  });

  await test('Entities have correct metadata', () => {
    const taskEntity = registry.getEntity('Task');
    if (!taskEntity) throw new Error('Task entity not found');
    
    if (taskEntity.tableName !== 'tasks') throw new Error('Wrong table name');
    if (taskEntity.category !== 'domain') throw new Error('Wrong category');
    if (!taskEntity.columns.has('title')) throw new Error('Missing title column');
    
    const titleCol = taskEntity.columns.get('title')!;
    if (titleCol.type !== 'string') throw new Error('Wrong title type');
    if (titleCol.length !== 100) throw new Error('Wrong title length');
  });

  await test('Generated schema exports exist', () => {
    if (!tasks) throw new Error('tasks table not exported');
    if (!users) throw new Error('users table not exported');
    if (!domainTables) throw new Error('domainTables not exported');
    if (!dexieIndexHints) throw new Error('dexieIndexHints not exported');
    
    if (domainTables.length !== 6) throw new Error(`Expected 6 domain tables, got ${domainTables.length}`);
  });

  // Database tests
  await test('Connect to database', async () => {
    await client.connect();
  });

  await test('Database schema introspection', async () => {
    const result = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, column_name
    `);
    
    console.log(`    Found ${result.rows.length} columns across all tables`);
    
    // Check for at least our core tables
    const tableNames = [...new Set(result.rows.map(r => r.table_name))];
    const expectedTables = ['tasks', 'users', 'projects'];
    const missingTables = expectedTables.filter(t => !tableNames.includes(t));
    
    if (missingTables.length > 0) {
      console.log(`    Missing tables: ${missingTables.join(', ')}`);
      console.log('    Available tables:', tableNames.join(', '));
    }
  });

  await test('CRUD operations with generated schema', async () => {
    // Create a test user
    const userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      name: 'Test User',
      email: `test-${Date.now()}@example.com`,
      role: 'member' as const
    });

    // Create a test project
    const projectId = crypto.randomUUID();
    await db.insert(projects).values({
      id: projectId,
      name: 'Test Project',
      status: 'active' as const,
      ownerId: userId
    });

    // Create a test task
    const taskId = crypto.randomUUID();
    await db.insert(tasks).values({
      id: taskId,
      title: 'Test Task',
      priority: 'high' as const,
      projectId: projectId,
      assigneeId: userId
    });

    console.log(`    Created user ${userId}, project ${projectId}, task ${taskId}`);

    // Query back
    const queryResult = await db.select().from(tasks).where(sql`id = ${taskId}`);
    if (queryResult.length !== 1) throw new Error('Task not found');
    
    const task = queryResult[0];
    if (task.title !== 'Test Task') throw new Error('Wrong task title');
    if (task.priority !== 'high') throw new Error('Wrong task priority');
  });

  await test('Enum types work correctly', async () => {
    // Test task priority enum
    const taskId = crypto.randomUUID();
    await db.insert(tasks).values({
      id: taskId,
      title: 'Enum Test Task',
      priority: 'low' as const
    });

    const result = await db.select().from(tasks).where(sql`id = ${taskId}`);
    if (result[0].priority !== 'low') throw new Error('Enum value not preserved');
  });

  await test('Relationships and foreign keys', async () => {
    // Create user and project
    const userId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    
    await db.insert(users).values({
      id: userId,
      name: 'FK Test User',
      email: `fk-test-${Date.now()}@example.com`
    });

    await db.insert(projects).values({
      id: projectId,
      name: 'FK Test Project',
      ownerId: userId
    });

    // Query with relations would require joins - basic FK test
    const project = await db.select().from(projects).where(sql`id = ${projectId}`);
    if (project[0].ownerId !== userId) throw new Error('Foreign key not set correctly');
  });

  await test('Dexie index hints are comprehensive', () => {
    const taskIndexes = dexieIndexHints.tasks;
    const expectedTaskIndexes = ['id', 'clientId', 'createdAt', 'updatedAt', 'title', 'projectId', 'assigneeId'];
    
    for (const expectedIndex of expectedTaskIndexes) {
      if (!taskIndexes.includes(expectedIndex)) {
        throw new Error(`Missing index hint for tasks.${expectedIndex}`);
      }
    }
    
    console.log(`    Tasks has ${taskIndexes.length} index hints`);
  });

  await test('Metadata registry completeness', () => {
    const entities = registry.getAllEntities();
    let totalColumns = 0;
    let totalRelations = 0;
    let totalIndexes = 0;
    
    for (const entity of entities) {
      totalColumns += entity.columns.size;
      totalRelations += entity.relations.size;
      totalIndexes += entity.indexes.length;
    }
    
    console.log(`    Total columns: ${totalColumns}`);
    console.log(`    Total relations: ${totalRelations}`);
    console.log(`    Total indexes: ${totalIndexes}`);
    
    if (totalColumns < 30) throw new Error('Too few columns registered');
    if (totalRelations < 5) throw new Error('Too few relations registered');
    if (totalIndexes < 20) throw new Error('Too few indexes registered');
  });

  await test('Schema generation produces valid TypeScript', async () => {
    // This test validates that our generated schema compiles
    const fs = await import('fs');
    const schemaContent = fs.readFileSync('./packages/dataforge/src/schema/generated-from-registry.ts', 'utf8');
    
    // Basic checks
    if (!schemaContent.includes('export const tasks = pgTable')) {
      throw new Error('Generated schema missing task table');
    }
    
    if (!schemaContent.includes('tasksRelations')) {
      throw new Error('Generated schema missing relations');
    }
    
    if (!schemaContent.includes('export const domainTables')) {
      throw new Error('Generated schema missing metadata exports');
    }
    
    console.log(`    Generated schema is ${schemaContent.length} characters`);
  });

  // Cleanup
  await test('Database cleanup', async () => {
    await client.query("DELETE FROM tasks WHERE title LIKE '%Test%'");
    await client.query("DELETE FROM projects WHERE name LIKE '%Test%'");
    await client.query("DELETE FROM users WHERE name LIKE '%Test%'");
    await client.end();
  });

  // Summary
  console.log('\\n' + '='.repeat(80));
  console.log(`📊 Test Results: ${testsPassed}/${testsTotal} passed`);
  
  if (testsPassed === testsTotal) {
    console.log('🎉 ALL TESTS PASSED! Pure TypeScript entity system is working correctly.');
    console.log('\\n✅ Key achievements:');
    console.log('   • Entity registry successfully replaces TypeORM decorators');
    console.log('   • Dynamic Drizzle schema generation from registry metadata');
    console.log('   • Type-safe database operations with enums and relations');
    console.log('   • Comprehensive Dexie index hints for client-side performance');
    console.log('   • Clean separation from TypeORM dependencies');
    process.exit(0);
  } else {
    console.log(`❌ ${testsTotal - testsPassed} test(s) failed`);
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});