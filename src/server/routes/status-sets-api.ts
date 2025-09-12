/**
 * Status Set Management API
 * 
 * RESTful API for managing reusable status sets within organizations.
 * Provides CRUD operations, validation, and status set assignment to entities.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { withKysely } from '../lib/database-manager';
import { StatusSetManager, type StatusValue } from '../dataforge/services/StatusSetManager';

// Validation schemas
const StatusValueSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.string().min(1),
  workflowCategory: z.enum(['not_active', 'in_progress', 'done', 'closed'])
});

const CreateStatusSetSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  entityType: z.string().optional(),
  statusValues: z.array(StatusValueSchema).min(1)
});

const UpdateStatusSetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  statusValues: z.array(StatusValueSchema).min(1).optional()
});

const AssignStatusSetSchema = z.object({
  statusSetId: z.string().uuid(),
  fieldName: z.string().min(1).default('status')
});

const app = new Hono();

// StatusSetManager will be initialized within withKysely calls

/**
 * GET /orgs/:orgId/status-sets
 * Get all status sets for an organization
 */
app.get('/orgs/:orgId/status-sets', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const entityType = c.req.query('entityType');
    
    const statusSets = await withKysely(async (kysely) => {
      const statusSetManager = new StatusSetManager(kysely);
      return await statusSetManager.getStatusSets(orgId, entityType);
    });
    
    return c.json({
      success: true,
      data: statusSets,
      count: statusSets.length
    });
  } catch (error) {
    console.error('Error getting status sets:', error);
    return c.json({
      success: false,
      error: 'Failed to get status sets',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /:orgId/status-sets/:statusSetId
 * Get a specific status set
 */
app.get('/orgs/:orgId/status-sets/:statusSetId', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const statusSetId = c.req.param('statusSetId');
    
    const statusSet = await withKysely(async (kysely) => {
      const statusSetManager = new StatusSetManager(kysely);
      return await statusSetManager.getStatusSet(orgId, statusSetId);
    });
    
    if (!statusSet) {
      return c.json({
        success: false,
        error: 'Status set not found'
      }, 404);
    }
    
    return c.json({
      success: true,
      data: statusSet
    });
  } catch (error) {
    console.error('Error getting status set:', error);
    return c.json({
      success: false,
      error: 'Failed to get status set',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /:orgId/status-sets
 * Create a new status set
 */
app.post('/orgs/:orgId/status-sets', zValidator('json', CreateStatusSetSchema), async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const { name, description, entityType, statusValues } = c.req.valid('json');
    const user = c.get('user');
    
    const statusSet = await withKysely(async (kysely) => {
      const statusSetManager = new StatusSetManager(kysely);
      return await statusSetManager.createStatusSet(
        orgId,
        name,
        statusValues as StatusValue[],
        {
          description,
          entityType,
          createdBy: user?.id
        }
      );
    });
    
    return c.json({
      success: true,
      data: statusSet,
      message: `Status set '${name}' created successfully`
    }, 201);
  } catch (error) {
    console.error('Error creating status set:', error);
    return c.json({
      success: false,
      error: 'Failed to create status set',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * PUT /:orgId/status-sets/:statusSetId
 * Update an existing status set
 */
app.put('/orgs/:orgId/status-sets/:statusSetId', zValidator('json', UpdateStatusSetSchema), async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const statusSetId = c.req.param('statusSetId');
    const updates = c.req.valid('json');
    
    const statusSet = await withKysely(async (kysely) => {
      const statusSetManager = new StatusSetManager(kysely);
      return await statusSetManager.updateStatusSet(orgId, statusSetId, {
        name: updates.name,
        description: updates.description,
        statusValues: updates.statusValues as StatusValue[]
      });
    });
    
    return c.json({
      success: true,
      data: statusSet,
      message: 'Status set updated successfully'
    });
  } catch (error) {
    console.error('Error updating status set:', error);
    return c.json({
      success: false,
      error: 'Failed to update status set',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * DELETE /:orgId/status-sets/:statusSetId
 * Delete a status set (soft delete)
 */
app.delete('/orgs/:orgId/status-sets/:statusSetId', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const statusSetId = c.req.param('statusSetId');
    
    await withKysely(async (kysely) => {
      const statusSetManager = new StatusSetManager(kysely);
      return await statusSetManager.deleteStatusSet(orgId, statusSetId);
    });
    
    return c.json({
      success: true,
      message: 'Status set deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting status set:', error);
    return c.json({
      success: false,
      error: 'Failed to delete status set',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /:orgId/entities/:entityName/status-set
 * Assign a status set to an entity
 */
app.post('/orgs/:orgId/entities/:entityName/status-set', zValidator('json', AssignStatusSetSchema), async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const entityName = c.req.param('entityName');
    const { statusSetId, fieldName } = c.req.valid('json');
    const user = c.get('user');
    
    const assignment = await withKysely(async (kysely) => {
      const statusSetManager = new StatusSetManager(kysely);
      return await statusSetManager.assignStatusSetToEntity(
        orgId,
        entityName,
        statusSetId,
        fieldName,
        user?.id
      );
    });
    
    return c.json({
      success: true,
      data: assignment,
      message: `Status set assigned to entity '${entityName}' successfully`
    }, 201);
  } catch (error) {
    console.error('Error assigning status set:', error);
    return c.json({
      success: false,
      error: 'Failed to assign status set',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /:orgId/entities/:entityName/status-set
 * Get status set assignment for an entity
 */
app.get('/orgs/:orgId/entities/:entityName/status-set', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const entityName = c.req.param('entityName');
    const fieldName = c.req.query('fieldName') || 'status';
    
    const assignment = await withKysely(async (kysely) => {
      const statusSetManager = new StatusSetManager(kysely);
      return await statusSetManager.getEntityStatusSet(orgId, entityName, fieldName);
    });
    
    if (!assignment) {
      return c.json({
        success: false,
        error: 'No status set assigned to this entity'
      }, 404);
    }
    
    return c.json({
      success: true,
      data: assignment
    });
  } catch (error) {
    console.error('Error getting entity status set:', error);
    return c.json({
      success: false,
      error: 'Failed to get entity status set',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * DELETE /:orgId/entities/:entityName/status-set
 * Remove status set assignment from entity
 */
app.delete('/orgs/:orgId/entities/:entityName/status-set', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const entityName = c.req.param('entityName');
    const fieldName = c.req.query('fieldName') || 'status';
    
    await withKysely(async (kysely) => {
      const statusSetManager = new StatusSetManager(kysely);
      return await statusSetManager.removeStatusSetFromEntity(orgId, entityName, fieldName);
    });
    
    return c.json({
      success: true,
      message: `Status set removed from entity '${entityName}' successfully`
    });
  } catch (error) {
    console.error('Error removing status set:', error);
    return c.json({
      success: false,
      error: 'Failed to remove status set',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /:orgId/status-sets/copy-defaults
 * Copy system default status sets to organization
 */
app.post('/orgs/:orgId/status-sets/copy-defaults', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const entityType = c.req.query('entityType');
    
    const count = await withKysely(async (kysely) => {
      const statusSetManager = new StatusSetManager(kysely);
      return await statusSetManager.copySystemDefaultsToOrg(orgId, entityType);
    });
    
    return c.json({
      success: true,
      message: `Copied ${count} system default status sets to organization`,
      copiedCount: count
    });
  } catch (error) {
    console.error('Error copying system defaults:', error);
    return c.json({
      success: false,
      error: 'Failed to copy system defaults',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /:orgId/status-sets/:statusSetId/usage
 * Get entities using a specific status set
 */
app.get('/orgs/:orgId/status-sets/:statusSetId/usage', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const statusSetId = c.req.param('statusSetId');
    
    const usage = await withKysely(async (kysely) => {
      const statusSetManager = new StatusSetManager(kysely);
      return await statusSetManager.getStatusSetUsage(orgId, statusSetId);
    });
    
    return c.json({
      success: true,
      data: usage,
      count: usage.length
    });
  } catch (error) {
    console.error('Error getting status set usage:', error);
    return c.json({
      success: false,
      error: 'Failed to get status set usage',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;