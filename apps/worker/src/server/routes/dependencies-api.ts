/**
 * Dependencies API Routes
 * 
 * Provides REST API endpoints for managing task/project dependencies
 * for Gantt chart functionality with the 4 classic dependency types.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { DependencyManager } from '../dataforge';
import type { DependencyType, DependencyDefinition } from '../dataforge';
import { createKyselyForPersistentUse } from '../lib/database-manager';

const dependenciesRouter = new Hono();

// Validation schemas
const DependencyTypeSchema = z.enum(['finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish']);

// Only Project, Task, and Activity entities support dependencies (have temporal aspects)
const ValidEntityTypeSchema = z.enum(['Project', 'Task', 'Activity'], {
  errorMap: () => ({ message: 'Dependencies are only supported for Project, Task, and Activity entities' })
});

const CreateDependencySchema = z.object({
  sourceEntityId: z.string().min(1, 'Source entity ID is required'),
  targetEntityId: z.string().min(1, 'Target entity ID is required'),
  sourceEntityType: ValidEntityTypeSchema.default('Task'),
  targetEntityType: ValidEntityTypeSchema.default('Task'),
  dependencyType: DependencyTypeSchema,
  leadLagDays: z.number().int().optional().default(0),
  isHardConstraint: z.boolean().optional().default(true),
  description: z.string().optional()
});

const UpdateDependencySchema = z.object({
  dependencyType: DependencyTypeSchema.optional(),
  leadLagDays: z.number().int().optional(),
  isHardConstraint: z.boolean().optional(),
  description: z.string().optional()
});

// Create a new dependency
dependenciesRouter.post(
  '/orgs/:orgId/dependencies',
  zValidator('json', CreateDependencySchema),
  async (c) => {
    try {
      const orgId = c.req.param('orgId');
      const dependencyData = c.req.valid('json');
      const kysely = createKyselyForPersistentUse(c.env);

      // TODO: Get user ID from auth context
      const createdBy = 'system'; // Placeholder

      await DependencyManager.createDependency(
        kysely,
        orgId,
        dependencyData as DependencyDefinition,
        createdBy
      );

      return c.json({
        success: true,
        message: 'Dependency created successfully',
        data: {
          dependency: dependencyData,
          dependencyTypeDescription: DependencyManager.getDependencyTypeDescription(dependencyData.dependencyType)
        }
      });
    } catch (error) {
      console.error('Error creating dependency:', error);
      return c.json({
        success: false,
        error: 'Failed to create dependency',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 400);
    }
  }
);

// Get all dependencies for a specific entity
dependenciesRouter.get(
  '/orgs/:orgId/dependencies/:entityId',
  async (c) => {
    try {
      const orgId = c.req.param('orgId');
      const entityId = c.req.param('entityId');
      const entityType = c.req.query('entityType') || 'Task';
      
      // Validate entity type supports dependencies
      const validationResult = ValidEntityTypeSchema.safeParse(entityType);
      if (!validationResult.success) {
        return c.json({
          success: false,
          error: 'Invalid entity type for dependencies',
          details: 'Dependencies are only supported for Project, Task, and Activity entities'
        }, 400);
      }
      
      const kysely = createKyselyForPersistentUse(c.env);

      const dependencies = await DependencyManager.getDependencies(kysely, orgId, entityId, entityType);

      return c.json({
        success: true,
        data: dependencies.map(dep => ({
          ...dep,
          dependencyTypeDescription: DependencyManager.getDependencyTypeDescription(dep.dependencyType)
        })),
        metadata: {
          entityId,
          entityType,
          dependencyCount: dependencies.length
        }
      });
    } catch (error) {
      console.error('Error fetching dependencies:', error);
      return c.json({
        success: false,
        error: 'Failed to fetch dependencies',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// Get predecessors (what this entity depends on)
dependenciesRouter.get(
  '/orgs/:orgId/dependencies/:entityId/predecessors',
  async (c) => {
    try {
      const orgId = c.req.param('orgId');
      const entityId = c.req.param('entityId');
      const entityType = c.req.query('entityType') || 'Task';
      
      // Validate entity type supports dependencies
      const validationResult = ValidEntityTypeSchema.safeParse(entityType);
      if (!validationResult.success) {
        return c.json({
          success: false,
          error: 'Invalid entity type for dependencies',
          details: 'Dependencies are only supported for Project, Task, and Activity entities'
        }, 400);
      }
      
      const kysely = createKyselyForPersistentUse(c.env);

      const predecessors = await DependencyManager.getPredecessors(kysely, orgId, entityId, entityType);

      return c.json({
        success: true,
        data: predecessors.map(dep => ({
          ...dep,
          dependencyTypeDescription: DependencyManager.getDependencyTypeDescription(dep.dependencyType)
        })),
        metadata: {
          entityId,
          entityType,
          predecessorCount: predecessors.length
        }
      });
    } catch (error) {
      console.error('Error fetching predecessors:', error);
      return c.json({
        success: false,
        error: 'Failed to fetch predecessors',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// Get successors (what depends on this entity)
dependenciesRouter.get(
  '/orgs/:orgId/dependencies/:entityId/successors',
  async (c) => {
    try {
      const orgId = c.req.param('orgId');
      const entityId = c.req.param('entityId');
      const entityType = c.req.query('entityType') || 'Task';
      
      // Validate entity type supports dependencies
      const validationResult = ValidEntityTypeSchema.safeParse(entityType);
      if (!validationResult.success) {
        return c.json({
          success: false,
          error: 'Invalid entity type for dependencies',
          details: 'Dependencies are only supported for Project, Task, and Activity entities'
        }, 400);
      }
      
      const kysely = createKyselyForPersistentUse(c.env);

      const successors = await DependencyManager.getSuccessors(kysely, orgId, entityId, entityType);

      return c.json({
        success: true,
        data: successors.map(dep => ({
          ...dep,
          dependencyTypeDescription: DependencyManager.getDependencyTypeDescription(dep.dependencyType)
        })),
        metadata: {
          entityId,
          entityType,
          successorCount: successors.length
        }
      });
    } catch (error) {
      console.error('Error fetching successors:', error);
      return c.json({
        success: false,
        error: 'Failed to fetch successors',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// Update a dependency
dependenciesRouter.put(
  '/orgs/:orgId/dependencies/:dependencyId',
  zValidator('json', UpdateDependencySchema),
  async (c) => {
    try {
      const orgId = c.req.param('orgId');
      const dependencyId = c.req.param('dependencyId');
      const updates = c.req.valid('json');
      const kysely = createKyselyForPersistentUse(c.env);

      await DependencyManager.updateDependency(kysely, orgId, dependencyId, updates);

      return c.json({
        success: true,
        message: 'Dependency updated successfully',
        data: {
          dependencyId,
          updates,
          ...(updates.dependencyType && {
            dependencyTypeDescription: DependencyManager.getDependencyTypeDescription(updates.dependencyType)
          })
        }
      });
    } catch (error) {
      console.error('Error updating dependency:', error);
      return c.json({
        success: false,
        error: 'Failed to update dependency',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 400);
    }
  }
);

// Delete a dependency
dependenciesRouter.delete(
  '/orgs/:orgId/dependencies/:dependencyId',
  async (c) => {
    try {
      const orgId = c.req.param('orgId');
      const dependencyId = c.req.param('dependencyId');
      const kysely = createKyselyForPersistentUse(c.env);

      await DependencyManager.removeDependency(kysely, orgId, dependencyId);

      return c.json({
        success: true,
        message: 'Dependency removed successfully',
        data: { dependencyId }
      });
    } catch (error) {
      console.error('Error removing dependency:', error);
      return c.json({
        success: false,
        error: 'Failed to remove dependency',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 400);
    }
  }
);

// Get critical path for project (placeholder for future CPM implementation)
dependenciesRouter.get(
  '/orgs/:orgId/projects/:projectId/critical-path',
  async (c) => {
    try {
      const orgId = c.req.param('orgId');
      const projectId = c.req.param('projectId');
      const kysely = createKyselyForPersistentUse(c.env);

      const criticalPath = await DependencyManager.getCriticalPath(kysely, orgId, projectId);

      return c.json({
        success: true,
        data: criticalPath,
        metadata: {
          projectId,
          criticalPathLength: criticalPath.length,
          note: 'Critical path calculation is a placeholder - full CPM algorithm implementation pending'
        }
      });
    } catch (error) {
      console.error('Error calculating critical path:', error);
      return c.json({
        success: false,
        error: 'Failed to calculate critical path',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  }
);

// Get dependency type information
dependenciesRouter.get('/dependency-types', async (c) => {
  const dependencyTypes = [
    {
      type: 'finish_to_start',
      name: 'Finish to Start (FS)',
      description: DependencyManager.getDependencyTypeDescription('finish_to_start'),
      isDefault: true
    },
    {
      type: 'start_to_start', 
      name: 'Start to Start (SS)',
      description: DependencyManager.getDependencyTypeDescription('start_to_start'),
      isDefault: false
    },
    {
      type: 'finish_to_finish',
      name: 'Finish to Finish (FF)', 
      description: DependencyManager.getDependencyTypeDescription('finish_to_finish'),
      isDefault: false
    },
    {
      type: 'start_to_finish',
      name: 'Start to Finish (SF)',
      description: DependencyManager.getDependencyTypeDescription('start_to_finish'),
      isDefault: false
    }
  ];

  return c.json({
    success: true,
    data: dependencyTypes,
    metadata: {
      totalTypes: dependencyTypes.length,
      defaultType: 'finish_to_start'
    }
  });
});

export default dependenciesRouter;