import { Context, Next } from 'hono';
import { AuthUser } from '../types/api.js';

/**
 * Multi-tenant routing middleware for organization-scoped requests
 * Detects organization from request and sets up database routing
 */

interface OrganizationContext {
  id: string;
  slug: string;
  databaseUrl: string;
  settings: {
    timeZone: string;
    currency: string;
    [key: string]: any;
  };
}

interface MultiTenantVariables {
  user: AuthUser;
  organization?: OrganizationContext;
  organizationId?: string;
  databaseUrl?: string;
}

/**
 * Organization detection strategies
 */
export type OrganizationDetectionStrategy = 'subdomain' | 'header' | 'token' | 'path';

export interface MultiTenantConfig {
  strategy: OrganizationDetectionStrategy[];
  required?: boolean;
  fallbackToDefault?: boolean;
  defaultOrganization?: string;
}

/**
 * Create multi-tenant middleware
 */
export function createMultiTenantMiddleware(config: MultiTenantConfig = { strategy: ['header', 'token'] }) {
  return async (c: Context<{ Variables: MultiTenantVariables }>, next: Next) => {
    try {
      const user = c.get('user');
      if (!user && config.required) {
        return c.json({
          success: false,
          error: 'Authentication required for multi-tenant access',
          code: 'AUTH_REQUIRED'
        }, 401);
      }

      // Try each detection strategy in order
      let organizationId: string | null = null;
      let detectionMethod: string | null = null;

      for (const strategy of config.strategy) {
        const result = await detectOrganization(c, strategy, user);
        if (result.organizationId) {
          organizationId = result.organizationId;
          detectionMethod = strategy;
          break;
        }
      }

      // Handle missing organization
      if (!organizationId) {
        if (config.required) {
          return c.json({
            success: false,
            error: 'Organization identification required',
            code: 'ORGANIZATION_REQUIRED',
            hint: 'Provide organization via header (X-Organization-Id), subdomain, or token'
          }, 400);
        }

        if (config.fallbackToDefault && config.defaultOrganization) {
          organizationId = config.defaultOrganization;
          detectionMethod = 'fallback';
        }
      }

      // Set organization context if found
      if (organizationId) {
        const organization = await getOrganizationContext(organizationId, user);
        
        if (!organization) {
          return c.json({
            success: false,
            error: 'Organization not found or access denied',
            code: 'ORGANIZATION_NOT_FOUND'
          }, 404);
        }

        // Verify user has access to organization
        if (user) {
          const hasAccess = await verifyOrganizationAccess(user.id, organizationId);
          if (!hasAccess) {
            return c.json({
              success: false,
              error: 'Access denied to organization',
              code: 'ORGANIZATION_ACCESS_DENIED'
            }, 403);
          }
        }

        // Set organization context in request
        c.set('organization', organization);
        c.set('organizationId', organizationId);
        c.set('databaseUrl', organization.databaseUrl);

        // Add organization info to response headers
        c.header('X-Organization-Id', organizationId);
        c.header('X-Organization-Slug', organization.slug);
        c.header('X-Detection-Method', detectionMethod || 'unknown');
      }

      await next();

    } catch (error) {
      console.error('Multi-tenant middleware error:', error);
      return c.json({
        success: false,
        error: 'Multi-tenant routing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        code: 'MULTI_TENANT_ERROR'
      }, 500);
    }
  };
}

/**
 * Detect organization from request using specified strategy
 */
async function detectOrganization(
  c: Context, 
  strategy: OrganizationDetectionStrategy, 
  user?: AuthUser
): Promise<{ organizationId?: string; confidence: number }> {
  
  switch (strategy) {
    case 'subdomain':
      return detectFromSubdomain(c);
    
    case 'header':
      return detectFromHeader(c);
    
    case 'token':
      return detectFromToken(c, user);
    
    case 'path':
      return detectFromPath(c);
    
    default:
      return { confidence: 0 };
  }
}

/**
 * Detect organization from subdomain
 * e.g., acme.yourdomain.com -> acme organization
 */
function detectFromSubdomain(c: Context): { organizationId?: string; confidence: number } {
  try {
    const host = c.req.header('host') || '';
    const parts = host.split('.');
    
    // Expect format: {org}.{domain}.{tld}
    if (parts.length >= 3) {
      const subdomain = parts[0];
      
      // Filter out common non-organization subdomains
      const systemSubdomains = ['www', 'api', 'app', 'admin', 'cdn', 'static'];
      if (!systemSubdomains.includes(subdomain)) {
        return {
          organizationId: subdomain,
          confidence: 0.9
        };
      }
    }

    return { confidence: 0 };

  } catch (error) {
    console.error('Subdomain detection failed:', error);
    return { confidence: 0 };
  }
}

/**
 * Detect organization from request header
 * X-Organization-Id: org-123 or X-Organization-Slug: acme
 */
function detectFromHeader(c: Context): { organizationId?: string; confidence: number } {
  try {
    // Try organization ID header first
    const orgId = c.req.header('X-Organization-Id') || c.req.header('x-organization-id');
    if (orgId) {
      return {
        organizationId: orgId,
        confidence: 1.0
      };
    }

    // Try organization slug header
    const orgSlug = c.req.header('X-Organization-Slug') || c.req.header('x-organization-slug');
    if (orgSlug) {
      return {
        organizationId: orgSlug, // Will be resolved to ID later
        confidence: 0.9
      };
    }

    return { confidence: 0 };

  } catch (error) {
    console.error('Header detection failed:', error);
    return { confidence: 0 };
  }
}

/**
 * Detect organization from JWT token claims
 */
function detectFromToken(c: Context, user?: AuthUser): { organizationId?: string; confidence: number } {
  try {
    if (!user) {
      return { confidence: 0 };
    }

    // Check if user token contains organization context
    const userOrgId = (user as any).organizationId || (user as any).currentOrganizationId;
    if (userOrgId) {
      return {
        organizationId: userOrgId,
        confidence: 0.8
      };
    }

    // If user belongs to only one organization, use that
    const userOrgs = (user as any).organizations || [];
    if (userOrgs.length === 1) {
      return {
        organizationId: userOrgs[0].id,
        confidence: 0.7
      };
    }

    return { confidence: 0 };

  } catch (error) {
    console.error('Token detection failed:', error);
    return { confidence: 0 };
  }
}

/**
 * Detect organization from URL path
 * e.g., /api/v1/organizations/acme/projects -> acme
 */
function detectFromPath(c: Context): { organizationId?: string; confidence: number } {
  try {
    const path = c.req.path;
    
    // Pattern: /api/v1/organizations/{orgId}/...
    const orgPathMatch = path.match(/\/organizations\/([^\/]+)/);
    if (orgPathMatch) {
      return {
        organizationId: orgPathMatch[1],
        confidence: 0.8
      };
    }

    // Pattern: /api/v1/orgs/{orgId}/...
    const shortOrgPathMatch = path.match(/\/orgs\/([^\/]+)/);
    if (shortOrgPathMatch) {
      return {
        organizationId: shortOrgPathMatch[1],
        confidence: 0.8
      };
    }

    return { confidence: 0 };

  } catch (error) {
    console.error('Path detection failed:', error);
    return { confidence: 0 };
  }
}

/**
 * Get organization context including database connection info
 */
async function getOrganizationContext(organizationId: string, user?: AuthUser): Promise<OrganizationContext | null> {
  try {
    // This would fetch from your organization database
    // For now, we'll return a mock organization
    
    // If organizationId looks like a slug, resolve to actual ID
    let actualOrgId = organizationId;
    if (!organizationId.startsWith('org_') && !organizationId.match(/^[0-9a-f-]{36}$/)) {
      actualOrgId = await resolveOrganizationSlug(organizationId);
      if (!actualOrgId) {
        return null;
      }
    }

    const organization = await fetchOrganizationById(actualOrgId);
    if (!organization) {
      return null;
    }

    return {
      id: organization.id,
      slug: organization.slug,
      databaseUrl: organization.databaseUrl,
      settings: organization.settings || {
        timeZone: 'UTC',
        currency: 'USD'
      }
    };

  } catch (error) {
    console.error('Failed to get organization context:', error);
    return null;
  }
}

/**
 * Verify user has access to organization
 */
async function verifyOrganizationAccess(userId: string, organizationId: string): Promise<boolean> {
  try {
    // This would check if user is a member of the organization
    // For now, we'll return true for authenticated users
    const membership = await getOrganizationMembership(userId, organizationId);
    return !!membership;

  } catch (error) {
    console.error('Failed to verify organization access:', error);
    return false;
  }
}

/**
 * Resolve organization slug to organization ID
 */
async function resolveOrganizationSlug(slug: string): Promise<string | null> {
  try {
    // This would query the database to find organization by slug
    // Implementation would use your ORM/database layer
    console.log('Resolving organization slug:', slug);
    return `org_${Date.now()}`; // Mock implementation

  } catch (error) {
    console.error('Failed to resolve organization slug:', error);
    return null;
  }
}

/**
 * Fetch organization by ID
 */
async function fetchOrganizationById(id: string): Promise<any> {
  try {
    // This would fetch organization from database
    // Implementation would use your ORM/database layer
    console.log('Fetching organization:', id);
    
    // Mock organization data
    return {
      id,
      slug: 'example-org',
      name: 'Example Organization',
      databaseUrl: 'postgresql://user:pass@localhost:5432/org_db',
      settings: {
        timeZone: 'UTC',
        currency: 'USD'
      }
    };

  } catch (error) {
    console.error('Failed to fetch organization:', error);
    return null;
  }
}

/**
 * Get organization membership for user
 */
async function getOrganizationMembership(userId: string, organizationId: string): Promise<any> {
  try {
    // This would check organization membership in database
    // Implementation would use your ORM/database layer
    console.log('Checking membership:', { userId, organizationId });
    
    // Mock membership data
    return {
      userId,
      organizationId,
      role: 'member',
      status: 'active'
    };

  } catch (error) {
    console.error('Failed to get organization membership:', error);
    return null;
  }
}

/**
 * Utility middleware to require organization context
 */
export function requireOrganization() {
  return createMultiTenantMiddleware({
    strategy: ['header', 'subdomain', 'token', 'path'],
    required: true
  });
}

/**
 * Utility middleware for optional organization context
 */
export function optionalOrganization() {
  return createMultiTenantMiddleware({
    strategy: ['header', 'subdomain', 'token', 'path'],
    required: false
  });
}

/**
 * Get database connection for organization from context
 */
export function getOrganizationDatabase(c: Context<{ Variables: MultiTenantVariables }>): string | null {
  const organization = c.get('organization');
  return organization?.databaseUrl || null;
}

/**
 * Middleware to ensure database routing is set up for organization operations
 */
export function requireDatabase() {
  return async (c: Context<{ Variables: MultiTenantVariables }>, next: Next) => {
    const databaseUrl = getOrganizationDatabase(c);
    
    if (!databaseUrl) {
      return c.json({
        success: false,
        error: 'Organization database not available',
        code: 'DATABASE_NOT_AVAILABLE'
      }, 500);
    }

    // Set up database connection for this request
    // This would configure your ORM/database layer to use the organization's database
    await setupOrganizationDatabase(databaseUrl);
    
    await next();
  };
}

/**
 * Setup database connection for organization
 */
async function setupOrganizationDatabase(databaseUrl: string): Promise<void> {
  try {
    // This would configure your ORM (MikroORM, Prisma, etc.) to use the organization's database
    // For now, we'll just log the setup
    console.log('Setting up organization database:', databaseUrl.replace(/\/\/[^@]+@/, '//***:***@'));
    
    // In a real implementation, you might:
    // 1. Create a new ORM instance with the organization's connection string
    // 2. Store it in request context for use by route handlers
    // 3. Ensure proper connection pooling and cleanup

  } catch (error) {
    console.error('Failed to setup organization database:', error);
    throw new Error('Database setup failed');
  }
}

export default createMultiTenantMiddleware;