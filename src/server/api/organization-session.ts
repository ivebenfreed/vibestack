import { Hono } from "hono";
import { getAuth, AuthType } from "../lib/auth";
import { dbLogger } from "../middleware/logger";

const orgSessionRouter = new Hono<AuthType>();

// Get user's current active organization
orgSessionRouter.get("/active-organization", async (c) => {
  try {
    const user = c.var.user;
    const session = c.var.session;
    
    if (!user || !session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const authInstance = getAuth(c);
    const db = authInstance.options.database.db;
    
    // Get active organization from session
    const activeOrgId = session.activeOrganizationId;
    
    if (!activeOrgId) {
      return c.json({ 
        activeOrganization: null,
        message: "No active organization set" 
      });
    }

    // Get organization details
    const organization = await db
      .selectFrom('organization')
      .selectAll()
      .where('id', '=', activeOrgId)
      .executeTakeFirst();

    if (!organization) {
      return c.json({ 
        activeOrganization: null,
        message: "Active organization not found" 
      });
    }

    // Get user's role in this organization
    const membership = await db
      .selectFrom('member')
      .select(['role'])
      .where('userId', '=', user.id)
      .where('organizationId', '=', activeOrgId)
      .executeTakeFirst();

    dbLogger.info('Retrieved active organization', { 
      userId: user.id,
      organizationId: activeOrgId,
      role: membership?.role
    });

    return c.json({
      activeOrganization: {
        ...organization,
        userRole: membership?.role || null
      }
    });

  } catch (error) {
    dbLogger.error('Error getting active organization', error);
    return c.json({ error: "Failed to get active organization" }, 500);
  }
});

// Set user's active organization
orgSessionRouter.post("/set-active-organization", async (c) => {
  try {
    const user = c.var.user;
    const session = c.var.session;
    
    if (!user || !session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();
    const { organizationId } = body;

    if (!organizationId) {
      return c.json({ error: "organizationId is required" }, 400);
    }

    const authInstance = getAuth(c);
    const db = authInstance.options.database.db;
    
    // Verify user is a member of this organization
    const membership = await db
      .selectFrom('member')
      .selectAll()
      .where('userId', '=', user.id)
      .where('organizationId', '=', organizationId)
      .executeTakeFirst();

    if (!membership) {
      return c.json({ 
        error: "User is not a member of this organization" 
      }, 403);
    }

    // Update session with active organization
    await db
      .updateTable('session')
      .set({ activeOrganizationId: organizationId })
      .where('id', '=', session.id)
      .execute();

    // Get organization details for response
    const organization = await db
      .selectFrom('organization')
      .selectAll()
      .where('id', '=', organizationId)
      .executeTakeFirst();

    dbLogger.info('Set active organization', { 
      userId: user.id,
      organizationId,
      role: membership.role
    });

    return c.json({
      message: "Active organization set successfully",
      activeOrganization: {
        ...organization,
        userRole: membership.role
      }
    });

  } catch (error) {
    dbLogger.error('Error setting active organization', error);
    return c.json({ error: "Failed to set active organization" }, 500);
  }
});

// Get all organizations for current user
orgSessionRouter.get("/user-organizations", async (c) => {
  try {
    const user = c.var.user;
    
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const authInstance = getAuth(c);
    const db = authInstance.options.database.db;
    
    // Get all organizations where user is a member
    const organizations = await db
      .selectFrom('organization')
      .innerJoin('member', 'organization.id', 'member.organizationId')
      .select([
        'organization.id',
        'organization.name', 
        'organization.slug',
        'organization.logo',
        'organization.metadata',
        'organization.createdAt',
        'member.role'
      ])
      .where('member.userId', '=', user.id)
      .orderBy('organization.name', 'asc')
      .execute();

    dbLogger.info('Retrieved user organizations', { 
      userId: user.id,
      organizationCount: organizations.length
    });

    return c.json({
      organizations: organizations.map(org => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo: org.logo,
        metadata: org.metadata,
        createdAt: org.createdAt,
        userRole: org.role
      }))
    });

  } catch (error) {
    dbLogger.error('Error getting user organizations', error);
    return c.json({ error: "Failed to get user organizations" }, 500);
  }
});

// Clear active organization (set to null)
orgSessionRouter.post("/clear-active-organization", async (c) => {
  try {
    const user = c.var.user;
    const session = c.var.session;
    
    if (!user || !session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const authInstance = getAuth(c);
    const db = authInstance.options.database.db;
    
    // Clear active organization from session
    await db
      .updateTable('session')
      .set({ activeOrganizationId: null })
      .where('id', '=', session.id)
      .execute();

    dbLogger.info('Cleared active organization', { 
      userId: user.id,
      sessionId: session.id
    });

    return c.json({
      message: "Active organization cleared successfully",
      activeOrganization: null
    });

  } catch (error) {
    dbLogger.error('Error clearing active organization', error);
    return c.json({ error: "Failed to clear active organization" }, 500);
  }
});

export default orgSessionRouter;