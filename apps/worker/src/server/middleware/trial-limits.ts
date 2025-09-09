import { Context, Next } from 'hono';
import { dbLogger } from './logger';
import { getKysely } from '../lib/database-manager';

/**
 * Middleware to enforce trial expiration and subscription access
 */
export async function enforceTrialLimits(c: Context, next: Next) {
  // Only apply to critical endpoints (entity creation, data modification)
  const path = c.req.path;
  if (!isCriticalEndpoint(c.req.method, path)) {
    return next();
  }

  try {
    // Get organization ID from request context
    const organizationId = getOrganizationIdFromContext(c);
    if (!organizationId) {
      // If no organization context, allow request (might be system-level operation)
      return next();
    }

    // Check trial status
    const trialCheck = await checkTrialStatus(c, organizationId);
    if (trialCheck.expired && trialCheck.needsUpgrade) {
      dbLogger.warn('Request blocked - trial expired', {
        organizationId,
        trialEndedAt: trialCheck.trialEndedAt,
        daysExpired: trialCheck.daysExpired,
        endpoint: path
      });

      return c.json({
        error: 'Trial expired',
        details: {
          message: `Your 14-day trial expired ${trialCheck.daysExpired} days ago. Please upgrade to continue using Elevra.`,
          trial_ended_at: trialCheck.trialEndedAt,
          days_expired: trialCheck.daysExpired,
          upgrade_url: '/billing/upgrade',
          contact_sales: '/contact-sales'
        }
      }, 402); // 402 Payment Required
    }

    // Add trial info to context for UI warnings
    c.set('trialInfo', trialCheck);

    // Allow request to continue
    return next();

  } catch (error) {
    dbLogger.error('Error in trial limits middleware', error);
    // On error, allow request to continue (fail open for availability)
    return next();
  }
}

/**
 * Check if the request is for a critical endpoint that requires subscription access
 */
function isCriticalEndpoint(method: string, path: string): boolean {
  // Only block POST, PUT, PATCH, DELETE operations on data endpoints
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return false;
  }

  const criticalEndpoints = [
    '/api/entities',
    '/api/dataforge/entities',
    '/api/dataforge/orgs',  // DataForge organization-specific operations
    '/api/projects',
    '/api/tasks',
    '/api/records',
    '/api/documents',
    '/api/files',
    '/api/activities',
    '/api/discussions',
    '/api/collections',
    '/api/organizations'  // Organization modifications
  ];

  return criticalEndpoints.some(endpoint => path.startsWith(endpoint));
}

/**
 * Get organization ID from request context
 */
function getOrganizationIdFromContext(c: Context): string | null {
  // Try to get organization ID from various sources
  
  // 1. From URL path parameter (e.g., /api/dataforge/orgs/:orgId/entities)
  const pathMatch = c.req.path.match(/\/orgs\/([^\/]+)/);
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1];
  }
  
  // 2. From request body
  const body = c.get('requestBody') || {};
  if (body.organization_id) {
    return body.organization_id;
  }

  // 3. From query parameters
  const organizationId = c.req.query('organization_id');
  if (organizationId) {
    return organizationId;
  }

  // 4. From authentication context (set by auth middleware)
  const session = c.get('session');
  if (session?.organizationId) {
    return session.organizationId;
  }

  // 5. From user context
  const user = c.get('user');
  if (user?.currentOrganizationId) {
    return user.currentOrganizationId;
  }

  return null;
}

/**
 * Check trial status for an organization
 */
async function checkTrialStatus(c: Context, organizationId: string): Promise<{
  expired: boolean;
  needsUpgrade: boolean;
  tier: string;
  trialEndedAt?: Date;
  daysExpired?: number;
  daysRemaining?: number;
}> {
  const db = getKysely();

  // Get organization's trial status
  const organization = await db
    .selectFrom('organizations')
    .select(['subscription_tier', 'subscription_status', 'trial_ends_at'])
    .where('id', '=', organizationId)
    .executeTakeFirst();

  if (!organization) {
    throw new Error('Organization not found');
  }

  const tier = organization.subscription_tier || 'trial';
  const now = new Date();
  
  // If not on trial, always allow access
  if (tier !== 'trial') {
    return {
      expired: false,
      needsUpgrade: false,
      tier
    };
  }

  // Check if trial has expired
  const trialEndsAt = organization.trial_ends_at;
  if (!trialEndsAt) {
    // No trial end date set, assume active trial
    return {
      expired: false,
      needsUpgrade: false,
      tier,
      daysRemaining: 14
    };
  }

  const trialExpired = now > trialEndsAt;
  const timeDiff = Math.abs(now.getTime() - trialEndsAt.getTime());
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

  if (trialExpired) {
    return {
      expired: true,
      needsUpgrade: true,
      tier,
      trialEndedAt: trialEndsAt,
      daysExpired: daysDiff
    };
  } else {
    return {
      expired: false,
      needsUpgrade: false,
      tier,
      daysRemaining: daysDiff
    };
  }
}

/**
 * Utility function to check trial status programmatically
 */
export async function checkOrganizationTrialStatus(c: Context, organizationId: string) {
  return checkTrialStatus(c, organizationId);
}