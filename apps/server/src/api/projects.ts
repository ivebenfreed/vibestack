import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  type ApiEnv,
  ServiceErrorType,
  createSuccessResponse,
  createErrorResponse
} from '../types/api';
import { NeonService } from '../lib/neon-orm/neon-service';
import { ProjectRepository } from '../domains/projects';
import { ProjectStatus } from '@repo/dataforge/server-entities';
import type { Project } from '@repo/dataforge/server-entities';

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
      result = await projectRepo.findByOwnerId(ownerId as string);
    } else {
      result = await projectRepo.findAll();
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
    const created = await projectRepo.create({
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
      const isMember = await projectRepo.isUserProjectMember(projectId, user.id);
      if (!isMember) {
        return c.json(
          createErrorResponse(ServiceErrorType.FORBIDDEN, 'Access denied'),
          403
        );
      }
    }
    
    const input = await c.req.json<ProjectUpdateInput>();
    const updated = await projectRepo.update(projectId, input);
    
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
    
    await projectRepo.delete(projectId);
    
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
