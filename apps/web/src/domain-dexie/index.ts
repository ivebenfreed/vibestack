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

/**
 * Create a VibeGridDex-compatible adapter for a domain service
 * Returns an object with just the update method for backward compatibility
 */
export function createVibeGridDexAdapter(entityType: string) {
  const service = getDomainService(entityType);
  return {
    update: (id: string, updates: any) => service.updateUI(id, updates)
  };
}

// ============================================================================
// Legacy Function Exports (for backward compatibility)
// ============================================================================

// Task functions
export const createTaskUI = (input: any) => domainServices.task.createUI(input);
export const updateTaskUI = (id: string, updates: any) => domainServices.task.updateUI(id, updates);
export const deleteTaskUI = (id: string) => domainServices.task.deleteUI(id);
export const createTaskIncoming = (task: any) => domainServices.task.createIncoming(task);
export const updateTaskIncoming = (id: string, updates: any) => domainServices.task.updateIncoming(id, updates);
export const deleteTaskIncoming = (id: string) => domainServices.task.deleteIncoming(id);

// Project functions
export const createProjectUI = (input: any) => domainServices.project.createUI(input);
export const updateProjectUI = (id: string, updates: any) => domainServices.project.updateUI(id, updates);
export const deleteProjectUI = (id: string) => domainServices.project.deleteUI(id);
export const createProjectIncoming = (project: any) => domainServices.project.createIncoming(project);
export const updateProjectIncoming = (id: string, updates: any) => domainServices.project.updateIncoming(id, updates);
export const deleteProjectIncoming = (id: string) => domainServices.project.deleteIncoming(id);
export const addProjectMemberUI = (projectId: string, userId: string, role?: string) => domainServices.project.addProjectMemberUI(projectId, userId, role);
export const removeProjectMemberUI = (projectId: string, userId: string) => domainServices.project.removeProjectMemberUI(projectId, userId);

// User functions
export const createUserUI = (input: any) => domainServices.user.createUI(input);
export const updateUserUI = (id: string, updates: any) => domainServices.user.updateUI(id, updates);
export const deleteUserUI = (id: string) => domainServices.user.deleteUI(id);
export const createUserIncoming = (user: any) => domainServices.user.createIncoming(user);
export const updateUserIncoming = (id: string, updates: any) => domainServices.user.updateIncoming(id, updates);
export const deleteUserIncoming = (id: string) => domainServices.user.deleteIncoming(id);

// Comment functions
export const createCommentUI = (input: any) => domainServices.comment.createUI(input);
export const updateCommentUI = (id: string, updates: any) => domainServices.comment.updateUI(id, updates);
export const deleteCommentUI = (id: string) => domainServices.comment.deleteUI(id);
export const createCommentIncoming = (comment: any) => domainServices.comment.createIncoming(comment);
export const updateCommentIncoming = (id: string, updates: any) => domainServices.comment.updateIncoming(id, updates);
export const deleteCommentIncoming = (id: string) => domainServices.comment.deleteIncoming(id);

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
 * import { domainServices } from '@/domain-dexie';
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
 * // Option 1: Pass individual update function
 * <VibeGridDexWithSuspense
 *   entityType="task"
 *   columns={columns}
 *   domainService={{ update: updateTaskUI }}
 * />
 * 
 * // Option 2: Use factory (coming soon)
 * <VibeGridDexWithSuspense
 *   entityType="task"
 *   columns={columns}
 *   domainService={createVibeGridDexAdapter('task')}
 * />
 * ```
 * 
 * EXTENDING SERVICES:
 * 
 * ```typescript
 * import { TaskDomainService } from '@/domain-dexie';
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
    const { createTaskUI, createProjectUI } = await import('./');
    
    // Create test projects
    const project1 = await createProjectUI({
      name: 'Test Project 1',
      description: 'A test project for Dexie demo',
      status: 'active',
      priority: 'high'
    });

    const project2 = await createProjectUI({
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
      await createTaskUI(task);
    }

    console.log('Test data seeded:', { projects: 2, tasks: 5 });
  },

  /**
   * Performance benchmark
   */
  async runPerformanceBenchmark() {
    const { bulkCreateTasksUI } = await import('./');
    
    console.log('Starting performance benchmark...');
    
    // Test bulk creation
    const bulkTasks = Array.from({ length: 1000 }, (_, i) => ({
      title: `Benchmark Task ${i + 1}`,
      description: `Generated for performance testing`,
      status: 'todo' as const,
      priority: 'medium' as const,
    }));

    const start = performance.now();
    await bulkCreateTasksUI(bulkTasks);
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