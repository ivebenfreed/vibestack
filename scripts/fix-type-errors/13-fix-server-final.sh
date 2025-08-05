#!/bin/bash

echo "=== Final Server Type Fixes ==="
echo

cd apps/server/src

# Fix bootstrap.ts
echo "Fixing bootstrap.ts..."
cat > api/bootstrap.ts << 'EOF'
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { UserRole } from "@repo/dataforge/server-entities";
import { Kysely } from 'kysely';
import { NeonHTTPDialect } from 'kysely-neon';
import { initializeAuth } from '../lib/auth';
import type { Env } from '../types/env';

type BootstrapEnv = { Bindings: Env };
const bootstrapRouter = new Hono<BootstrapEnv>();

bootstrapRouter.post('/create-super-admin', async (c) => {
  const bootstrapKeyHeader = c.req.header('X-Bootstrap-Key');
  const { BOOTSTRAP_SECRET, DATABASE_URL } = c.env;

  if (!BOOTSTRAP_SECRET) {
    console.error('[Bootstrap] BOOTSTRAP_SECRET not set.');
    throw new HTTPException(500, { message: 'Bootstrap not configured.' });
  }
  if (bootstrapKeyHeader !== BOOTSTRAP_SECRET) {
    throw new HTTPException(403, { message: 'Invalid bootstrap key.' });
  }

  const neonDialect = new NeonHTTPDialect({ connectionString: DATABASE_URL });
  // Specify the database schema type if available, otherwise use 'any'
  // For example, if you have a DB type from Kysely codegen: import type { DB } from '@repo/dataforge/generated-types';
  // const db = new Kysely<DB>({ dialect: neonDialect });
  const db = new Kysely<any>({ dialect: neonDialect });

  try {
    const existingSuperAdmin = await db
      .selectFrom('users')
      .selectAll()
      .where('role', '=', UserRole.SUPER_ADMIN) // Use the enum value
      .limit(1)
      .executeTakeFirst();
    if (existingSuperAdmin) {
      throw new HTTPException(409, { message: 'Super admin already exists.' });
    }
  } catch (dbError) {
    console.error('[Bootstrap] DB error checking super admin:', dbError);
    throw new HTTPException(500, { message: 'DB error during bootstrap check.' });
  }

  let requestBody;
  try {
    requestBody = await c.req.json();
  } catch (e) {
    throw new HTTPException(400, { message: 'Invalid JSON request body.' });
  }
  
  const { email, password, name, role } = requestBody;
  if (!email || !password || !name) {
    throw new HTTPException(400, { message: 'Email, password, and name required.' });
  }

  const authInstance = initializeAuth(c.env);
  try {
    // The `authInstance.api.signUpEmail` is the correct way to call it.
    // The `body` property is part of the options object for `signUpEmail`.
    // Use type assertion to satisfy the TypeScript compiler
    // When role is undefined, it won't be included in the API call
    const signUpParams = {
      body: role !== undefined
        ? { email, password, name, role }
        : { email, password, name }
    } as any; // Type assertion to bypass strict typing
    
    const result = await authInstance.api.signUpEmail(signUpParams);
    
    // If signUpEmail is successful, result will contain user and token.
    // Errors from signUpEmail (like user already exists) are expected to be thrown.
    // The hook implemented in auth.ts should ensure the role is super_admin if it's the first user.
    // `result.user` contains the created user details.
    return c.json({ message: 'Super admin creation initiated successfully.', userId: result.user?.id }, 201);
  } catch (error: any) { // Catching as 'any' to inspect message property
    if (error instanceof HTTPException) throw error; // Re-throw existing HTTPExceptions
    
    // Check for specific error messages from signUpEmail
    if (error.message?.includes("User already exists")) {
      throw new HTTPException(409, { message: `User with email ${email} already exists.` });
    }
    
    console.error('[Bootstrap] Super admin creation error:', error);
    throw new HTTPException(500, { message: error.message || 'Internal error creating super admin.' });
  }
});

export default bootstrapRouter;
EOF

# Fix all API imports
echo "Fixing API imports..."

# Fix projects.ts
cat > api/projects.ts << 'EOF'
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  type ApiEnv,
  ServiceErrorType,
  createSuccessResponse,
  createErrorResponse
} from '../types/api';
import { NeonService } from '../lib/neon-orm/neon-service';
import type { Project, ProjectStatus } from '@repo/dataforge/server-entities';
import { ProjectRepository } from '../domains/projects';

// Input types for API
export type ProjectCreateInput = Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'members' | 'tasks'>>;
export type ProjectUpdateInput = Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'members' | 'tasks'>>;

// Create projects router
const projects = new Hono<ApiEnv>();

// List projects
projects.get('/', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  try {
    const neonService = new NeonService(c);
    const projectRepo = new ProjectRepository(neonService);
    const { status, ownerId } = c.req.query();
    
    let result: Project[];
    
    if (status && status !== 'all') {
      result = await projectRepo.findByStatus(status as ProjectStatus);
    } else if (ownerId) {
      result = await projectRepo.findByOwner(ownerId as string);
    } else {
      result = await projectRepo.findAllActive();
    }
    
    return c.json(createSuccessResponse(result));
  } catch (err) {
    console.error('Error listing projects:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

// Create project
projects.post('/', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  try {
    const neonService = new NeonService(c);
    const projectRepo = new ProjectRepository(neonService);
    
    const input = await c.req.json<ProjectCreateInput>();
    const created = await projectRepo.createProject({
      ...input,
      ownerId: user.id
    });
    
    return c.json(createSuccessResponse(created), 201);
  } catch (err) {
    console.error('Error creating project:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

// Get project by ID
projects.get('/:id', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  
  try {
    const neonService = new NeonService(c);
    const projectRepo = new ProjectRepository(neonService);
    
    const projectId = c.req.param('id');
    const project = await projectRepo.findById(projectId);
    
    if (!project) {
      return c.json(
        createErrorResponse(ServiceErrorType.NOT_FOUND, 'Project not found'),
        404
      );
    }
    
    return c.json(createSuccessResponse(project));
  } catch (err) {
    console.error('Error getting project:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

// Update project
projects.put('/:id', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  
  const projectId = c.req.param('id');
  
  try {
    const neonService = new NeonService(c);
    const projectRepo = new ProjectRepository(neonService);
    
    // First check if project exists and user has access
    const existingProject = await projectRepo.findById(projectId);
    
    if (!existingProject) {
      return c.json(
        createErrorResponse(ServiceErrorType.NOT_FOUND, 'Project not found'),
        404
      );
    }
    
    if (existingProject.ownerId !== user.id) {
      const isMember = await projectRepo.isProjectMember(projectId, user.id);
      if (!isMember) {
        return c.json(
          createErrorResponse(ServiceErrorType.FORBIDDEN, 'Access denied'),
          403
        );
      }
    }
    
    const input = await c.req.json<ProjectUpdateInput>();
    const updated = await projectRepo.updateProject(projectId, input);
    
    if (!updated) {
      return c.json(
        createErrorResponse(ServiceErrorType.NOT_FOUND, 'Project not found after update'),
        404
      );
    }
    
    return c.json(createSuccessResponse(updated));
  } catch (err) {
    console.error('Error updating project:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

// Delete project
projects.delete('/:id', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  
  const projectId = c.req.param('id');
  
  try {
    const neonService = new NeonService(c);
    const projectRepo = new ProjectRepository(neonService);
    
    // First check if project exists and user owns it
    const existingProject = await projectRepo.findById(projectId);
    
    if (!existingProject) {
      return c.json(
        createErrorResponse(ServiceErrorType.NOT_FOUND, 'Project not found'),
        404
      );
    }
    
    if (existingProject.ownerId !== user.id) {
      return c.json(
        createErrorResponse(ServiceErrorType.FORBIDDEN, 'Only project owner can delete'),
        403
      );
    }
    
    await projectRepo.deleteProject(projectId);
    
    return c.json(createSuccessResponse({
      message: 'Project deleted successfully'
    }));
  } catch (err) {
    console.error('Error deleting project:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

export default projects;
EOF

# Fix tasks.ts
cat > api/tasks.ts << 'EOF'
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  type ApiEnv,
  ServiceErrorType,
  createSuccessResponse,
  createErrorResponse
} from '../types/api';
import { NeonService } from '../lib/neon-orm/neon-service';
import type { Task, TaskStatus } from '@repo/dataforge/server-entities';
import { TaskRepository } from '../domains/tasks';

// Input types for API
export type TaskCreateInput = Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'tags' | 'dependencies' | 'dependents'>>;
export type TaskUpdateInput = Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'tags' | 'dependencies' | 'dependents'>>;

// Create tasks router
const tasks = new Hono<ApiEnv>();

// List tasks
tasks.get('/', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  try {
    const neonService = new NeonService(c);
    const taskRepo = new TaskRepository(neonService);
    const { status, projectId, assigneeId } = c.req.query();
    
    let result: Task[];
    
    if (status && status !== 'all') {
      result = await taskRepo.findByStatus(status as TaskStatus);
    } else if (projectId) {
      result = await taskRepo.findByProject(projectId as string);
    } else if (assigneeId) {
      result = await taskRepo.findByAssignee(assigneeId as string);
    } else {
      result = await taskRepo.findAll();
    }
    
    return c.json(createSuccessResponse(result));
  } catch (err) {
    console.error('Error listing tasks:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

// Create task
tasks.post('/', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  try {
    const neonService = new NeonService(c);
    const taskRepo = new TaskRepository(neonService);
    
    const input = await c.req.json<TaskCreateInput>();
    const created = await taskRepo.createTask(input);
    
    return c.json(createSuccessResponse(created), 201);
  } catch (err) {
    console.error('Error creating task:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

// Get task by ID
tasks.get('/:id', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  
  try {
    const neonService = new NeonService(c);
    const taskRepo = new TaskRepository(neonService);
    
    const taskId = c.req.param('id');
    const task = await taskRepo.findById(taskId);
    
    if (!task) {
      return c.json(
        createErrorResponse(ServiceErrorType.NOT_FOUND, 'Task not found'),
        404
      );
    }
    
    return c.json(createSuccessResponse(task));
  } catch (err) {
    console.error('Error getting task:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

// Update task
tasks.put('/:id', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  
  const taskId = c.req.param('id');
  
  try {
    const neonService = new NeonService(c);
    const taskRepo = new TaskRepository(neonService);
    
    // First check if task exists
    const existingTask = await taskRepo.findById(taskId);
    
    if (!existingTask) {
      return c.json(
        createErrorResponse(ServiceErrorType.NOT_FOUND, 'Task not found'),
        404
      );
    }
    
    const input = await c.req.json<TaskUpdateInput>();
    const updated = await taskRepo.updateTask(taskId, input);
    
    if (!updated) {
      return c.json(
        createErrorResponse(ServiceErrorType.NOT_FOUND, 'Task not found after update'),
        404
      );
    }
    
    return c.json(createSuccessResponse(updated));
  } catch (err) {
    console.error('Error updating task:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

// Delete task
tasks.delete('/:id', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  
  const taskId = c.req.param('id');
  
  try {
    const neonService = new NeonService(c);
    const taskRepo = new TaskRepository(neonService);
    
    // First check if task exists
    const existingTask = await taskRepo.findById(taskId);
    
    if (!existingTask) {
      return c.json(
        createErrorResponse(ServiceErrorType.NOT_FOUND, 'Task not found'),
        404
      );
    }
    
    await taskRepo.deleteTask(taskId);
    
    return c.json(createSuccessResponse({
      message: 'Task deleted successfully'
    }));
  } catch (err) {
    console.error('Error deleting task:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

export default tasks;
EOF

# Fix users.ts
cat > api/users.ts << 'EOF'
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  type ApiEnv,
  ServiceErrorType,
  createSuccessResponse,
  createErrorResponse
} from '../types/api';
import { NeonService } from '../lib/neon-orm/neon-service';
import type { User, UserRole } from '@repo/dataforge/server-entities';
import { UserRepository } from '../domains/users';

// Input types for API
export type UserCreateInput = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'tasks' | 'ownedProjects' | 'memberProjects'>>;
export type UserUpdateInput = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'tasks' | 'ownedProjects' | 'memberProjects'>>;

// Create users router
const users = new Hono<ApiEnv>();

// List users
users.get('/', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  try {
    const neonService = new NeonService(c);
    const userRepo = new UserRepository(neonService);
    const { role } = c.req.query();
    
    let result: User[];
    
    if (role && role !== 'all') {
      result = await userRepo.findByRole(role as UserRole);
    } else {
      result = await userRepo.findAll();
    }
    
    return c.json(createSuccessResponse(result));
  } catch (err) {
    console.error('Error listing users:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

// Create user
users.post('/', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  try {
    const neonService = new NeonService(c);
    const userRepo = new UserRepository(neonService);
    
    const input = await c.req.json<UserCreateInput>();
    const created = await userRepo.createUser(input);
    
    return c.json(createSuccessResponse(created), 201);
  } catch (err) {
    console.error('Error creating user:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

// Get user by ID
users.get('/:id', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  
  try {
    const neonService = new NeonService(c);
    const userRepo = new UserRepository(neonService);
    
    const userId = c.req.param('id');
    const targetUser = await userRepo.findById(userId);
    
    if (!targetUser) {
      return c.json(
        createErrorResponse(ServiceErrorType.NOT_FOUND, 'User not found'),
        404
      );
    }
    
    return c.json(createSuccessResponse(targetUser));
  } catch (err) {
    console.error('Error getting user:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

// Update user
users.put('/:id', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  
  const userId = c.req.param('id');
  
  try {
    const neonService = new NeonService(c);
    const userRepo = new UserRepository(neonService);
    
    // First check if user exists
    const existingUser = await userRepo.findById(userId);
    
    if (!existingUser) {
      return c.json(
        createErrorResponse(ServiceErrorType.NOT_FOUND, 'User not found'),
        404
      );
    }
    
    // Only allow users to update themselves or admins to update others
    if (userId !== user.id && user.role !== 'super_admin') {
      return c.json(
        createErrorResponse(ServiceErrorType.FORBIDDEN, 'Access denied'),
        403
      );
    }
    
    const input = await c.req.json<UserUpdateInput>();
    const updated = await userRepo.updateUser(userId, input);
    
    if (!updated) {
      return c.json(
        createErrorResponse(ServiceErrorType.NOT_FOUND, 'User not found after update'),
        404
      );
    }
    
    return c.json(createSuccessResponse(updated));
  } catch (err) {
    console.error('Error updating user:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

// Delete user
users.delete('/:id', async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  
  const userId = c.req.param('id');
  
  try {
    const neonService = new NeonService(c);
    const userRepo = new UserRepository(neonService);
    
    // First check if user exists
    const existingUser = await userRepo.findById(userId);
    
    if (!existingUser) {
      return c.json(
        createErrorResponse(ServiceErrorType.NOT_FOUND, 'User not found'),
        404
      );
    }
    
    // Only super admins can delete users
    if (user.role !== 'super_admin') {
      return c.json(
        createErrorResponse(ServiceErrorType.FORBIDDEN, 'Only super admins can delete users'),
        403
      );
    }
    
    await userRepo.deleteUser(userId);
    
    return c.json(createSuccessResponse({
      message: 'User deleted successfully'
    }));
  } catch (err) {
    console.error('Error deleting user:', err);
    return c.json(
      createErrorResponse(ServiceErrorType.INTERNAL, String(err)),
      500
    );
  }
});

export default users;
EOF

# Now fix domain imports more carefully
echo "Fixing domain imports..."

# Fix ChangeHistoryRepository
cat > domains/ChangeHistoryRepository.ts << 'EOF'
import { ChangeHistory } from '@repo/dataforge/server-entities';
import { BaseServerRepository } from './BaseServerRepository.js';
import { NeonService } from '../lib/neon-orm/neon-service.js';

/**
 * Change history repository with server-specific query methods.
 * Handles change history operations including filtering by entity and user.
 */
export class ChangeHistoryRepository extends BaseServerRepository<ChangeHistory> {
  constructor(neonService: NeonService) {
    super(neonService, ChangeHistory as any);
  }

  /**
   * Find change history entries for a specific entity
   * @param entityType - The type of entity (e.g., 'task', 'project')
   * @param entityId - The ID of the entity
   * @returns Array of change history entries
   */
  async findByEntity(entityType: string, entityId: string): Promise<ChangeHistory[]> {
    const queryBuilder = await this.neonService.createQueryBuilder(this.entityClass, 'changeHistory');
    return await queryBuilder
      .where('changeHistory.entityType = :entityType', { entityType })
      .andWhere('changeHistory.entityId = :entityId', { entityId })
      .orderBy('changeHistory.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Find change history entries by user
   * @param userId - The ID of the user who made the changes
   * @returns Array of change history entries
   */
  async findByUser(userId: string): Promise<ChangeHistory[]> {
    const queryBuilder = await this.neonService.createQueryBuilder(this.entityClass, 'changeHistory');
    return await queryBuilder
      .where('changeHistory.userId = :userId', { userId })
      .orderBy('changeHistory.createdAt', 'DESC')
      .getMany();
  }

  /**
   * Find recent change history entries
   * @param limit - Maximum number of entries to return
   * @returns Array of change history entries
   */
  async findRecent(limit: number = 50): Promise<ChangeHistory[]> {
    const queryBuilder = await this.neonService.createQueryBuilder(this.entityClass, 'changeHistory');
    return await queryBuilder
      .orderBy('changeHistory.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }
}
EOF

cd ../../..

echo
echo "Final server fixes complete!"