import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getAuth } from '../lib/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import type { Env } from '../types/env.js';

const app = new Hono<{ 
  Bindings: Env;
  Variables: { 
    user: any;
    session: any;
  } 
}>();

// Apply authentication middleware to all organization routes
app.use('*', authMiddleware);

// Organization creation schema
const createOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  logo: z.string().url().optional(),
  metadata: z.record(z.any()).optional()
});

/**
 * CREATE ORGANIZATION
 * POST /organizations-simple
 */
app.post('/', zValidator('json', createOrganizationSchema), async (c) => {
  const user = c.get('user');
  const session = c.get('session');
  
  console.log('[Org Route] Headers:', Object.fromEntries(c.req.raw.headers.entries()));
  console.log('[Org Route] User:', user ? `${user.email} (${user.id})` : 'null');
  console.log('[Org Route] Session:', session ? `${session.id}` : 'null');
  
  if (!user || !session) {
    return c.json({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    }, 401);
  }
  
  try {
    const { name, slug, logo, metadata } = c.req.valid('json');
    const auth = getAuth(c);

    console.log('[Org Route] Creating organization:', { name, slug, userId: user.id });

    // Create organization using Better Auth
    const result = await auth.api.createOrganization({
      body: {
        name,
        slug,
        logo,
        metadata
      },
      headers: c.req.raw.headers
    });

    if (!result.data) {
      console.error('[Org Route] Organization creation failed:', result.error);
      
      return c.json({
        success: false,
        error: result.error?.message || 'Failed to create organization',
        code: 'CREATION_FAILED'
      }, 400);
    }

    console.log('[Org Route] Organization created successfully:', result.data.organization.id);

    return c.json({
      success: true,
      data: {
        organization: result.data.organization,
        member: result.data.member
      }
    }, 201);

  } catch (error) {
    console.error('[Org Route] Organization creation error:', error);
    
    return c.json({
      success: false,
      error: 'Failed to create organization',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'CREATION_FAILED'
    }, 500);
  }
});

/**
 * GET USER'S ORGANIZATIONS
 * GET /organizations-simple
 */
app.get('/', async (c) => {
  const user = c.get('user');
  const session = c.get('session');
  
  if (!user || !session) {
    return c.json({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    }, 401);
  }
  
  try {
    const auth = getAuth(c);

    console.log('[Org Route] Fetching organizations for user:', user.id);

    // Get user's organizations using Better Auth
    const result = await auth.api.listUserOrganizations({
      headers: c.req.raw.headers
    });

    if (!result.data) {
      console.error('[Org Route] Failed to fetch organizations:', result.error);
      
      return c.json({
        success: false,
        error: result.error?.message || 'Failed to fetch organizations',
        code: 'FETCH_FAILED'
      }, 400);
    }

    console.log('[Org Route] Organizations fetched:', result.data.length);

    return c.json({
      success: true,
      data: {
        organizations: result.data.map(item => ({
          ...item.organization,
          userRole: item.member.role,
          memberSince: item.member.createdAt
        }))
      }
    });

  } catch (error) {
    console.error('[Org Route] Error fetching organizations:', error);
    
    return c.json({
      success: false,
      error: 'Failed to fetch organizations',
      code: 'FETCH_FAILED'
    }, 500);
  }
});

export default app;