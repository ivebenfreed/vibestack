/**
 * Dexie Domain Layer - Formalized Domain Services
 * 
 * This provides a clean, service-based architecture for all entity operations.
 * Each entity has its own domain service that extends a common base class.
 * 
 * Key features:
 * - Type-safe operations using DataForge client entities
 * - Automatic sync tracking for UI operations
 * - Validation and business logic hooks
 * - Simple interface for VibeGridDex integration
 * - No code generation complexity
 */

// Import domain services
import { TaskDomainService } from './task-service';
import { ProjectDomainService } from './project-service';
import { UserDomainService } from './user-service';
import { CommentDomainService } from './comment-service';

// ============================================================================
// Domain Service Instances
// ============================================================================

/**
 * Singleton instances of domain services
 */
export const domainServices = {
  task: new TaskDomainService(),
  project: new ProjectDomainService(),
  user: new UserDomainService(),
  comment: new CommentDomainService(),
} as const;

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Get a domain service by entity type
 */
export function getDomainService(entityType: string) {
  const service = domainServices[entityType as keyof typeof domainServices];
  if (!service) {
    throw new Error(`No domain service found for entity type: ${entityType}`);
  }
  return service;
}

// ============================================================================
// Type Exports
// ============================================================================

// Export input types from services
export type { CreateTaskInput, UpdateTaskInput } from './task-service';
export type { CreateProjectInput, UpdateProjectInput } from './project-service';
export type { CreateUserInput, UpdateUserInput } from './user-service';
export type { CreateCommentInput, UpdateCommentInput } from './comment-service';

// Export service classes for extension
export { TaskDomainService } from './task-service';
export { ProjectDomainService } from './project-service';
export { UserDomainService } from './user-service';
export { CommentDomainService } from './comment-service';
export { BaseDomainService } from './base-domain-service';

// Re-export types from dataforge for convenience
export type {
  Task,
  Project,
  User,
  Comment,
  TaskStatus,
  TaskPriority,
  ProjectStatus,
} from '@repo/dataforge/client-entities';

// Re-export Dexie database instance
export { db } from '@repo/dataforge/dexie-schema';

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * BASIC USAGE:
 * 
 * ```typescript
 * import { domainServices } from '@/domain';
 * 
 * // Direct service usage
 * const task = await domainServices.task.createUI({
 *   title: 'New Task',
 *   priority: TaskPriority.HIGH
 * });
 * 
 * // Update with validation and sync tracking
 * await domainServices.task.updateUI(taskId, {
 *   status: TaskStatus.COMPLETED
 * });
 * ```
 * 
 * VIBEGRIDDEX INTEGRATION:
 * 
 * ```typescript
 * import { domainServices } from '@/domain';
 * 
 * // Pass the update method directly
 * <VibeGridDexWithSuspense
 *   entityType="task"
 *   columns={columns}
 *   onEntityUpdate={(id, updates) => domainServices.task.updateUI(id, updates)}
 *   onBatchEntityUpdate={(updates) => domainServices.task.batchUpdateUI(updates)}
 * />
 * ```
 * 
 * EXTENDING SERVICES:
 * 
 * ```typescript
 * import { TaskDomainService } from '@/domain';
 * 
 * class CustomTaskService extends TaskDomainService {
 *   // Add custom validation
 *   protected validateCreate(input: CreateTaskInput): void {
 *     super.validateCreate(input);
 *     // Your custom validation
 *   }
 *   
 *   // Add custom business logic
 *   async assignToTeam(taskId: string, teamId: string): Promise<Task> {
 *     // Custom implementation
 *   }
 * }
 * ```
 */

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if an entity type has a domain service
 */
export function hasDomainService(entityType: string): boolean {
  return entityType in domainServices;
}

/**
 * Get all available entity types
 */
export function getAvailableEntityTypes(): string[] {
  return Object.keys(domainServices);
}

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
    // Create test projects
    const project1 = await domainServices.project.createUI({
      name: 'Test Project 1',
      description: 'A test project for Dexie demo',
      status: 'active',
      priority: 'high'
    });

    const project2 = await domainServices.project.createUI({
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
      await domainServices.task.createUI(task);
    }

    console.log('Test data seeded:', { projects: 2, tasks: 5 });
  },

  /**
   * Performance benchmark
   */
  async runPerformanceBenchmark() {
    console.log('Starting performance benchmark...');
    
    // Test bulk creation
    const bulkTasks = Array.from({ length: 1000 }, (_, i) => ({
      title: `Benchmark Task ${i + 1}`,
      description: `Generated for performance testing`,
      status: 'todo' as const,
      priority: 'medium' as const,
    }));

    const start = performance.now();
    await domainServices.task.batchCreateUI(bulkTasks);
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