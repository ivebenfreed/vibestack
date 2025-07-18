/**
 * Dexie Domain Layer
 * 
 * This is a parallel implementation to the atomic store domains that uses Dexie live queries
 * instead of XState atoms. It provides the same functionality but with different performance
 * characteristics and patterns.
 * 
 * Key differences from atomic domains:
 * - Uses Dexie live queries instead of XState atoms
 * - Data persistence handled by IndexedDB (via Dexie) 
 * - Reactive updates through dexie-react-hooks
 * - No normalization - data stays in relational format
 * - Better performance for bulk operations
 * - Cross-tab reactivity built-in
 */

// Task domain exports
export {
  taskService,
  useTaskQueries,
  taskRepository,
  taskUtils,
  type CreateTaskInput,
  type UpdateTaskInput,
} from './task';

// Project domain exports
export {
  projectService,
  useProjectQueries,
  projectRepository,
  projectUtils,
  type CreateProjectInput,
  type UpdateProjectInput,
} from './project';

// Re-export types from dataforge for convenience
export type {
  Task,
  Project,
  User,
  TaskStatus,
  TaskPriority,
  ProjectStatus,
} from '@repo/dataforge/client-entities';

// Re-export Dexie database instance
export { db } from '@repo/dataforge/dexie-schema';

// ============================================================================
// Comparison Guide: Atomic Stores vs Dexie Live Queries
// ============================================================================

/**
 * USAGE COMPARISON:
 * 
 * === ATOMIC STORES (Current) ===
 * ```typescript
 * import { useTaskAtoms } from '@/domain/task';
 * 
 * function TaskList() {
 *   const tasks = useTaskAtoms.allTasks();
 *   const taskCount = useTaskAtoms.taskCount();
 *   // Data is normalized and cached in memory
 * }
 * ```
 * 
 * === DEXIE LIVE QUERIES (Parallel) ===
 * ```typescript
 * import { useTaskQueries } from '@/domain-dexie';
 * 
 * function TaskList() {
 *   const tasks = useTaskQueries.allTasks();
 *   const taskCount = useTaskQueries.taskCount();
 *   // Data is fetched from IndexedDB with live updates
 * }
 * ```
 * 
 * PERFORMANCE CHARACTERISTICS:
 * 
 * Atomic Stores:
 * ✅ Very fast reads (in-memory)
 * ✅ Surgical re-render control
 * ✅ Stable object references
 * ❌ Manual sync with database
 * ❌ Memory usage grows with data
 * ❌ Complex state management
 * 
 * Dexie Live Queries:
 * ✅ Automatic persistence
 * ✅ Cross-tab reactivity
 * ✅ Excellent bulk operations
 * ✅ Simpler architecture
 * ❌ Slightly slower reads (IndexedDB)
 * ❌ Less granular re-render control
 * ❌ New object instances on updates
 * 
 * WHEN TO USE EACH:
 * 
 * Use Atomic Stores for:
 * - High-frequency updates (like data grids)
 * - Complex derived computations
 * - Performance-critical UI components
 * - Need for stable references
 * 
 * Use Dexie Live Queries for:
 * - Standard CRUD operations
 * - List/detail views
 * - Dashboard components
 * - Bulk data operations
 * - Cross-tab synchronization
 */

// ============================================================================
// Migration Utilities
// ============================================================================

/**
 * Utilities for migrating between atomic stores and Dexie patterns
 */
export const migrationUtils = {
  /**
   * Convert atomic store data to Dexie
   */
  async syncAtomicToIndexedDB() {
    // This would sync current atomic store data to IndexedDB
    // Useful for transitioning or keeping both in sync during testing
    console.log('Migration utility: syncAtomicToIndexedDB');
    // Implementation would go here
  },

  /**
   * Performance comparison helper
   */
  async comparePerformance() {
    // This would run the same operations on both systems and compare timing
    console.log('Migration utility: comparePerformance');
    // Implementation would go here
  },
};

// ============================================================================
// Development Utilities
// ============================================================================

/**
 * Development and debugging utilities
 */
export const devUtils = {
  /**
   * Clear all Dexie data (for testing)
   */
  async clearAllData() {
    await Promise.all([
      db.tasks.clear(),
      db.projects.clear(),
      db.users.clear(),
      db.task_tags.clear(),
      db.project_members.clear(),
      db.project_status_sets.clear(),
      db.project_tag_sets.clear(),
      db.task_dependencies.clear(),
    ]);
    console.log('All Dexie data cleared');
  },

  /**
   * Seed test data
   */
  async seedTestData() {
    const { taskService, projectService } = await import('./');
    
    // Create test projects
    const project1 = await projectService.create({
      name: 'Test Project 1',
      description: 'A test project for Dexie demo',
      status: 'active',
      priority: 'high'
    });

    const project2 = await projectService.create({
      name: 'Test Project 2', 
      description: 'Another test project',
      status: 'active',
      priority: 'medium'
    });

    // Create test tasks
    const tasks = [
      { title: 'Task 1', description: 'First test task', projectId: project1.id, status: 'todo' as const },
      { title: 'Task 2', description: 'Second test task', projectId: project1.id, status: 'in_progress' as const },
      { title: 'Task 3', description: 'Third test task', projectId: project2.id, status: 'completed' as const },
      { title: 'Task 4', description: 'Fourth test task', projectId: project2.id, status: 'todo' as const },
      { title: 'Task 5', description: 'Fifth test task', status: 'todo' as const },
    ];

    for (const task of tasks) {
      await taskService.create(task);
    }

    console.log('Test data seeded:', { projects: 2, tasks: 5 });
  },

  /**
   * Performance benchmark
   */
  async runPerformanceBenchmark() {
    const { taskService } = await import('./');
    
    console.log('Starting performance benchmark...');
    
    // Test bulk creation
    const bulkTasks = Array.from({ length: 1000 }, (_, i) => ({
      title: `Benchmark Task ${i + 1}`,
      description: `Generated for performance testing`,
      status: 'todo' as const,
      priority: 'medium' as const,
    }));

    const start = performance.now();
    await taskService.bulkCreate(bulkTasks);
    const end = performance.now();

    const queryStart = performance.now();
    const count = await db.tasks.count();
    const queryEnd = performance.now();

    console.log('Benchmark results:', {
      bulkCreate: `${(end - start).toFixed(2)}ms for 1000 tasks`,
      perTask: `${((end - start) / 1000).toFixed(3)}ms per task`,
      queryTime: `${(queryEnd - queryStart).toFixed(2)}ms for count query`,
      totalTasks: count
    });
  },

  /**
   * Database info
   */
  async getDatabaseInfo() {
    const tables = await Promise.all([
      { name: 'tasks', count: await db.tasks.count() },
      { name: 'projects', count: await db.projects.count() },
      { name: 'users', count: await db.users.count() },
      { name: 'task_tags', count: await db.task_tags.count() },
      { name: 'project_members', count: await db.project_members.count() },
    ]);

    return {
      database: db.name,
      version: db.verno,
      tables,
      totalRecords: tables.reduce((sum, t) => sum + t.count, 0)
    };
  },
};