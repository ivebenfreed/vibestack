import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { dbLogger } from '../middleware/logger';
import { OrganizationService } from '../services/organization/OrganizationService';
import type { AppContext } from '../types/hono';

// Enhanced Zod schemas with OpenAPI metadata
export const OrganizationSchema = z.object({
  id: z.string().uuid().openapi({ 
    example: '01920000-1000-7000-8000-000000000001',
    description: 'Unique organization identifier' 
  }),
  name: z.string().min(1).max(100).openapi({ 
    example: 'Wide Corp Solutions',
    description: 'Organization display name' 
  }),
  slug: z.string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/)
    .openapi({ 
      example: 'wide-corp',
      description: 'URL-safe organization identifier' 
    }),
  description: z.string().nullable().openapi({ 
    example: 'A leading technology solutions provider',
    description: 'Organization description' 
  }),
  logo_url: z.string().url().nullable().openapi({ 
    example: 'https://example.com/logo.png',
    description: 'Organization logo URL' 
  }),
  created_at: z.string().datetime().openapi({ 
    example: '2024-01-15T10:30:00Z',
    description: 'Organization creation timestamp' 
  }),
  updated_at: z.string().datetime().openapi({ 
    example: '2024-01-15T10:30:00Z',
    description: 'Last update timestamp' 
  }),
}).openapi('Organization');

export const CreateOrganizationRequestSchema = z.object({
  name: z.string().min(1).max(100).openapi({ 
    example: 'My New Organization',
    description: 'Organization display name' 
  }),
  slug: z.string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/)
    .optional()
    .openapi({ 
      example: 'my-new-org',
      description: 'URL-safe identifier (auto-generated if not provided)' 
    }),
  description: z.string().optional().openapi({ 
    example: 'My organization description',
    description: 'Organization description' 
  }),
  logo_url: z.string().url().optional().openapi({ 
    example: 'https://example.com/logo.png',
    description: 'Organization logo URL' 
  }),
}).openapi('CreateOrganizationRequest');

export const UpdateOrganizationRequestSchema = z.object({
  name: z.string().min(1).max(100).optional().openapi({ 
    example: 'Updated Organization Name',
    description: 'Organization display name' 
  }),
  slug: z.string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/)
    .optional()
    .openapi({ 
      example: 'updated-org-name',
      description: 'URL-safe identifier' 
    }),
  description: z.string().nullable().optional().openapi({ 
    example: 'Updated organization description',
    description: 'Organization description' 
  }),
  logo_url: z.string().url().nullable().optional().openapi({ 
    example: 'https://example.com/new-logo.png',
    description: 'Organization logo URL' 
  }),
  industry: z.string().nullable().optional().openapi({ 
    example: 'Technology',
    description: 'Industry sector' 
  }),
  company_size: z.string().nullable().optional().openapi({ 
    example: '11-50',
    description: 'Company size range' 
  }),
  website_url: z.string().url().nullable().optional().openapi({ 
    example: 'https://example.com',
    description: 'Company website URL' 
  }),
}).openapi('UpdateOrganizationRequest');

export const OrganizationListResponseSchema = z.object({
  organizations: z.array(OrganizationSchema.extend({
    role: z.enum(['owner', 'admin', 'manager', 'member', 'viewer']).openapi({
      example: 'owner',
      description: 'User role in this organization'
    }),
    isDefault: z.boolean().openapi({
      example: true,
      description: 'Whether this is the user default organization'
    }),
    isLastUsed: z.boolean().openapi({
      example: false,
      description: 'Whether this was the last used organization'
    }),
  })),
  defaultOrganizationId: z.string().uuid().nullable().openapi({
    example: '01920000-1000-7000-8000-000000000001',
    description: 'User default organization ID'
  }),
  lastUsedOrganizationId: z.string().uuid().nullable().openapi({
    example: '01920000-1000-7000-8000-000000000001', 
    description: 'Last used organization ID'
  }),
}).openapi('OrganizationListResponse');

export const ErrorResponseSchema = z.object({
  error: z.string().openapi({ 
    example: 'Invalid request data',
    description: 'Error message' 
  }),
  errors: z.record(z.string()).optional().openapi({
    example: { name: 'Name is required' },
    description: 'Field-specific validation errors'
  }),
}).openapi('ErrorResponse');

const organizationsOpenAPIRouter = new OpenAPIHono<AppContext>();

// GET /api/organizations - List user's organizations
const listOrganizationsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Organizations'],
  summary: 'List user organizations',
  description: 'Get a list of organizations the authenticated user belongs to',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: OrganizationListResponseSchema,
        },
      },
      description: 'List of user organizations with metadata',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Authentication required',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

organizationsOpenAPIRouter.openapi(listOrganizationsRoute, async (c) => {
  try {
    // User already authenticated by global auth middleware
    const user = c.get('user');
    
    const orgService = new OrganizationService(c);
    const result = await orgService.getOrganizationsByUser(user.id);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    // Get user's default organization info using withKysely pattern
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
      isLastUsed: org.id === userInfo?.last_used_organization_id
    }));

    return c.json({
      organizations: enhancedOrgs,
      defaultOrganizationId: userInfo?.default_organization_id,
      lastUsedOrganizationId: userInfo?.last_used_organization_id,
      lastOrgAccessAt: userInfo?.last_org_access_at
    });

  } catch (error) {
    dbLogger.error('Error in GET /organizations', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/organizations - Create new organization
const createOrganizationRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Organizations'],
  summary: 'Create organization',
  description: 'Create a new organization and automatically add the creator as owner',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateOrganizationRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: OrganizationSchema,
        },
      },
      description: 'Organization created successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid request data',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Authentication required',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Internal server error',
    },
  },
});

organizationsOpenAPIRouter.openapi(createOrganizationRoute, async (c) => {
  try {
    // User already authenticated by global auth middleware
    const user = c.get('user');
    const body = c.req.valid('json');

    // Generate slug from name if not provided
    const generateSlug = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    };

    const data = {
      name: body.name,
      slug: body.slug || generateSlug(body.name),
      description: body.description || null,
      logo_url: body.logo_url || null,
      // Set other required fields with defaults
      industry: null,
      company_size: null,
      website_url: null,
      country: null,
      timezone: null,
      subscription_tier: 'trial' as const,
      billing_email: null,
      settings: {},
      allowed_domains: [],
    };

    const orgService = new OrganizationService(c);
    const result = await orgService.createOrganization(data, user.id);

    if (!result.success) {
      return c.json({ 
        error: result.error,
        errors: result.errors 
      }, 400);
    }

    return c.json(result.data, 201);

  } catch (error) {
    dbLogger.error('Error in POST /organizations', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/organizations/:orgId - Get organization by ID
const getOrganizationRoute = createRoute({
  method: 'get',
  path: '/{orgId}',
  tags: ['Organizations'],
  summary: 'Get organization by ID',
  description: 'Get detailed information about a specific organization',
  request: {
    params: z.object({
      orgId: z.string().uuid().openapi({
        example: '01920000-1000-7000-8000-000000000001',
        description: 'Organization ID'
      }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: OrganizationSchema,
        },
      },
      description: 'Organization details',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Access denied',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Organization not found',
    },
  },
});

organizationsOpenAPIRouter.openapi(getOrganizationRoute, async (c) => {
  try {
    const orgId = c.req.param('orgId');
    
    const orgService = new OrganizationService(c);
    const result = await orgService.getOrganizationById(orgId);

    if (!result.success) {
      return c.json({ error: result.error }, 404);
    }

    return c.json(result.data);

  } catch (error) {
    dbLogger.error('Error in GET /organizations/:orgId', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// PUT /api/organizations/:orgId - Update organization
const updateOrganizationRoute = createRoute({
  method: 'put',
  path: '/{orgId}',
  tags: ['Organizations'],
  summary: 'Update organization',
  description: 'Update organization information (requires admin role)',
  request: {
    params: z.object({
      orgId: z.string().uuid().openapi({
        example: '01920000-1000-7000-8000-000000000001',
        description: 'Organization ID'
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateOrganizationRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: OrganizationSchema,
        },
      },
      description: 'Organization updated successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid request data',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Admin role required',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Organization not found',
    },
  },
});

organizationsOpenAPIRouter.openapi(updateOrganizationRoute, async (c) => {
  try {
    const user = c.get('user');
    const orgId = c.req.param('orgId');
    const body = c.req.valid('json');

    const data = {
      name: body.name,
      slug: body.slug,
      description: body.description,
      industry: body.industry,
      company_size: body.company_size,
      website_url: body.website_url,
      logo_url: body.logo_url,
    };

    const orgService = new OrganizationService(c);
    const result = await orgService.updateOrganization(orgId, data, user.id);

    if (!result.success) {
      return c.json({ 
        error: result.error,
        errors: result.errors 
      }, 400);
    }

    return c.json(result.data);

  } catch (error) {
    dbLogger.error('Error in PUT /organizations/:orgId', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// DELETE /api/organizations/:orgId - Delete organization
const deleteOrganizationRoute = createRoute({
  method: 'delete',
  path: '/{orgId}',
  tags: ['Organizations'],
  summary: 'Delete organization',
  description: 'Delete organization (requires owner role)',
  request: {
    params: z.object({
      orgId: z.string().uuid().openapi({
        example: '01920000-1000-7000-8000-000000000001',
        description: 'Organization ID'
      }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            message: z.string().openapi({
              example: 'Organization deleted successfully',
              description: 'Success message'
            }),
          }),
        },
      },
      description: 'Organization deleted successfully',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Owner role required',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Organization not found',
    },
  },
});

organizationsOpenAPIRouter.openapi(deleteOrganizationRoute, async (c) => {
  try {
    const user = c.get('user');
    const orgId = c.req.param('orgId');
    
    const orgService = new OrganizationService(c);
    const result = await orgService.deleteOrganization(orgId, user.id);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ message: 'Organization deleted successfully' });

  } catch (error) {
    dbLogger.error('Error in DELETE /organizations/:orgId', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default organizationsOpenAPIRouter;