import { Hono } from 'hono';
import { projectsDomain } from '../domains/projects-drizzle.js';
import { requireAuth } from '../middleware/auth.js';
import type { Env } from '../types/env.js';

const app = new Hono<{ Bindings: Env }>();

// Require authentication for all routes
app.use('*', requireAuth);

// GET /projects - Get all projects
app.get('/', async (c) => {
  try {
    const { status, ownerId } = c.req.query();
    
    let projects;
    if (status || ownerId) {
      // Use filtered queries if params provided
      if (status && ownerId) {
        projects = await projectsDomain.findByOwnerAndStatus(ownerId, status);
      } else if (status) {
        projects = await projectsDomain.findByStatus(status);
      } else {
        projects = await projectsDomain.findByOwner(ownerId);
      }
    } else {
      projects = await projectsDomain.findAll();
    }
    
    return c.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return c.json({ error: 'Failed to fetch projects' }, 500);
  }
});

// GET /projects/:id - Get project by ID
app.get('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const project = await projectsDomain.findWithRelations(id);
    
    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }
    
    return c.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    return c.json({ error: 'Failed to fetch project' }, 500);
  }
});

// POST /projects - Create new project
app.post('/', async (c) => {
  try {
    const data = await c.req.json();
    const user = c.get('user');
    
    // Set the owner to the current user if not provided
    const projectData = {
      ...data,
      ownerId: data.ownerId || user?.id
    };
    
    // System create - clears clientId
    const project = await projectsDomain.systemCreate(projectData);
    
    return c.json(project, 201);
  } catch (error) {
    console.error('Error creating project:', error);
    return c.json({ error: 'Failed to create project' }, 500);
  }
});

// PUT /projects/:id - Update project
app.put('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const data = await c.req.json();
    
    // System update - clears clientId
    const project = await projectsDomain.systemUpdate(id, data);
    
    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }
    
    return c.json(project);
  } catch (error) {
    console.error('Error updating project:', error);
    return c.json({ error: 'Failed to update project' }, 500);
  }
});

// DELETE /projects/:id - Delete project
app.delete('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    
    const success = await projectsDomain.delete(id);
    
    if (!success) {
      return c.json({ error: 'Project not found' }, 404);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return c.json({ error: 'Failed to delete project' }, 500);
  }
});

// GET /projects/:id/tasks - Get project tasks
app.get('/:id/tasks', async (c) => {
  try {
    const { id } = c.req.param();
    const tasks = await projectsDomain.getTasks(id);
    
    return c.json(tasks);
  } catch (error) {
    console.error('Error fetching project tasks:', error);
    return c.json({ error: 'Failed to fetch project tasks' }, 500);
  }
});

// GET /projects/:id/members - Get project members
app.get('/:id/members', async (c) => {
  try {
    const { id } = c.req.param();
    const members = await projectsDomain.getMembers(id);
    
    return c.json(members);
  } catch (error) {
    console.error('Error fetching project members:', error);
    return c.json({ error: 'Failed to fetch project members' }, 500);
  }
});

// POST /projects/:id/members - Add project member
app.post('/:id/members', async (c) => {
  try {
    const { id } = c.req.param();
    const { userId, role } = await c.req.json();
    
    await projectsDomain.addMember(id, userId, role);
    
    return c.json({ success: true }, 201);
  } catch (error) {
    console.error('Error adding project member:', error);
    return c.json({ error: 'Failed to add project member' }, 500);
  }
});

// DELETE /projects/:id/members/:userId - Remove project member
app.delete('/:id/members/:userId', async (c) => {
  try {
    const { id, userId } = c.req.param();
    
    await projectsDomain.removeMember(id, userId);
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Error removing project member:', error);
    return c.json({ error: 'Failed to remove project member' }, 500);
  }
});

export default app;