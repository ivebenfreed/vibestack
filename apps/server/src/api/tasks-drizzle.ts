import { Hono } from 'hono';
import { createTasksDomain } from '../domains/tasks-drizzle.js';
import { requireAuth } from '../middleware/auth.js';
import type { Env } from '../types/env.js';

const app = new Hono<{ Bindings: Env }>();

// Require authentication for all routes
app.use('*', requireAuth);

// GET /tasks - Get all tasks
app.get('/', async (c) => {
  try {
    const tasksDomain = createTasksDomain(c.env.DATABASE_URL);
    const tasks = await tasksDomain.findAll();
    return c.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return c.json({ error: 'Failed to fetch tasks' }, 500);
  }
});

// GET /tasks/:id - Get task by ID
app.get('/:id', async (c) => {
  try {
    const tasksDomain = createTasksDomain(c.env.DATABASE_URL);
    const { id } = c.req.param();
    const task = await tasksDomain.findWithRelations(id);
    
    if (!task) {
      return c.json({ error: 'Task not found' }, 404);
    }
    
    return c.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    return c.json({ error: 'Failed to fetch task' }, 500);
  }
});

// POST /tasks - Create new task
app.post('/', async (c) => {
  try {
    const tasksDomain = createTasksDomain(c.env.DATABASE_URL);
    const data = await c.req.json();
    
    // System create - clears clientId
    const task = await tasksDomain.systemCreate(data);
    
    return c.json(task, 201);
  } catch (error) {
    console.error('Error creating task:', error);
    return c.json({ error: 'Failed to create task' }, 500);
  }
});

// PUT /tasks/:id - Update task
app.put('/:id', async (c) => {
  try {
    const tasksDomain = createTasksDomain(c.env.DATABASE_URL);
    const { id } = c.req.param();
    const data = await c.req.json();
    
    // System update - clears clientId
    const task = await tasksDomain.systemUpdate(id, data);
    
    if (!task) {
      return c.json({ error: 'Task not found' }, 404);
    }
    
    return c.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    return c.json({ error: 'Failed to update task' }, 500);
  }
});

// DELETE /tasks/:id - Delete task
app.delete('/:id', async (c) => {
  try {
    const tasksDomain = createTasksDomain(c.env.DATABASE_URL);
    const { id } = c.req.param();
    const success = await tasksDomain.delete(id);
    
    if (!success) {
      return c.json({ error: 'Task not found' }, 404);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return c.json({ error: 'Failed to delete task' }, 500);
  }
});

// GET /tasks/project/:projectId - Get tasks by project
app.get('/project/:projectId', async (c) => {
  try {
    const tasksDomain = createTasksDomain(c.env.DATABASE_URL);
    const { projectId } = c.req.param();
    const projectTasks = await tasksDomain.findByProject(projectId);
    return c.json(projectTasks);
  } catch (error) {
    console.error('Error fetching tasks by project:', error);
    return c.json({ error: 'Failed to fetch tasks' }, 500);
  }
});

// GET /tasks/assignee/:assigneeId - Get tasks by assignee  
app.get('/assignee/:assigneeId', async (c) => {
  try {
    const tasksDomain = createTasksDomain(c.env.DATABASE_URL);
    const { assigneeId } = c.req.param();
    const assigneeTasks = await tasksDomain.findByAssignee(assigneeId);
    return c.json(assigneeTasks);
  } catch (error) {
    console.error('Error fetching tasks by assignee:', error);
    return c.json({ error: 'Failed to fetch tasks' }, 500);
  }
});

export default app;