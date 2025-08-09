/**
 * Drizzle ORM Proof of Concept
 * Test endpoints for querying using Drizzle instead of TypeORM
 */

import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, and, or, sql } from 'drizzle-orm';
import * as schema from '@repo/dataforge/drizzle-schema';
import * as schemaMikro from '@repo/dataforge/drizzle-schema-mikro';
import type { AppBindings } from '../types/hono';

const drizzleRouter = new Hono<AppBindings>();

// Test endpoint: Get tasks
drizzleRouter.get('/tasks', async (c) => {
  try {
    const startTime = Date.now();
    
    // Create Drizzle client using env DATABASE_URL
    const sqlClient = neon(c.env.DATABASE_URL);
    const db = drizzle(sqlClient, { schema });

    // Query tasks using Drizzle
    const tasks = await db.select().from(schema.tasks).limit(10);
    
    const queryTime = Date.now() - startTime;

    return c.json({
      success: true,
      method: 'drizzle',
      queryTime: `${queryTime}ms`,
      count: tasks.length,
      data: tasks,
    });
  } catch (error) {
    console.error('Drizzle query error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Test endpoint: Get tasks with dependencies
drizzleRouter.get('/tasks-with-dependencies', async (c) => {
  try {
    const startTime = Date.now();
    
    const sqlClient = neon(c.env.DATABASE_URL);

    // Use raw SQL since Drizzle schema is incomplete
    const tasksWithDeps = await sqlClient`
      SELECT 
        t.id as task_id,
        t.title,
        t.description,
        t.priority,
        t.project_id,
        d.id as dep_id,
        d.predecessor_id,
        d.successor_id,
        d.dependency_type,
        d.lag_days
      FROM tasks t
      LEFT JOIN entity_dependencies d ON 
        d.entity_type = 'task' AND 
        (d.predecessor_id = t.id OR d.successor_id = t.id)
      LIMIT 20
    `;
    
    // Group dependencies by task
    const tasksMap = new Map();
    for (const row of tasksWithDeps) {
      const taskId = row.task_id;
      if (!tasksMap.has(taskId)) {
        tasksMap.set(taskId, {
          id: row.task_id,
          title: row.title,
          description: row.description,
          priority: row.priority,
          projectId: row.project_id,
          dependencies: [],
        });
      }
      if (row.dep_id) {
        tasksMap.get(taskId).dependencies.push({
          id: row.dep_id,
          predecessorId: row.predecessor_id,
          successorId: row.successor_id,
          type: row.dependency_type,
          lagDays: row.lag_days
        });
      }
    }
    
    const queryTime = Date.now() - startTime;

    return c.json({
      success: true,
      method: 'drizzle-with-joins',
      queryTime: `${queryTime}ms`,
      count: tasksMap.size,
      data: Array.from(tasksMap.values()),
    });
  } catch (error) {
    console.error('Drizzle query error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Test endpoint: Get projects with task counts
drizzleRouter.get('/projects-with-tasks', async (c) => {
  try {
    const startTime = Date.now();
    
    const sqlClient = neon(c.env.DATABASE_URL);
    
    // Use raw SQL since the Drizzle schema is incomplete (missing inherited fields)
    const projectsWithTasks = await sqlClient`
      SELECT 
        p.id as project_id,
        p.name as project_name,
        p.description,
        COUNT(t.id)::int as task_count
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      GROUP BY p.id, p.name, p.description
      LIMIT 10
    `;
    
    const queryTime = Date.now() - startTime;

    return c.json({
      success: true,
      method: 'drizzle-aggregation',
      queryTime: `${queryTime}ms`,
      count: projectsWithTasks.length,
      data: projectsWithTasks,
    });
  } catch (error) {
    console.error('Drizzle query error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Benchmark endpoint: Compare Drizzle performance
drizzleRouter.get('/benchmark', async (c) => {
  try {
    // Run multiple Drizzle queries to test performance
    const drizzleStart = Date.now();
    
    const sqlClient = neon(c.env.DATABASE_URL);
    const db = drizzle(sqlClient, { schema });
    
    // Test 1: Simple select
    const simpleStart = Date.now();
    const simpleTasks = await db.select().from(schema.tasks).limit(100);
    const simpleTime = Date.now() - simpleStart;
    
    // Test 2: Join query
    const joinStart = Date.now();
    const joinResult = await db
      .select()
      .from(schema.tasks)
      .leftJoin(schema.projects, eq(schema.tasks.projectId, schema.projects.id))
      .limit(100);
    const joinTime = Date.now() - joinStart;
    
    // Test 3: Complex aggregation
    const aggStart = Date.now();
    const aggResult = await db
      .select({
        projectId: schema.tasks.projectId,
        taskCount: sql<number>`count(*)::int`,
        avgPriority: sql<number>`avg(case when priority = 'high' then 3 when priority = 'medium' then 2 else 1 end)`,
      })
      .from(schema.tasks)
      .groupBy(schema.tasks.projectId)
      .limit(20);
    const aggTime = Date.now() - aggStart;
    
    const totalDrizzleTime = Date.now() - drizzleStart;
    
    return c.json({
      success: true,
      benchmark: {
        totalTime: `${totalDrizzleTime}ms`,
        tests: {
          simpleSelect: {
            time: `${simpleTime}ms`,
            resultCount: simpleTasks.length,
          },
          joinQuery: {
            time: `${joinTime}ms`,
            resultCount: joinResult.length,
          },
          aggregation: {
            time: `${aggTime}ms`,
            resultCount: aggResult.length,
          },
        },
      },
      sampleData: {
        simple: simpleTasks.slice(0, 2),
        join: joinResult.slice(0, 2),
        aggregation: aggResult.slice(0, 2),
      },
    });
  } catch (error) {
    console.error('Benchmark error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Test TypeORM vs Drizzle comparison
drizzleRouter.get('/compare', async (c) => {
  try {
    // Get the same data using raw SQL (since Drizzle schema is incomplete)
    const drizzleStart = Date.now();
    
    const sqlClient = neon(c.env.DATABASE_URL);
    
    const drizzleTasks = await sqlClient`
      SELECT * FROM tasks LIMIT 50
    `;
    
    const drizzleTime = Date.now() - drizzleStart;
    
    // For a real comparison, we'd also query with TypeORM here
    // This is just showing the Drizzle side
    
    return c.json({
      success: true,
      comparison: {
        drizzle: {
          time: `${drizzleTime}ms`,
          count: drizzleTasks.length,
          features: [
            'Type-safe queries',
            'Lightweight (~35kb)',
            'No decorators needed',
            'Better tree-shaking',
            'SQL-like syntax',
          ],
        },
        typeorm: {
          note: 'TypeORM query would go here',
          features: [
            'Active Record pattern',
            'Decorators',
            'Migrations',
            'Entity relationships',
            'Heavier bundle (~200kb)',
          ],
        },
      },
      sampleData: drizzleTasks.slice(0, 3),
    });
  } catch (error) {
    console.error('Comparison error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default drizzleRouter;