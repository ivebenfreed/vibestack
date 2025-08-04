import { Hono } from 'hono';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { ApiEnv, createSuccessResponse, createErrorResponse } from '../types/api';
import { serverLogger as log } from '../middleware/logger';
import { EntityDependency, DependencyType } from '@repo/dataforge/server-entities';
import { NeonService } from '../lib/neon-orm/neon-service';
import { EntityDependencyRepository } from '../domains/entity-dependencies';

const MODULE_NAME = 'entity-dependencies-api';

// Validation schemas
const CreateEntityDependencySchema = z.object({
  entityType: z.string().min(1),
  predecessorId: z.string().uuid(),
  successorId: z.string().uuid(),
  type: z.nativeEnum(DependencyType),
  lagTime: z.string().optional(),
  lagDays: z.number().optional(),
  metadata: z.record(z.any()).optional(),
  description: z.string().optional()
});

const UpdateEntityDependencySchema = z.object({
  type: z.nativeEnum(DependencyType).optional(),
  lagTime: z.string().optional(),
  lagDays: z.number().optional(),
  metadata: z.record(z.any()).optional(),
  description: z.string().optional()
});

// Router
export const entityDependencies = new Hono<ApiEnv>()

  // Get all dependencies for an entity
  .get('/:entityType/:entityId/dependencies', async (c) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }
    
    try {
      const { entityType, entityId } = c.req.param();
      const neonService = new NeonService(c);
      const entityDependencyRepo = new EntityDependencyRepository(neonService);
      
      const dependencies = await entityDependencyRepo.getDependenciesForEntity(entityType, entityId);
      
      log.debug(`Retrieved ${dependencies.length} dependencies for entity`, { 
        entityType, 
        entityId, 
        count: dependencies.length 
      }, MODULE_NAME);
      
      return c.json({ dependencies });
    } catch (error: any) {
      log.error('Failed to get dependencies', error, { context: MODULE_NAME });
      throw new HTTPException(500, { message: 'Failed to get dependencies' });
    }
  })

  // Get all dependents for an entity
  .get('/:entityType/:entityId/dependents', async (c) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }
    
    try {
      const { entityType, entityId } = c.req.param();
      const neonService = new NeonService(c);
      const entityDependencyRepo = new EntityDependencyRepository(neonService);
      
      const dependents = await entityDependencyRepo.getDependentsForEntity(entityType, entityId);
      
      log.debug(`Retrieved ${dependents.length} dependents for entity`, { 
        entityType, 
        entityId, 
        count: dependents.length 
      }, MODULE_NAME);
      
      return c.json({ dependents });
    } catch (error: any) {
      log.error('Failed to get dependents', error, { context: MODULE_NAME });
      throw new HTTPException(500, { message: 'Failed to get dependents' });
    }
  })

  // Get all task dependencies in a project
  .get('/tasks/project/:projectId', async (c) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }
    
    try {
      const projectId = c.req.param('projectId');
      const neonService = new NeonService(c);
      const entityDependencyRepo = new EntityDependencyRepository(neonService);
      
      const dependencies = await entityDependencyRepo.getTaskDependenciesForProject(projectId);
      
      log.debug(`Retrieved ${dependencies.length} task dependencies for project`, { 
        projectId, 
        count: dependencies.length 
      }, MODULE_NAME);
      
      return c.json({ dependencies });
    } catch (error: any) {
      log.error('Failed to get project task dependencies', error, { context: MODULE_NAME });
      throw new HTTPException(500, { message: 'Failed to get project task dependencies' });
    }
  })

  // Create a new dependency
  .post('/', async (c) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }
    
    try {
      const body = await c.req.json();
      
      // Validate input
      const validated = CreateEntityDependencySchema.parse(body);
      const neonService = new NeonService(c);
      const entityDependencyRepo = new EntityDependencyRepository(neonService);
      
      // Create with validation
      const dependency = await entityDependencyRepo.createSafely({
        ...validated,
        clientId: (validated as any).clientId || undefined
      });
      
      log.info('Created entity dependency', { 
        dependencyId: dependency.id,
        entityType: dependency.entityType,
        predecessorId: dependency.predecessorId,
        successorId: dependency.successorId
      }, MODULE_NAME);
      
      return c.json({ dependency }, 201);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        log.warn('Validation failed', { errors: error.errors }, MODULE_NAME);
        throw new HTTPException(400, { message: 'Invalid dependency data' });
      }
      
      // Specific error cases
      if (error.message.includes('cycle')) {
        throw new HTTPException(400, { message: 'Dependency would create a cycle' });
      }
      if (error.message.includes('already exists')) {
        throw new HTTPException(400, { message: 'Dependency already exists' });
      }
      if (error.message.includes('cannot depend on itself')) {
        throw new HTTPException(400, { message: 'Entity cannot depend on itself' });
      }
      
      log.error('Failed to create dependency', error, { context: MODULE_NAME });
      throw new HTTPException(500, { message: 'Failed to create dependency' });
    }
  })

  // Update a dependency
  .patch('/:id', async (c) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }
    
    try {
      const id = c.req.param('id');
      const body = await c.req.json();
      
      // Validate input
      const validated = UpdateEntityDependencySchema.parse(body);
      const neonService = new NeonService(c);
      const entityDependencyRepo = new EntityDependencyRepository(neonService);
      
      // Update the dependency
      const dependency = await entityDependencyRepo.update(id, validated);
      
      if (!dependency) {
        throw new HTTPException(404, { message: 'Dependency not found' });
      }
      
      log.info('Updated entity dependency', { 
        dependencyId: id,
        updates: Object.keys(validated)
      }, MODULE_NAME);
      
      return c.json({ dependency });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        log.warn('Validation failed', { errors: error.errors }, MODULE_NAME);
        throw new HTTPException(400, { message: 'Invalid update data' });
      }
      
      if (error instanceof HTTPException) {
        throw error;
      }
      
      log.error('Failed to update dependency', error, { context: MODULE_NAME });
      throw new HTTPException(500, { message: 'Failed to update dependency' });
    }
  })

  // Delete a dependency
  .delete('/:id', async (c) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }
    
    try {
      const id = c.req.param('id');
      const neonService = new NeonService(c);
      const entityDependencyRepo = new EntityDependencyRepository(neonService);
      
      const deleted = await entityDependencyRepo.delete(id);
      
      if (!deleted) {
        throw new HTTPException(404, { message: 'Dependency not found' });
      }
      
      log.info('Deleted entity dependency', { dependencyId: id }, MODULE_NAME);
      
      return c.json({ success: true });
    } catch (error: any) {
      if (error instanceof HTTPException) {
        throw error;
      }
      
      log.error('Failed to delete dependency', error, { context: MODULE_NAME });
      throw new HTTPException(500, { message: 'Failed to delete dependency' });
    }
  })

  // Check if a dependency would create a cycle
  .post('/check-cycle', async (c) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }
    
    try {
      const body = await c.req.json();
      const { entityType, predecessorId, successorId } = body;
      
      if (!entityType || !predecessorId || !successorId) {
        throw new HTTPException(400, { message: 'Missing required fields' });
      }
      
      const neonService = new NeonService(c);
      const entityDependencyRepo = new EntityDependencyRepository(neonService);
      const wouldCycle = await entityDependencyRepo.wouldCreateCycle(
        entityType,
        predecessorId,
        successorId
      );
      
      log.debug('Cycle check completed', { 
        entityType,
        predecessorId,
        successorId,
        wouldCycle 
      }, MODULE_NAME);
      
      return c.json({ wouldCycle });
    } catch (error: any) {
      if (error instanceof HTTPException) {
        throw error;
      }
      
      log.error('Failed to check for cycles', error, { context: MODULE_NAME });
      throw new HTTPException(500, { message: 'Failed to check for cycles' });
    }
  });

// Backward compatibility endpoints for task dependencies
export const taskDependencies = new Hono<ApiEnv>()
  
  // Redirect old endpoints to new ones
  .get('/:taskId/dependencies', async (c) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }
    // Create a new request to the entity dependencies endpoint
    const taskId = c.req.param('taskId');
    const response = await fetch(new URL(`/api/entity-dependencies/task/${taskId}/dependencies`, c.req.url).toString(), {
      method: 'GET',
      headers: c.req.raw.headers
    });
    return response;
  })
  
  .get('/:taskId/dependents', async (c) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }
    // Create a new request to the entity dependencies endpoint
    const taskId = c.req.param('taskId');
    const response = await fetch(new URL(`/api/entity-dependencies/task/${taskId}/dependents`, c.req.url).toString(), {
      method: 'GET',
      headers: c.req.raw.headers
    });
    return response;
  })
  
  .get('/project/:projectId', async (c) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }
    // Create a new request to the entity dependencies endpoint
    const projectId = c.req.param('projectId');
    const response = await fetch(new URL(`/api/entity-dependencies/tasks/project/${projectId}`, c.req.url).toString(), {
      method: 'GET',
      headers: c.req.raw.headers
    });
    return response;
  });