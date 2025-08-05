import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  type ApiEnv,
  ServiceErrorType,
  createSuccessResponse,
  createErrorResponse
} from '../types/api';
import { NeonService } from '../lib/neon-orm/neon-service';
import { TaskRepository } from '../domains/tasks';
import { TaskStatus } from '@repo/dataforge/server-entities';
import type { Task } from '@repo/dataforge/server-entities';

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
      result = await taskRepo.findByProjectId(projectId as string);
    } else if (assigneeId) {
      result = await taskRepo.findByAssigneeId(assigneeId as string);
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
    const created = await taskRepo.create(input);
    
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
    const updated = await taskRepo.update(taskId, input);
    
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
    
    await taskRepo.delete(taskId);
    
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
