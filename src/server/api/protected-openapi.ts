import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { AppContext } from '../types/hono';

/**
 * Protected OpenAPI router for endpoints that require authentication
 * All routes mounted here will be protected by authentication middleware
 */
const protectedOpenAPIRouter = new OpenAPIHono<AppContext>();

// Simple test route to verify OpenAPI documentation generation
const testRoute = createRoute({
  method: 'get',
  path: '/test',
  tags: ['Test'],
  summary: 'Test endpoint',
  description: 'Simple test endpoint to verify OpenAPI documentation works',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
      description: 'Test response',
    },
  },
});

// Register all OpenAPI routes FIRST
protectedOpenAPIRouter.openapi(testRoute, (c) => {
  return c.json({ message: 'OpenAPI test endpoint working!' });
});

// =============================================================================
// ORGANIZATIONS ENDPOINTS
// =============================================================================

const listOrganizationsRoute = createRoute({
  method: 'get',
  path: '/organizations',
  tags: ['Organizations'],
  summary: 'List user organizations',
  description: 'Get a list of organizations the authenticated user belongs to',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            organizations: z.array(z.object({
              id: z.string().uuid().openapi({
                description: 'Resource ID',
                example: '01920000-1000-7000-8000-000000000001'
              }),
              name: z.string(),
              slug: z.string(),
              role: z.string().optional(),
              isDefault: z.boolean().optional(),
              lastUsed: z.boolean().optional(),
            })),
            defaultOrganizationId: z.string().uuid().nullable().optional(),
            lastUsedOrganizationId: z.string().uuid().nullable().optional(),
          }),
        },
      },
      description: 'List of user organizations with metadata',
    },
  },
});

protectedOpenAPIRouter.openapi(listOrganizationsRoute, async (c) => {
  // Forward to existing organizations endpoint logic
  const { OrganizationService } = await import('../services/organization/OrganizationService');
  const user = c.get('user');
  
  try {
    const orgService = new OrganizationService(c);
    const result = await orgService.getOrganizationsByUser(user.id);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    // Get user's default organization info
    const { withKysely } = await import('../lib/database-manager');
    const userInfo = await withKysely(async (db) => {
      return await db
        .selectFrom('user')
        .select(['default_organization_id', 'last_used_organization_id', 'last_org_access_at'])
        .where('id', '=', user.id)
        .executeTakeFirst();
    });

    // Enhance organization data with user context
    const enhancedOrgs = result.data.map((org: any) => ({
      ...org,
      isDefault: org.id === userInfo?.default_organization_id,
      lastUsed: org.id === userInfo?.last_used_organization_id
    }));

    return c.json({
      organizations: enhancedOrgs,
      defaultOrganizationId: userInfo?.default_organization_id,
      lastUsedOrganizationId: userInfo?.last_used_organization_id
    });

  } catch (error) {
    console.error('Error in OpenAPI organizations endpoint:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// =============================================================================
// UNIVERSE ENDPOINTS
// =============================================================================

const getCompleteUniverseRoute = createRoute({
  method: 'get',
  path: '/universe/complete',
  tags: ['Universe'],
  summary: 'Get complete user universe',
  description: 'Get all organizations (worlds), projects, teams, and metadata for the authenticated user',
  request: {
    query: z.object({
      includeInactive: z.enum(['true', 'false']).optional().default('false'),
      includeArchived: z.enum(['true', 'false']).optional().default('false'), 
      includeCounts: z.enum(['true', 'false']).optional().default('true'),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            worlds: z.array(z.object({
              id: z.string().uuid().openapi({
                description: 'Resource ID',
                example: '01920000-1000-7000-8000-000000000001'
              }),
              name: z.string(),
              slug: z.string(),
              type: z.string().optional(),
              lore: z.string().nullable().optional(),
              canon: z.any().optional(), // JSONB field
              role: z.string(),
              projectCount: z.number().optional(),
              teams: z.array(z.any()).optional(),
            })),
            summary: z.object({
              totalWorlds: z.number(),
              activeWorlds: z.number(),
              totalProjects: z.number(),
              totalTeams: z.number(),
            }),
          }),
        },
      },
      description: 'Complete user universe with all worlds and metadata',
    },
  },
});

protectedOpenAPIRouter.openapi(getCompleteUniverseRoute, async (c) => {
  // Forward to existing universe complete endpoint
  const query = c.req.valid('query');
  const includeInactive = query.includeInactive === 'true';
  const includeArchived = query.includeArchived === 'true';
  const includeCounts = query.includeCounts === 'true';
  
  const user = c.get('user');
  const userId = user.id;

  try {
    const { withKysely } = await import('../lib/database-manager');
    
    // Get all organizations user belongs to (these ARE worlds now)
    const userOrganizations = await withKysely(async (db) => {
      return await db
        .selectFrom('organization_members as om')
        .innerJoin('organizations as o', 'o.id', 'om.organization_id')
        .select([
          'o.id',
          'o.name', 
          'o.slug',
          'o.type',
          'o.lore',
          'o.canon',
          'om.role',
          'om.created_at as joined_at'
        ])
        .where('om.user_id', '=', userId)
        .execute();
    });

    // Get project counts if requested
    let projectCounts: any[] = [];
    if (includeCounts && userOrganizations.length > 0) {
      const orgIds = userOrganizations.map(org => org.id);
      projectCounts = await withKysely(async (db) => {
        return await db
          .selectFrom('projects as p')
          .select(['p.organization_id', db.fn.count('p.id').as('project_count')])
          .where('p.organization_id', 'in', orgIds)
          .groupBy('p.organization_id')
          .execute();
      });
    }

    // Get team memberships if requested
    let teamMemberships: any[] = [];
    if (includeCounts && userOrganizations.length > 0) {
      const orgIds = userOrganizations.map(org => org.id);
      teamMemberships = await withKysely(async (db) => {
        return await db
          .selectFrom('team_memberships as tm')
          .innerJoin('teams as t', 't.id', 'tm.team_id')
          .select([
            'tm.role as team_role',
            't.id as team_id',
            't.organization_id',
            't.name as team_name',
            't.description as team_description',
            't.team_type'
          ])
          .where('tm.user_id', '=', userId)
          .where('t.organization_id', 'in', orgIds)
          .execute();
      });
    }

    // Combine data
    const worlds = userOrganizations.map(org => {
      const projectCount = projectCounts.find(pc => pc.organization_id === org.id)?.project_count || 0;
      const orgTeams = teamMemberships.filter(tm => tm.organization_id === org.id);
      
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        type: org.type || 'business',
        lore: org.lore,
        canon: org.canon,
        role: org.role,
        projectCount: Number(projectCount),
        teams: orgTeams
      };
    });

    const summary = {
      totalWorlds: worlds.length,
      activeWorlds: worlds.length, // For now, all are active
      totalProjects: projectCounts.reduce((sum, pc) => sum + Number(pc.project_count || 0), 0),
      totalTeams: teamMemberships.length
    };

    return c.json({
      worlds,
      summary
    });

  } catch (error) {
    console.error('Error in OpenAPI universe complete endpoint:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// =============================================================================
// DATAFORGE ENDPOINTS (Key ones for discoverability)
// =============================================================================

const listDataForgeEntitiesRoute = createRoute({
  method: 'get',
  path: '/dataforge/orgs/{orgId}/entities',
  tags: ['DataForge'],
  summary: 'List organization entities',
  description: 'Get all entity schemas for an organization',
  request: {
    params: z.object({
      orgId: z.string().uuid().openapi({
        description: 'Organization ID',
        example: '01920000-1000-7000-8000-000000000001'
      }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              entities: z.array(z.object({
                entityName: z.string(),
                tableName: z.string(),
                archetype: z.string(),
                fieldCount: z.number(),
                createdAt: z.string(),
                updatedAt: z.string(),
                syncable: z.boolean(),
              })),
              total: z.number(),
            }),
          }),
        },
      },
      description: 'List of organization entities',
    },
  },
});

// REMOVED - Actual implementation is in dataforge-api.ts
// protectedOpenAPIRouter.openapi(listDataForgeEntitiesRoute, async (c) => {});

const createDataForgeEntityRoute = createRoute({
  method: 'post',
  path: '/dataforge/orgs/{orgId}/entities',
  tags: ['DataForge'],
  summary: 'Create new entity',
  description: 'Create a new entity with DataForge archetype',
  request: {
    params: z.object({
      orgId: z.string().uuid().openapi({
        description: 'Organization ID',
        example: '01920000-1000-7000-8000-000000000001'
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            entityName: z.string(),
            archetype: z.enum(['project', 'task', 'record', 'document', 'file', 'activity', 'discussion', 'collection']),
            customFields: z.array(z.object({
              name: z.string(),
              type: z.string(),
              required: z.boolean().optional(),
              syncable: z.boolean().optional(),
            })).optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            entity: z.object({
              orgId: z.string().uuid().openapi({
                param: { name: 'orgId', in: 'path' },
                description: 'Organization ID',
                example: '01920000-1000-7000-8000-000000000001'
              }),
              entityName: z.string(),
              archetype: z.string(),
              tableName: z.string(),
              fields: z.array(z.any()),
            }),
            tableCreated: z.boolean(),
          }),
        },
      },
      description: 'Entity created successfully',
    },
  },
});
// REMOVED - Actual implementation is in dataforge-api.ts
// protectedOpenAPIRouter.openapi(createDataForgeEntityRoute, async (c) => {});

const getDataForgeEntityRoute = createRoute({
  method: 'get',
  path: '/dataforge/orgs/{orgId}/entities/{entityName}',
  tags: ['DataForge'],
  summary: 'Get entity details',
  description: 'Get detailed schema information about a specific entity',
  request: {
    params: z.object({
      orgId: z.string().uuid().openapi({
        description: 'Organization ID',
        example: '01920000-1000-7000-8000-000000000001'
      }),
      entityName: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              entityName: z.string(),
              tableName: z.string(),
              archetype: z.string(),
              fields: z.array(z.any()),
              createdAt: z.string(),
              updatedAt: z.string(),
            }),
          }),
        },
      },
      description: 'Entity details',
    },
  },
});
// REMOVED - Actual implementation is in dataforge-api.ts  
// protectedOpenAPIRouter.openapi(getDataForgeEntityRoute, async (c) => {});

const deleteDataForgeEntityRoute = createRoute({
  method: 'delete',
  path: '/dataforge/orgs/{orgId}/entities/{entityName}',
  tags: ['DataForge'],
  summary: 'Delete entity',
  description: 'Delete an entity and all its data (moves to trash)',
  request: {
    params: z.object({
      orgId: z.string().uuid().openapi({
        description: 'Organization ID',
        example: '01920000-1000-7000-8000-000000000001'
      }),
      entityName: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
      description: 'Entity deleted successfully',
    },
  },
});
// REMOVED - Actual implementation is in dataforge-api.ts
// protectedOpenAPIRouter.openapi(deleteDataForgeEntityRoute, async (c) => {});

const getDataForgeArchetypesRoute = createRoute({
  method: 'get',
  path: '/dataforge/orgs/{orgId}/archetypes',
  tags: ['DataForge'],
  summary: 'List available archetypes',
  description: 'Get all available entity archetypes with their field definitions',
  request: {
    params: z.object({
      orgId: z.string().uuid().openapi({
        description: 'Organization ID',
        example: '01920000-1000-7000-8000-000000000001'
      }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            archetypes: z.array(z.object({
              name: z.string(),
              description: z.string(),
              fields: z.array(z.any()),
              category: z.string(),
            })),
            count: z.number(),
          }),
        },
      },
      description: 'List of available archetypes',
    },
  },
});
// REMOVED - Actual implementation is in dataforge-api.ts
// protectedOpenAPIRouter.openapi(getDataForgeArchetypesRoute, async (c) => {});

const getDataForgeDataRoute = createRoute({
  method: 'get',
  path: '/dataforge/orgs/{orgId}/data/{entityName}',
  tags: ['DataForge'],
  summary: 'Query entity data',
  description: 'Query records from an entity with filtering, sorting, and pagination',
  request: {
    params: z.object({
      orgId: z.string().uuid().openapi({
        description: 'Organization ID',
        example: '01920000-1000-7000-8000-000000000001'
      }),
      entityName: z.string(),
    }),
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
      sort: z.string().optional(),
      filter: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.array(z.any()),
            pagination: z.object({
              page: z.number(),
              limit: z.number(),
              total: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
      description: 'Entity data with pagination',
    },
  },
});
// REMOVED - Actual implementation is in dataforge-api.ts
// protectedOpenAPIRouter.openapi(getDataForgeDataRoute, async (c) => {});

const createDataForgeRecordRoute = createRoute({
  method: 'post',
  path: '/dataforge/orgs/{orgId}/data/{entityName}',
  tags: ['DataForge'],
  summary: 'Create record',
  description: 'Create a new record in the specified entity',
  request: {
    params: z.object({
      orgId: z.string().uuid().openapi({
        description: 'Organization ID',
        example: '01920000-1000-7000-8000-000000000001'
      }),
      entityName: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            data: z.any(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.any(),
            id: z.string(),
          }),
        },
      },
      description: 'Record created successfully',
    },
  },
});
// REMOVED - Actual implementation is in dataforge-api.ts
// protectedOpenAPIRouter.openapi(createDataForgeRecordRoute, async (c) => {});

const updateDataForgeRecordRoute = createRoute({
  method: 'put',
  path: '/dataforge/orgs/{orgId}/data/{entityName}/{id}',
  tags: ['DataForge'],
  summary: 'Update record',
  description: 'Update an existing record by ID',
  request: {
    params: z.object({
      orgId: z.string().uuid().openapi({
        description: 'Organization ID',
        example: '01920000-1000-7000-8000-000000000001'
      }),
      entityName: z.string(),
      id: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            data: z.any(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.any(),
          }),
        },
      },
      description: 'Record updated successfully',
    },
  },
});
// REMOVED - Actual implementation is in dataforge-api.ts
// protectedOpenAPIRouter.openapi(updateDataForgeRecordRoute, async (c) => {});

const deleteDataForgeRecordRoute = createRoute({
  method: 'delete',
  path: '/dataforge/orgs/{orgId}/data/{entityName}/{id}',
  tags: ['DataForge'],
  summary: 'Delete record',
  description: 'Delete a record by ID (soft delete to trash)',
  request: {
    params: z.object({
      orgId: z.string().uuid().openapi({
        description: 'Organization ID',
        example: '01920000-1000-7000-8000-000000000001'
      }),
      entityName: z.string(),
      id: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
      description: 'Record deleted successfully',
    },
  },
});
// REMOVED - Actual implementation is in dataforge-api.ts
// protectedOpenAPIRouter.openapi(deleteDataForgeRecordRoute, async (c) => {});

// Schema management endpoint
const getDataForgeSchemaRoute = createRoute({
  method: 'get',
  path: '/dataforge/orgs/{orgId}/schema',
  tags: ['DataForge'],
  summary: 'Get organization schema',
  description: 'Get complete schema definition for all entities in organization',
  request: {
    params: z.object({
      orgId: z.string().uuid().openapi({
        description: 'Organization ID',
        example: '01920000-1000-7000-8000-000000000001'
      }),
    }),
    query: z.object({
      bustCache: z.enum(['true', 'false']).optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            schema: z.array(z.any()),
            cached: z.boolean(),
            source: z.string(),
            responseTime: z.number(),
          }),
        },
      },
      description: 'Organization schema',
    },
  },
});

// Removed - this was causing redirect loops. The actual implementation is in dataforge-api.ts
// protectedOpenAPIRouter.openapi(getDataForgeSchemaRoute, async (c) => {
//   const orgId = c.req.param('orgId');
//   return c.json({ 
//     message: `Use /api/dataforge/orgs/${orgId}/schema for complete organization schema`,
//     redirectTo: `/api/dataforge/orgs/${orgId}/schema`
//   });
// });

// Bulk create endpoint
const bulkCreateDataForgeRecordsRoute = createRoute({
  method: 'post',
  path: '/dataforge/orgs/{orgId}/bulk/{entityName}/create',
  tags: ['DataForge'],
  summary: 'Bulk create records',
  description: 'Create multiple records in batch',
  request: {
    params: z.object({
      orgId: z.string().uuid().openapi({
        description: 'Organization ID',
        example: '01920000-1000-7000-8000-000000000001'
      }),
      entityName: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            records: z.array(z.any()),
            options: z.object({
              skipValidation: z.boolean().optional(),
            }).optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            created: z.number(),
          }),
        },
      },
      description: 'Bulk create results',
    },
  },
});
// REMOVED - Actual implementation is in dataforge-api.ts
// protectedOpenAPIRouter.openapi(bulkCreateDataForgeRecordsRoute, async (c) => {});

// Trash management endpoint
const getDataForgeTrashRoute = createRoute({
  method: 'get',
  path: '/dataforge/orgs/{orgId}/trash',
  tags: ['DataForge'],
  summary: 'List deleted entities',
  description: 'Get entities that have been deleted (in trash)',
  request: {
    params: z.object({
      orgId: z.string().uuid().openapi({
        description: 'Organization ID',
        example: '01920000-1000-7000-8000-000000000001'
      }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            deletedEntities: z.array(z.object({
              entityName: z.string(),
              deletedAt: z.string(),
              recordCount: z.number(),
            })),
          }),
        },
      },
      description: 'Deleted entities list',
    },
  },
});
// REMOVED - Actual implementation is in dataforge-api.ts
// protectedOpenAPIRouter.openapi(getDataForgeTrashRoute, async (c) => {});

// =============================================================================
// UNIVERSE ENDPOINTS (Additional)
// =============================================================================

const getUniverseActivityRoute = createRoute({
  method: 'get',
  path: '/universe/activity',
  tags: ['Universe'],
  summary: 'Get universe activity',
  description: 'Get recent activity across all user organizations and worlds',
  request: {
    query: z.object({
      days: z.string().optional().default('7'),
      limit: z.string().optional().default('20'),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            activities: z.array(z.object({
              id: z.string().uuid().openapi({
                description: 'Resource ID',
                example: '01920000-1000-7000-8000-000000000001'
              }),
              type: z.string(),
              description: z.string(),
              worldId: z.string().uuid().optional(),
              worldName: z.string().optional(),
              organizationId: z.string().uuid().openapi({
                example: '01920000-1000-7000-8000-000000000001',
                description: 'Organization ID'
              }),
              organizationName: z.string(),
              timestamp: z.string(),
            })),
            summary: z.object({
              totalActivities: z.number(),
              daysCovered: z.number(),
              mostActiveWorld: z.string().optional(),
            }),
          }),
        },
      },
      description: 'Recent universe activity',
    },
  },
});

protectedOpenAPIRouter.openapi(getUniverseActivityRoute, async (c) => {
  return c.json({ 
    message: 'Use /api/universe/activity for universe activity functionality',
    redirectTo: '/api/universe/activity'
  });
});

const getUniverseHealthRoute = createRoute({
  method: 'get',
  path: '/universe/health',
  tags: ['Universe'],
  summary: 'Get universe health status',
  description: 'Get health and synchronization status across all user worlds and organizations',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            status: z.enum(['healthy', 'sync_issues', 'degraded']),
            totalOrganizations: z.number(),
            activeWorlds: z.number(),
            syncStatus: z.object({
              lastSync: z.string().nullable(),
              pendingChanges: z.number(),
              errors: z.array(z.string()),
            }),
          }),
        },
      },
      description: 'Universe health status',
    },
  },
});

protectedOpenAPIRouter.openapi(getUniverseHealthRoute, async (c) => {
  return c.json({ 
    message: 'Use /api/universe/health for universe health functionality',
    redirectTo: '/api/universe/health'
  });
});

// =============================================================================
// WORLDS ENDPOINTS (Complete CRUD)
// =============================================================================

const listWorldsRoute = createRoute({
  method: 'get',
  path: '/worlds',
  tags: ['Worlds'],
  summary: 'List worlds in organization',
  description: 'Get all worlds in current organization context with filtering options',
  request: {
    query: z.object({
      includeInactive: z.enum(['true', 'false']).optional().default('false'),
      includeArchived: z.enum(['true', 'false']).optional().default('false'),
      teamId: z.string().uuid().optional(),
    }),
    headers: z.object({
      'x-organization-slug': z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            worlds: z.array(z.object({
              id: z.string().uuid().openapi({
                description: 'Resource ID',
                example: '01920000-1000-7000-8000-000000000001'
              }),
              name: z.string(),
              description: z.string().nullable(),
              state: z.enum(['exploring', 'developing', 'active', 'paused', 'archived']),
              worldType: z.enum(['personal', 'business', 'client', 'department', 'project_domain']),
              priority: z.enum(['low', 'medium', 'high', 'critical']),
              teamId: z.string().uuid().nullable(),
              teamName: z.string().nullable().optional(),
              createdAt: z.string(),
              updatedAt: z.string(),
            })),
            total: z.number(),
            organizationContext: z.object({
              id: z.string().uuid().openapi({
                description: 'Resource ID',
                example: '01920000-1000-7000-8000-000000000001'
              }),
              name: z.string(),
              slug: z.string(),
            }),
          }),
        },
      },
      description: 'List of worlds in organization',
    },
  },
});

protectedOpenAPIRouter.openapi(listWorldsRoute, async (c) => {
  return c.json({ 
    message: 'Use /api/worlds for complete world management functionality (requires organization context)',
    redirectTo: '/api/worlds'
  });
});

const createWorldRoute = createRoute({
  method: 'post',
  path: '/worlds',
  tags: ['Worlds'],
  summary: 'Create new world',
  description: 'Create a new world in the current organization context',
  request: {
    headers: z.object({
      'x-organization-slug': z.string().optional(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1).max(255),
            description: z.string().optional(),
            teamId: z.string().uuid().optional(),
            state: z.enum(['exploring', 'developing', 'active', 'paused', 'archived']).default('active'),
            worldType: z.enum(['personal', 'business', 'client', 'department', 'project_domain']).default('business'),
            priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            world: z.object({
              id: z.string().uuid().openapi({
                description: 'Resource ID',
                example: '01920000-1000-7000-8000-000000000001'
              }),
              name: z.string(),
              description: z.string().nullable(),
              state: z.string(),
              worldType: z.string(),
              priority: z.string(),
              organizationId: z.string().uuid().openapi({
                example: '01920000-1000-7000-8000-000000000001',
                description: 'Organization ID'
              }),
              teamId: z.string().uuid().nullable(),
              createdAt: z.string(),
            }),
          }),
        },
      },
      description: 'World created successfully',
    },
  },
});

protectedOpenAPIRouter.openapi(createWorldRoute, async (c) => {
  return c.json({ 
    message: 'Use /api/worlds for world creation functionality (requires organization context)',
    redirectTo: '/api/worlds'
  });
});

const getWorldRoute = createRoute({
  method: 'get',
  path: '/worlds/{id}',
  tags: ['Worlds'],
  summary: 'Get world by ID',
  description: 'Get detailed information about a specific world',
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        param: { name: 'id', in: 'path' },
        description: 'Resource ID',
        example: '01920000-1000-7000-8000-000000000001'
      }),
    }),
    headers: z.object({
      'x-organization-slug': z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            id: z.string().uuid().openapi({
        param: { name: 'id', in: 'path' },
        description: 'Resource ID',
        example: '01920000-1000-7000-8000-000000000001'
      }),
            name: z.string(),
            description: z.string().nullable(),
            state: z.string(),
            worldType: z.string(),
            priority: z.string(),
            organizationId: z.string().uuid().openapi({
              example: '01920000-1000-7000-8000-000000000001',
              description: 'Organization ID'
            }),
            teamId: z.string().uuid().nullable(),
            teamName: z.string().nullable().optional(),
            createdAt: z.string(),
            updatedAt: z.string(),
            stats: z.object({
              totalProjects: z.number().optional(),
              activeProjects: z.number().optional(),
              lastActivity: z.string().nullable().optional(),
            }).optional(),
          }),
        },
      },
      description: 'World details',
    },
  },
});

protectedOpenAPIRouter.openapi(getWorldRoute, async (c) => {
  const id = c.req.param('id');
  return c.json({ 
    message: `Use /api/worlds/${id} for world details functionality`,
    redirectTo: `/api/worlds/${id}`
  });
});

const updateWorldRoute = createRoute({
  method: 'put',
  path: '/worlds/{id}',
  tags: ['Worlds'],
  summary: 'Update world',
  description: 'Update an existing world',
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        param: { name: 'id', in: 'path' },
        description: 'Resource ID',
        example: '01920000-1000-7000-8000-000000000001'
      }),
    }),
    headers: z.object({
      'x-organization-slug': z.string().optional(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1).max(255).optional(),
            description: z.string().optional(),
            teamId: z.string().uuid().nullable().optional(),
            state: z.enum(['exploring', 'developing', 'active', 'paused', 'archived']).optional(),
            worldType: z.enum(['personal', 'business', 'client', 'department', 'project_domain']).optional(),
            priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            world: z.object({
              id: z.string().uuid().openapi({
                description: 'Resource ID',
                example: '01920000-1000-7000-8000-000000000001'
              }),
              name: z.string(),
              description: z.string().nullable(),
              state: z.string(),
              updatedAt: z.string(),
            }),
          }),
        },
      },
      description: 'World updated successfully',
    },
  },
});

protectedOpenAPIRouter.openapi(updateWorldRoute, async (c) => {
  const id = c.req.param('id');
  return c.json({ 
    message: `Use /api/worlds/${id} for world update functionality`,
    redirectTo: `/api/worlds/${id}`
  });
});

const deleteWorldRoute = createRoute({
  method: 'delete',
  path: '/worlds/{id}',
  tags: ['Worlds'],
  summary: 'Delete world',
  description: 'Delete a world (soft delete - moves to archived state)',
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        param: { name: 'id', in: 'path' },
        description: 'Resource ID',
        example: '01920000-1000-7000-8000-000000000001'
      }),
    }),
    headers: z.object({
      'x-organization-slug': z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
            worldId: z.string().uuid().openapi({
              example: '01920000-1000-7000-8000-000000000001',
              description: 'World ID'
            }),
          }),
        },
      },
      description: 'World deleted successfully',
    },
  },
});

protectedOpenAPIRouter.openapi(deleteWorldRoute, async (c) => {
  const id = c.req.param('id');
  return c.json({ 
    message: `Use /api/worlds/${id} for world deletion functionality`,
    redirectTo: `/api/worlds/${id}`
  });
});

// Note: Additional endpoints available at dedicated routes:
// - /api/dataforge/orgs/:orgId/* - Full DataForge entity management system  
// - /api/teams/* - Team management and collaboration
// - /api/worlds/* - Legacy world/project management

// New protected endpoint to test auto-documentation
// TEMPORARILY DISABLED - causing OpenAPI generation error
/*
const testProtectedAutoDocRoute = createRoute({
  method: 'post',
  path: '/test-protected-auto-doc',
  tags: ['Test'],
  summary: 'Test protected endpoint with auto-documentation',
  description: 'This endpoint demonstrates protected auto-documentation functionality with request/response schemas, authentication requirements, and comprehensive error handling',
  requestBody: {
    content: {
      'application/json': {
        schema: z.object({
          action: z.string().openapi({
            example: 'validate_user_access',
            description: 'Action to perform (validate_user_access, check_permissions, etc.)'
          }),
          organizationId: z.string().uuid().openapi({
            example: '01920000-1000-7000-8000-000000000001',
            description: 'Organization ID to check access for'
          }),
          payload: z.object({
            testData: z.string().openapi({
              example: 'sample test data',
              description: 'Test payload data'
            }),
            options: z.object({
              includeMetadata: z.boolean().default(true).openapi({
                description: 'Whether to include metadata in response'
              }),
              validatePermissions: z.boolean().default(true).openapi({
                description: 'Whether to validate user permissions'
              })
            }).optional()
          }).openapi({
            description: 'Request payload with test data and options'
          })
        }).openapi({
          description: 'Protected endpoint test request'
        })
      }
    },
    description: 'Request body with action, organization ID, and test payload'
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean().openapi({
              example: true,
              description: 'Indicates if the request was processed successfully'
            }),
            message: z.string().openapi({
              example: 'Protected auto-documentation test completed successfully',
              description: 'Human-readable response message'
            }),
            data: z.object({
              userId: z.string().uuid().openapi({
                example: '0198b046-c453-72d9-b71a-092e1f75601a',
                description: 'Authenticated user ID'
              }),
              organizationAccess: z.boolean().openapi({
                description: 'Whether user has access to the specified organization'
              }),
              permissions: z.array(z.string()).openapi({
                example: ['read', 'write', 'admin'],
                description: 'List of user permissions in the organization'
              }),
              metadata: z.object({
                processedAt: z.string().openapi({
                  example: '2025-09-05T14:30:00Z',
                  description: 'Timestamp when request was processed'
                }),
                requestId: z.string().openapi({
                  example: 'req_1234567890',
                  description: 'Unique request identifier'
                })
              }).optional()
            }).openapi({
              description: 'Response data with user info and permissions'
            })
          }).openapi({
            description: 'Successful protected endpoint response'
          })
        }
      },
      description: 'Protected endpoint test completed successfully'
    },
    401: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string().openapi({ example: 'UNAUTHORIZED' }),
            message: z.string().openapi({ example: 'Authentication required' })
          })
        }
      },
      description: 'Authentication required'
    },
    403: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string().openapi({ example: 'FORBIDDEN' }),
            message: z.string().openapi({ example: 'Insufficient permissions for organization' })
          })
        }
      },
      description: 'Insufficient permissions'
    }
  }
});
*/

/* TEMPORARILY DISABLED - causing OpenAPI generation error
protectedOpenAPIRouter.openapi(testProtectedAutoDocRoute, async (c) => {
  try {
    const body = c.req.valid('json');
    const user = c.get('user'); // From auth middleware
    
    console.log('Protected endpoint - body:', JSON.stringify(body, null, 2));
    console.log('Protected endpoint - user:', user?.id);
    
    // Simulate permission check
    const hasAccess = true; // In real implementation, check org membership
    
    if (!hasAccess) {
      return c.json({
        error: 'FORBIDDEN',
        message: 'Insufficient permissions for organization'
      }, 403);
    }
    
    return c.json({
      success: true,
      message: 'Protected auto-documentation test completed successfully',
      data: {
        userId: user?.id || 'unknown',
        organizationAccess: hasAccess,
        permissions: ['read', 'write', 'admin'],
        ...(body?.payload?.options?.includeMetadata !== false && {
          metadata: {
            processedAt: new Date().toISOString(),
            requestId: `req_${Date.now()}`
          }
        })
      }
    });
  } catch (error) {
    console.error('Protected endpoint error:', error);
    return c.json({
      error: 'PROCESSING_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
      requestId: `error_${Date.now()}`
    }, 500);
  }
});
*/

// Add a simple non-OpenAPI route as well
protectedOpenAPIRouter.get('/test-protected', (c) => {
  return c.json({ message: 'Protected router is working!' });
});

// Individual documentation removed - using unified documentation at /api/doc instead

export default protectedOpenAPIRouter;