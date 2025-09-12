/**
 * Lore and Canon System Entities API
 * 
 * RESTful API for managing Lore and Canon system entities.
 * These are system entities (like User) that provide semantic clarity
 * for AI extensions and knowledge management.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { withKysely } from '../lib/database-manager';
import { LoreCanonService } from '../services/LoreCanonService';
import type { 
  CreateLoreRequest, 
  CreateCanonRequest, 
  UpdateLoreRequest, 
  UpdateCanonRequest,
  LoreCanonQuery 
} from '../types/lore-canon-entities';

// Validation schemas for Lore
const CreateLoreSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().optional(),
  parent_entity_type: z.enum(['universe', 'world', 'project', 'task']),
  parent_entity_id: z.string().min(1),
  cultural_significance: z.number().min(0).max(100).optional(),
  emotional_resonance: z.enum(['inspiring', 'grounding', 'motivating', 'cautionary', 'celebratory']).optional(),
  purpose_clarity: z.number().min(0).max(100).optional(),
  alignment_score: z.number().min(0).max(100).optional()
});

const UpdateLoreSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().optional(),
  cultural_significance: z.number().min(0).max(100).optional(),
  emotional_resonance: z.enum(['inspiring', 'grounding', 'motivating', 'cautionary', 'celebratory']).optional(),
  purpose_clarity: z.number().min(0).max(100).optional(),
  alignment_score: z.number().min(0).max(100).optional()
});

// Validation schemas for Canon
const CreateCanonSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().optional(),
  parent_entity_type: z.enum(['universe', 'world', 'project', 'task']),
  parent_entity_id: z.string().min(1),
  rule_type: z.enum(['process', 'standard', 'requirement', 'boundary', 'guideline']).optional(),
  enforcement_level: z.enum(['must', 'should', 'may', 'must_not']).optional(),
  violation_consequence: z.string().optional(),
  compliance_level: z.number().min(0).max(100).optional(),
  alignment_score: z.number().min(0).max(100).optional()
});

const UpdateCanonSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().optional(),
  rule_type: z.enum(['process', 'standard', 'requirement', 'boundary', 'guideline']).optional(),
  enforcement_level: z.enum(['must', 'should', 'may', 'must_not']).optional(),
  violation_consequence: z.string().optional(),
  compliance_level: z.number().min(0).max(100).optional(),
  alignment_score: z.number().min(0).max(100).optional()
});

// Query parameters schema
const QuerySchema = z.object({
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
  order_by: z.enum(['created_at', 'updated_at', 'alignment_score', 'title']).optional(),
  order_direction: z.enum(['asc', 'desc']).optional()
});

const app = new Hono();

// ==========================================
// LORE ENDPOINTS
// ==========================================

/**
 * POST /orgs/:orgId/lore
 * Create a new lore entity
 */
app.post('/orgs/:orgId/lore', zValidator('json', CreateLoreSchema), async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const loreData = c.req.valid('json') as CreateLoreRequest;
    const user = c.get('user');

    const lore = await withKysely(async (kysely) => {
      const loreCanonService = new LoreCanonService(kysely);
      return await loreCanonService.createLore(orgId, loreData, user?.id);
    });

    return c.json({
      success: true,
      data: lore,
      message: `Lore '${loreData.title}' created successfully`
    }, 201);
  } catch (error) {
    console.error('Error creating lore:', error);
    return c.json({
      success: false,
      error: 'Failed to create lore',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /orgs/:orgId/lore/:loreId
 * Get a specific lore entity by ID
 */
app.get('/orgs/:orgId/lore/:loreId', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const loreId = c.req.param('loreId');

    const lore = await withKysely(async (kysely) => {
      const loreCanonService = new LoreCanonService(kysely);
      return await loreCanonService.getLoreById(orgId, loreId);
    });

    if (!lore) {
      return c.json({
        success: false,
        error: 'Lore not found'
      }, 404);
    }

    return c.json({
      success: true,
      data: lore
    });
  } catch (error) {
    console.error('Error getting lore:', error);
    return c.json({
      success: false,
      error: 'Failed to get lore',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /orgs/:orgId/lore
 * Get lore entities by parent entity (with query parameters)
 */
app.get('/orgs/:orgId/lore', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const parentType = c.req.query('parent_entity_type');
    const parentId = c.req.query('parent_entity_id');
    
    // Parse query parameters
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined;
    const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : undefined;
    const order_by = c.req.query('order_by') as LoreCanonQuery['order_by'];
    const order_direction = c.req.query('order_direction') as LoreCanonQuery['order_direction'];

    if (!parentType || !parentId) {
      return c.json({
        success: false,
        error: 'parent_entity_type and parent_entity_id query parameters are required'
      }, 400);
    }

    const query: LoreCanonQuery = {
      limit,
      offset,
      order_by,
      order_direction
    };

    const lore = await withKysely(async (kysely) => {
      const loreCanonService = new LoreCanonService(kysely);
      return await loreCanonService.getLoreByParent(orgId, parentType, parentId, query);
    });

    return c.json({
      success: true,
      data: lore,
      count: lore.length
    });
  } catch (error) {
    console.error('Error getting lore:', error);
    return c.json({
      success: false,
      error: 'Failed to get lore',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * PUT /orgs/:orgId/lore/:loreId
 * Update a lore entity
 */
app.put('/orgs/:orgId/lore/:loreId', zValidator('json', UpdateLoreSchema), async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const loreId = c.req.param('loreId');
    const updates = c.req.valid('json') as Partial<UpdateLoreRequest>;

    const lore = await withKysely(async (kysely) => {
      const loreCanonService = new LoreCanonService(kysely);
      return await loreCanonService.updateLore(orgId, loreId, updates);
    });

    return c.json({
      success: true,
      data: lore,
      message: 'Lore updated successfully'
    });
  } catch (error) {
    console.error('Error updating lore:', error);
    return c.json({
      success: false,
      error: 'Failed to update lore',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * DELETE /orgs/:orgId/lore/:loreId
 * Delete a lore entity
 */
app.delete('/orgs/:orgId/lore/:loreId', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const loreId = c.req.param('loreId');

    await withKysely(async (kysely) => {
      const loreCanonService = new LoreCanonService(kysely);
      return await loreCanonService.deleteLore(orgId, loreId);
    });

    return c.json({
      success: true,
      message: 'Lore deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting lore:', error);
    return c.json({
      success: false,
      error: 'Failed to delete lore',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// ==========================================
// CANON ENDPOINTS
// ==========================================

/**
 * POST /orgs/:orgId/canon
 * Create a new canon entity
 */
app.post('/orgs/:orgId/canon', zValidator('json', CreateCanonSchema), async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const canonData = c.req.valid('json') as CreateCanonRequest;
    const user = c.get('user');

    const canon = await withKysely(async (kysely) => {
      const loreCanonService = new LoreCanonService(kysely);
      return await loreCanonService.createCanon(orgId, canonData, user?.id);
    });

    return c.json({
      success: true,
      data: canon,
      message: `Canon '${canonData.title}' created successfully`
    }, 201);
  } catch (error) {
    console.error('Error creating canon:', error);
    return c.json({
      success: false,
      error: 'Failed to create canon',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /orgs/:orgId/canon/:canonId
 * Get a specific canon entity by ID
 */
app.get('/orgs/:orgId/canon/:canonId', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const canonId = c.req.param('canonId');

    const canon = await withKysely(async (kysely) => {
      const loreCanonService = new LoreCanonService(kysely);
      return await loreCanonService.getCanonById(orgId, canonId);
    });

    if (!canon) {
      return c.json({
        success: false,
        error: 'Canon not found'
      }, 404);
    }

    return c.json({
      success: true,
      data: canon
    });
  } catch (error) {
    console.error('Error getting canon:', error);
    return c.json({
      success: false,
      error: 'Failed to get canon',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /orgs/:orgId/canon
 * Get canon entities by parent entity (with query parameters)
 */
app.get('/orgs/:orgId/canon', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const parentType = c.req.query('parent_entity_type');
    const parentId = c.req.query('parent_entity_id');
    
    // Parse query parameters
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined;
    const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : undefined;
    const order_by = c.req.query('order_by') as LoreCanonQuery['order_by'];
    const order_direction = c.req.query('order_direction') as LoreCanonQuery['order_direction'];

    if (!parentType || !parentId) {
      return c.json({
        success: false,
        error: 'parent_entity_type and parent_entity_id query parameters are required'
      }, 400);
    }

    const query: LoreCanonQuery = {
      limit,
      offset,
      order_by,
      order_direction
    };

    const canon = await withKysely(async (kysely) => {
      const loreCanonService = new LoreCanonService(kysely);
      return await loreCanonService.getCanonByParent(orgId, parentType, parentId, query);
    });

    return c.json({
      success: true,
      data: canon,
      count: canon.length
    });
  } catch (error) {
    console.error('Error getting canon:', error);
    return c.json({
      success: false,
      error: 'Failed to get canon',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * PUT /orgs/:orgId/canon/:canonId
 * Update a canon entity
 */
app.put('/orgs/:orgId/canon/:canonId', zValidator('json', UpdateCanonSchema), async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const canonId = c.req.param('canonId');
    const updates = c.req.valid('json') as Partial<UpdateCanonRequest>;

    const canon = await withKysely(async (kysely) => {
      const loreCanonService = new LoreCanonService(kysely);
      return await loreCanonService.updateCanon(orgId, canonId, updates);
    });

    return c.json({
      success: true,
      data: canon,
      message: 'Canon updated successfully'
    });
  } catch (error) {
    console.error('Error updating canon:', error);
    return c.json({
      success: false,
      error: 'Failed to update canon',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * DELETE /orgs/:orgId/canon/:canonId
 * Delete a canon entity
 */
app.delete('/orgs/:orgId/canon/:canonId', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const canonId = c.req.param('canonId');

    await withKysely(async (kysely) => {
      const loreCanonService = new LoreCanonService(kysely);
      return await loreCanonService.deleteCanon(orgId, canonId);
    });

    return c.json({
      success: true,
      message: 'Canon deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting canon:', error);
    return c.json({
      success: false,
      error: 'Failed to delete canon',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// ==========================================
// COMBINED OPERATIONS
// ==========================================

/**
 * GET /orgs/:orgId/knowledge
 * Get both lore and canon for a parent entity
 */
app.get('/orgs/:orgId/knowledge', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const parentType = c.req.query('parent_entity_type');
    const parentId = c.req.query('parent_entity_id');
    
    // Parse query parameters
    const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined;
    const offset = c.req.query('offset') ? parseInt(c.req.query('offset')!) : undefined;
    const order_by = c.req.query('order_by') as LoreCanonQuery['order_by'];
    const order_direction = c.req.query('order_direction') as LoreCanonQuery['order_direction'];

    if (!parentType || !parentId) {
      return c.json({
        success: false,
        error: 'parent_entity_type and parent_entity_id query parameters are required'
      }, 400);
    }

    const query: LoreCanonQuery = {
      limit,
      offset,
      order_by,
      order_direction
    };

    const knowledge = await withKysely(async (kysely) => {
      const loreCanonService = new LoreCanonService(kysely);
      return await loreCanonService.getLoreAndCanonByParent(orgId, parentType, parentId, query);
    });

    return c.json({
      success: true,
      data: knowledge,
      counts: {
        lore: knowledge.lore.length,
        canon: knowledge.canon.length,
        total: knowledge.lore.length + knowledge.canon.length
      }
    });
  } catch (error) {
    console.error('Error getting knowledge:', error);
    return c.json({
      success: false,
      error: 'Failed to get knowledge',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /orgs/:orgId/knowledge/stats
 * Get knowledge statistics for an organization or specific parent entity
 */
app.get('/orgs/:orgId/knowledge/stats', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const parentType = c.req.query('parent_entity_type');
    const parentId = c.req.query('parent_entity_id');

    const stats = await withKysely(async (kysely) => {
      const loreCanonService = new LoreCanonService(kysely);
      return await loreCanonService.getKnowledgeStats(orgId, parentType, parentId);
    });

    return c.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting knowledge stats:', error);
    return c.json({
      success: false,
      error: 'Failed to get knowledge stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /orgs/:orgId/knowledge/:entityType/:entityId/increment-usage
 * Increment AI usage count for a lore or canon entity
 */
app.post('/orgs/:orgId/knowledge/:entityType/:entityId/increment-usage', async (c) => {
  try {
    const orgId = c.req.param('orgId');
    const entityType = c.req.param('entityType');
    const entityId = c.req.param('entityId');

    if (entityType !== 'lore' && entityType !== 'canon') {
      return c.json({
        success: false,
        error: 'entityType must be either "lore" or "canon"'
      }, 400);
    }

    await withKysely(async (kysely) => {
      const loreCanonService = new LoreCanonService(kysely);
      return await loreCanonService.incrementAIUsage(orgId, entityType, entityId);
    });

    return c.json({
      success: true,
      message: `AI usage count incremented for ${entityType} entity`
    });
  } catch (error) {
    console.error('Error incrementing AI usage:', error);
    return c.json({
      success: false,
      error: 'Failed to increment AI usage',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;