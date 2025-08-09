import { Hono } from 'hono';
import { usersDomain } from '../domains/users-drizzle.js';
import { requireAuth } from '../middleware/auth.js';
import type { Env } from '../types/env.js';

const app = new Hono<{ Bindings: Env }>();

// Require authentication for all routes
app.use('*', requireAuth);

// GET /users - Get all users (read-only)
app.get('/', async (c) => {
  try {
    const { role, verified } = c.req.query();
    
    let users;
    if (role) {
      users = await usersDomain.findByRole(role);
    } else if (verified === 'true') {
      users = await usersDomain.findVerified();
    } else {
      users = await usersDomain.findAll();
    }
    
    return c.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

// GET /users/:id - Get user by ID (read-only)
app.get('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const user = await usersDomain.findById(id);
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    return c.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return c.json({ error: 'Failed to fetch user' }, 500);
  }
});

// GET /users/email/:email - Get user by email (read-only)
app.get('/email/:email', async (c) => {
  try {
    const { email } = c.req.param();
    const user = await usersDomain.findByEmail(email);
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    return c.json(user);
  } catch (error) {
    console.error('Error fetching user by email:', error);
    return c.json({ error: 'Failed to fetch user' }, 500);
  }
});

// GET /users/:id/tasks - Get user's assigned tasks
app.get('/:id/tasks', async (c) => {
  try {
    const { id } = c.req.param();
    const result = await usersDomain.findWithTasks(id);
    
    if (!result) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    return c.json(result.tasks);
  } catch (error) {
    console.error('Error fetching user tasks:', error);
    return c.json({ error: 'Failed to fetch user tasks' }, 500);
  }
});

// GET /users/:id/projects - Get user's projects
app.get('/:id/projects', async (c) => {
  try {
    const { id } = c.req.param();
    const result = await usersDomain.findWithProjects(id);
    
    if (!result) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    return c.json(result.projects);
  } catch (error) {
    console.error('Error fetching user projects:', error);
    return c.json({ error: 'Failed to fetch user projects' }, 500);
  }
});

// NOTE: No POST, PUT, DELETE endpoints - Better Auth handles user management

export default app;