/**
 * Drizzle ORM Proof of Concept
 * Test endpoint for querying tasks using Drizzle instead of TypeORM
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, and, or, gte, lte, sql } from 'drizzle-orm';
import * as schema from '@repo/dataforge/drizzle-schema';

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // Only allow GET requests
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Different test endpoints
    if (path === '/api/drizzle-test/tasks') {
      return handleGetTasks(env);
    } else if (path === '/api/drizzle-test/tasks-with-dependencies') {
      return handleGetTasksWithDependencies(env);
    } else if (path === '/api/drizzle-test/projects-with-tasks') {
      return handleGetProjectsWithTasks(env);
    } else if (path === '/api/drizzle-test/benchmark') {
      return handleBenchmark(env);
    }

    return new Response('Not found', { status: 404 });
  },
};

async function handleGetTasks(env: any) {
  try {
    const startTime = Date.now();
    
    // Create Drizzle client
    const sql = neon(env.DATABASE_URL);
    const db = drizzle(sql, { schema });

    // Query tasks using Drizzle
    const tasks = await db.select().from(schema.tasks).limit(10);
    
    const queryTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        method: 'drizzle',
        queryTime: `${queryTime}ms`,
        count: tasks.length,
        data: tasks,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Drizzle query error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function handleGetTasksWithDependencies(env: any) {
  try {
    const startTime = Date.now();
    
    const sql = neon(env.DATABASE_URL);
    const db = drizzle(sql, { schema });

    // Query tasks with their dependencies
    const tasksWithDeps = await db
      .select({
        task: schema.tasks,
        dependency: schema.entity_dependencies,
      })
      .from(schema.tasks)
      .leftJoin(
        schema.entity_dependencies,
        and(
          eq(schema.entity_dependencies.entityType, 'task'),
          or(
            eq(schema.entity_dependencies.predecessorId, schema.tasks.id),
            eq(schema.entity_dependencies.successorId, schema.tasks.id)
          )
        )
      )
      .limit(20);
    
    // Group dependencies by task
    const tasksMap = new Map();
    for (const row of tasksWithDeps) {
      const taskId = row.task.id;
      if (!tasksMap.has(taskId)) {
        tasksMap.set(taskId, {
          ...row.task,
          dependencies: [],
        });
      }
      if (row.dependency) {
        tasksMap.get(taskId).dependencies.push(row.dependency);
      }
    }
    
    const queryTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        method: 'drizzle-with-joins',
        queryTime: `${queryTime}ms`,
        count: tasksMap.size,
        data: Array.from(tasksMap.values()),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Drizzle query error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function handleGetProjectsWithTasks(env: any) {
  try {
    const startTime = Date.now();
    
    const sql = neon(env.DATABASE_URL);
    const db = drizzle(sql, { schema });

    // Query projects with their task counts
    const projectsWithTasks = await db
      .select({
        project: schema.projects,
        taskCount: sql<number>`count(${schema.tasks.id})::int`,
      })
      .from(schema.projects)
      .leftJoin(schema.tasks, eq(schema.tasks.projectId, schema.projects.id))
      .groupBy(schema.projects.id)
      .limit(10);
    
    const queryTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        method: 'drizzle-aggregation',
        queryTime: `${queryTime}ms`,
        count: projectsWithTasks.length,
        data: projectsWithTasks,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Drizzle query error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function handleBenchmark(env: any) {
  try {
    // Run both Drizzle and TypeORM queries to compare
    const drizzleStart = Date.now();
    
    const sql = neon(env.DATABASE_URL);
    const db = drizzle(sql, { schema });
    
    // Drizzle complex query
    const drizzleResult = await db
      .select({
        project: schema.projects,
        task: schema.tasks,
        dependencies: sql<number>`count(distinct ${schema.entity_dependencies.id})::int`,
      })
      .from(schema.projects)
      .leftJoin(schema.tasks, eq(schema.tasks.projectId, schema.projects.id))
      .leftJoin(
        schema.entity_dependencies,
        and(
          eq(schema.entity_dependencies.entityType, 'task'),
          or(
            eq(schema.entity_dependencies.predecessorId, schema.tasks.id),
            eq(schema.entity_dependencies.successorId, schema.tasks.id)
          )
        )
      )
      .groupBy(schema.projects.id, schema.tasks.id)
      .limit(50);
    
    const drizzleTime = Date.now() - drizzleStart;
    
    // For comparison, we'd run the same query with TypeORM here
    // but we'll skip that for now since we're just testing Drizzle
    
    return new Response(
      JSON.stringify({
        success: true,
        benchmark: {
          drizzle: {
            time: `${drizzleTime}ms`,
            resultCount: drizzleResult.length,
          },
          // typeorm: { ... } would go here
        },
        sampleData: drizzleResult.slice(0, 5),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Benchmark error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}