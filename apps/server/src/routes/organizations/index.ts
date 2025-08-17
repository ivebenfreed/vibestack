import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { OrganizationSetupService, OrganizationTemplate } from '@vibestack/dataforge';
import { DefaultDataService } from '@vibestack/dataforge';
import { NeonDatabaseService } from '../../services/NeonDatabaseService.js';
import { createAuthMiddleware } from '../../middleware/auth.js';
import { AuthUser } from '../../types/api.js';

const app = new Hono<{ 
  Variables: { 
    user: AuthUser;
    organizationId?: string;
  } 
}>();

// Apply authentication middleware to all organization routes
app.use('*', createAuthMiddleware());

// Organization creation schema
const createOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  template: z.enum(['software_team', 'marketing_agency', 'consulting_firm', 'research_lab', 'generic_business']).default('generic_business'),
  settings: z.object({
    timeZone: z.string().default('UTC'),
    currency: z.string().default('USD'),
    allowPublicProjects: z.boolean().default(false)
  }).optional()
});

// Organization update schema
const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  settings: z.object({
    timeZone: z.string(),
    currency: z.string(),
    allowPublicProjects: z.boolean(),
    workingHours: z.object({
      start: z.number().min(0).max(23),
      end: z.number().min(0).max(23)
    }).optional(),
    workingDays: z.array(z.number().min(0).max(6)).optional()
  }).optional()
});

// Member invitation schema
const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
  message: z.string().optional()
});

/**
 * CREATE ORGANIZATION
 * POST /organizations
 */
app.post('/', zValidator('json', createOrganizationSchema), async (c) => {
  try {
    const user = c.get('user');
    const { name, slug, template, settings } = c.req.valid('json');

    // Check if slug is available
    const existingOrg = await checkSlugAvailability(slug);
    if (!existingOrg.available) {
      return c.json({
        success: false,
        error: 'Organization slug is already taken',
        code: 'SLUG_UNAVAILABLE'
      }, 409);
    }

    // Create organization record
    const organization = await createOrganizationRecord({
      name,
      slug,
      ownerId: user.id,
      settings: settings || {}
    });

    // Provision Neon database
    const neonService = new NeonDatabaseService();
    const database = await neonService.createOrganizationDatabase(organization.id, {
      name: `org_${slug}`,
      description: `Database for ${name} organization`,
      region: 'aws-us-east-1' // Default region
    });

    if (!database.success) {
      // Rollback organization creation if database fails
      await deleteOrganizationRecord(organization.id);
      return c.json({
        success: false,
        error: 'Failed to provision organization database',
        details: database.error,
        code: 'DATABASE_PROVISIONING_FAILED'
      }, 500);
    }

    // Update organization with database info
    await updateOrganizationDatabase(organization.id, {
      databaseUrl: database.connectionString,
      databaseBranch: database.branchName,
      databaseId: database.databaseId
    });

    // Initialize organization with default data
    const setupService = new OrganizationSetupService();
    const setupResult = await setupService.initializeOrganization(organization.id, template as OrganizationTemplate);

    if (!setupResult.success) {
      console.warn('Organization setup had errors:', setupResult.errors);
    }

    // Create sample data if requested
    const dataService = new DefaultDataService();
    const dataResult = await dataService.createDefaultData(organization.id, template as OrganizationTemplate, user.id);

    if (!dataResult.success) {
      console.warn('Default data creation had errors:', dataResult.errors);
    }

    // Add creator as organization admin
    await addOrganizationMember(organization.id, {
      userId: user.id,
      role: 'admin',
      status: 'active',
      joinedAt: new Date()
    });

    return c.json({
      success: true,
      data: {
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          template,
          createdAt: organization.createdAt,
          settings: organization.settings,
          database: {
            status: 'provisioned',
            region: database.region
          }
        },
        setup: {
          optionSetsCreated: setupResult.optionSets.length,
          sampleDataCreated: {
            projects: dataResult.createdEntities.projects.length,
            tasks: dataResult.createdEntities.tasks.length,
            files: dataResult.createdEntities.files.length
          }
        }
      }
    }, 201);

  } catch (error) {
    console.error('Organization creation failed:', error);
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
 * GET /organizations
 */
app.get('/', async (c) => {
  try {
    const user = c.get('user');
    const organizations = await getUserOrganizations(user.id);

    return c.json({
      success: true,
      data: {
        organizations: organizations.map(org => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          role: org.userRole,
          status: org.status,
          memberSince: org.joinedAt,
          settings: {
            timeZone: org.settings?.timeZone || 'UTC',
            currency: org.settings?.currency || 'USD'
          }
        }))
      }
    });

  } catch (error) {
    console.error('Failed to fetch organizations:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch organizations',
      code: 'FETCH_FAILED'
    }, 500);
  }
});

/**
 * GET ORGANIZATION BY ID
 * GET /organizations/:id
 */
app.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    const organizationId = c.req.param('id');

    // Check user access to organization
    // Admin and super_admin users have implicit access to all organizations
    let member = null;
    if (user.role === 'admin' || user.role === 'super_admin') {
      console.log(`[GET /organizations/:id] Admin user ${user.id} has implicit access to org ${organizationId}`);
      member = {
        user_id: user.id,
        organization_id: organizationId,
        role: 'admin',
        is_implicit: true
      };
    } else {
      member = await getOrganizationMember(organizationId, user.id);
    }
    
    if (!member) {
      return c.json({
        success: false,
        error: 'Organization not found or access denied',
        code: 'ACCESS_DENIED'
      }, 404);
    }

    const organization = await getOrganizationById(organizationId);
    if (!organization) {
      return c.json({
        success: false,
        error: 'Organization not found',
        code: 'NOT_FOUND'
      }, 404);
    }

    // Get organization statistics
    const stats = await getOrganizationStats(organizationId);
    
    // Get organization members (for admins)
    let members = undefined;
    if (member.role === 'admin') {
      members = await getOrganizationMembers(organizationId);
    }

    return c.json({
      success: true,
      data: {
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          createdAt: organization.createdAt,
          settings: organization.settings,
          userRole: member.role,
          stats: {
            totalMembers: stats.memberCount,
            activeProjects: stats.activeProjects,
            totalTasks: stats.totalTasks,
            diskUsage: stats.diskUsage
          }
        },
        members: members?.map(m => ({
          id: m.id,
          userId: m.userId,
          email: m.userEmail,
          name: m.userName,
          role: m.role,
          status: m.status,
          joinedAt: m.joinedAt,
          lastActive: m.lastActive
        }))
      }
    });

  } catch (error) {
    console.error('Failed to fetch organization:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch organization',
      code: 'FETCH_FAILED'
    }, 500);
  }
});

/**
 * UPDATE ORGANIZATION
 * PUT /organizations/:id
 */
app.put('/:id', zValidator('json', updateOrganizationSchema), async (c) => {
  try {
    const user = c.get('user');
    const organizationId = c.req.param('id');
    const updates = c.req.valid('json');

    // Check admin access
    const member = await getOrganizationMember(organizationId, user.id);
    if (!member || member.role !== 'admin') {
      return c.json({
        success: false,
        error: 'Administrative access required',
        code: 'INSUFFICIENT_PERMISSIONS'
      }, 403);
    }

    // Update organization
    const updatedOrg = await updateOrganization(organizationId, updates);

    return c.json({
      success: true,
      data: {
        organization: {
          id: updatedOrg.id,
          name: updatedOrg.name,
          slug: updatedOrg.slug,
          settings: updatedOrg.settings,
          updatedAt: updatedOrg.updatedAt
        }
      }
    });

  } catch (error) {
    console.error('Organization update failed:', error);
    return c.json({
      success: false,
      error: 'Failed to update organization',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'UPDATE_FAILED'
    }, 500);
  }
});

/**
 * INVITE MEMBER TO ORGANIZATION
 * POST /organizations/:id/members
 */
app.post('/:id/members', zValidator('json', inviteMemberSchema), async (c) => {
  try {
    const user = c.get('user');
    const organizationId = c.req.param('id');
    const { email, role, message } = c.req.valid('json');

    // Check admin access
    const member = await getOrganizationMember(organizationId, user.id);
    if (!member || member.role !== 'admin') {
      return c.json({
        success: false,
        error: 'Administrative access required',
        code: 'INSUFFICIENT_PERMISSIONS'
      }, 403);
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    let invitedUserId = existingUser?.id;

    // Create invitation
    const invitation = await createMemberInvitation({
      organizationId,
      email,
      role,
      invitedBy: user.id,
      message,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    // Send invitation email (implementation depends on email service)
    await sendInvitationEmail({
      email,
      organizationName: member.organizationName,
      inviterName: user.name,
      role,
      message,
      invitationId: invitation.id
    });

    return c.json({
      success: true,
      data: {
        invitation: {
          id: invitation.id,
          email,
          role,
          status: 'pending',
          expiresAt: invitation.expiresAt
        }
      }
    }, 201);

  } catch (error) {
    console.error('Member invitation failed:', error);
    return c.json({
      success: false,
      error: 'Failed to invite member',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'INVITATION_FAILED'
    }, 500);
  }
});

/**
 * REMOVE MEMBER FROM ORGANIZATION
 * DELETE /organizations/:id/members/:userId
 */
app.delete('/:id/members/:userId', async (c) => {
  try {
    const user = c.get('user');
    const organizationId = c.req.param('id');
    const targetUserId = c.req.param('userId');

    // Check admin access
    const member = await getOrganizationMember(organizationId, user.id);
    if (!member || member.role !== 'admin') {
      return c.json({
        success: false,
        error: 'Administrative access required',
        code: 'INSUFFICIENT_PERMISSIONS'
      }, 403);
    }

    // Cannot remove self
    if (targetUserId === user.id) {
      return c.json({
        success: false,
        error: 'Cannot remove yourself from organization',
        code: 'CANNOT_REMOVE_SELF'
      }, 400);
    }

    // Remove member
    await removeOrganizationMember(organizationId, targetUserId);

    return c.json({
      success: true,
      message: 'Member removed successfully'
    });

  } catch (error) {
    console.error('Member removal failed:', error);
    return c.json({
      success: false,
      error: 'Failed to remove member',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'REMOVAL_FAILED'
    }, 500);
  }
});

/**
 * DELETE ORGANIZATION
 * DELETE /organizations/:id
 */
app.delete('/:id', async (c) => {
  try {
    const user = c.get('user');
    const organizationId = c.req.param('id');

    // Check owner access
    const organization = await getOrganizationById(organizationId);
    if (!organization || organization.ownerId !== user.id) {
      return c.json({
        success: false,
        error: 'Only organization owner can delete organization',
        code: 'INSUFFICIENT_PERMISSIONS'
      }, 403);
    }

    // Delete Neon database
    const neonService = new NeonDatabaseService();
    if (organization.databaseId) {
      await neonService.deleteOrganizationDatabase(organization.databaseId);
    }

    // Delete organization and all related data
    await deleteOrganization(organizationId);

    return c.json({
      success: true,
      message: 'Organization deleted successfully'
    });

  } catch (error) {
    console.error('Organization deletion failed:', error);
    return c.json({
      success: false,
      error: 'Failed to delete organization',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'DELETION_FAILED'
    }, 500);
  }
});

// Placeholder implementations for database operations
// These would be implemented using your ORM/database layer

async function checkSlugAvailability(slug: string): Promise<{ available: boolean }> {
  // Implementation would check if slug exists in database
  return { available: true };
}

async function createOrganizationRecord(data: any): Promise<any> {
  // Implementation would create organization in database
  return {
    id: `org_${Date.now()}`,
    name: data.name,
    slug: data.slug,
    ownerId: data.ownerId,
    settings: data.settings,
    createdAt: new Date()
  };
}

async function deleteOrganizationRecord(id: string): Promise<void> {
  // Implementation would delete organization record
}

async function updateOrganizationDatabase(id: string, dbInfo: any): Promise<void> {
  // Implementation would update organization with database connection info
}

async function addOrganizationMember(orgId: string, memberData: any): Promise<void> {
  // Implementation would add member to organization
}

async function getUserOrganizations(userId: string): Promise<any[]> {
  // Implementation would fetch user's organizations with role info
  return [];
}

async function getOrganizationById(id: string): Promise<any> {
  // Implementation would fetch organization by ID
  return null;
}

async function getOrganizationMember(orgId: string, userId: string): Promise<any> {
  // TODO: Implement database lookup for explicit organization membership
  // For now, return null to rely on the admin check in the calling function
  console.log(`[getOrganizationMember] Checking explicit membership for user ${userId} in org ${orgId} - TODO: implement database lookup`);
  return null;
}

async function getOrganizationStats(orgId: string): Promise<any> {
  // Implementation would calculate organization statistics
  return {
    memberCount: 0,
    activeProjects: 0,
    totalTasks: 0,
    diskUsage: 0
  };
}

async function getOrganizationMembers(orgId: string): Promise<any[]> {
  // Implementation would fetch organization members
  return [];
}

async function updateOrganization(id: string, updates: any): Promise<any> {
  // Implementation would update organization
  return {};
}

async function getUserByEmail(email: string): Promise<any> {
  // Implementation would find user by email
  return null;
}

async function createMemberInvitation(data: any): Promise<any> {
  // Implementation would create invitation record
  return {
    id: `inv_${Date.now()}`,
    ...data
  };
}

async function sendInvitationEmail(data: any): Promise<void> {
  // Implementation would send invitation email
  console.log('Sending invitation email to:', data.email);
}

async function removeOrganizationMember(orgId: string, userId: string): Promise<void> {
  // Implementation would remove member from organization
}

async function deleteOrganization(id: string): Promise<void> {
  // Implementation would delete organization and all related data
}

export default app;