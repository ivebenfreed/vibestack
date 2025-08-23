/**
 * Super Admin Durable Object
 * 
 * Platform-level orchestration for organization management.
 * Handles org creation, deletion, billing, user assignments, and platform stats.
 * SEPARATE from entity management - this is pure platform administration.
 */

import { Actor } from '@cloudflare/actors';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  status: 'active' | 'suspended' | 'deleted';
  planType: 'free' | 'pro' | 'enterprise';
  settings: {
    timeZone: string;
    currency: string;
    maxMembers: number;
    maxEntities: number;
  };
  billing?: {
    customerId: string;
    subscriptionId: string;
    currentPeriodEnd: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: 'admin' | 'member' | 'viewer';
  status: 'active' | 'suspended' | 'pending';
  joinedAt: string;
}

export class SuperAdminDO extends Actor<any> {
  constructor(ctx: any, env: any) {
    super(ctx, env);
    
    // Platform admin storage schema
    this.storage.migrations = [
      {
        tag: 'v1-platform-admin',
        description: 'Create platform administration tables',
        sql: `
          CREATE TABLE IF NOT EXISTS organizations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            owner_id TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            plan_type TEXT DEFAULT 'free',
            settings TEXT NOT NULL,
            billing TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE TABLE IF NOT EXISTS organization_members (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT DEFAULT 'member',
            status TEXT DEFAULT 'active',
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(organization_id, user_id),
            FOREIGN KEY(organization_id) REFERENCES organizations(id)
          );
          
          CREATE TABLE IF NOT EXISTS platform_stats (
            id INTEGER PRIMARY KEY DEFAULT 1,
            total_organizations INTEGER DEFAULT 0,
            total_users INTEGER DEFAULT 0,
            total_entities INTEGER DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `
      }
    ];
  }

  /**
   * Initialize platform storage
   */
  private async ensureInitialized(): Promise<void> {
    try {
      await this.storage.sql`SELECT 1 FROM organizations LIMIT 1`;
    } catch (error) {
      console.log('Creating platform admin storage tables');
      
      // Create tables individually with simple SQL
      await this.storage.sql`
        CREATE TABLE organizations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT UNIQUE NOT NULL,
          owner_id TEXT NOT NULL,
          status TEXT DEFAULT 'active',
          plan_type TEXT DEFAULT 'free',
          settings TEXT NOT NULL,
          billing TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      await this.storage.sql`
        CREATE TABLE organization_members (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          role TEXT DEFAULT 'member',
          status TEXT DEFAULT 'active',
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      await this.storage.sql`
        CREATE UNIQUE INDEX idx_org_members_unique ON organization_members(organization_id, user_id)
      `;
      
      await this.storage.sql`
        CREATE TABLE platform_stats (
          id INTEGER PRIMARY KEY DEFAULT 1,
          total_organizations INTEGER DEFAULT 0,
          total_users INTEGER DEFAULT 0,
          total_entities INTEGER DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      // Initialize platform stats
      await this.storage.sql`
        INSERT INTO platform_stats (total_organizations, total_users, total_entities)
        VALUES (0, 0, 0)
      `;
      
      console.log('Platform admin storage initialized');
    }
  }

  /**
   * Create new organization
   */
  async createOrganization(data: {
    name: string;
    slug: string;
    ownerId: string;
    planType?: string;
    settings?: any;
  }): Promise<{ success: boolean; organization?: Organization; error?: string }> {
    await this.ensureInitialized();
    
    try {
      // Check slug availability
      const existing = await this.storage.sql`
        SELECT id FROM organizations WHERE slug = ${data.slug}
      `;
      
      if (existing.length > 0) {
        return { success: false, error: 'Slug already taken' };
      }
      
      const orgId = crypto.randomUUID();
      const now = new Date().toISOString();
      
      const organization: Organization = {
        id: orgId,
        name: data.name,
        slug: data.slug,
        ownerId: data.ownerId,
        status: 'active',
        planType: (data.planType as any) || 'free',
        settings: {
          timeZone: 'UTC',
          currency: 'USD',
          maxMembers: 10,
          maxEntities: 50,
          ...data.settings
        },
        createdAt: now,
        updatedAt: now
      };
      
      // Store organization
      await this.storage.sql`
        INSERT INTO organizations (id, name, slug, owner_id, status, plan_type, settings, created_at, updated_at)
        VALUES (${orgId}, ${data.name}, ${data.slug}, ${data.ownerId}, 'active', ${organization.planType}, ${JSON.stringify(organization.settings)}, ${now}, ${now})
      `;
      
      // Add owner as admin member
      await this.addMember(orgId, data.ownerId, 'admin');
      
      // Update platform stats
      await this.storage.sql`
        UPDATE platform_stats 
        SET total_organizations = total_organizations + 1,
            updated_at = CURRENT_TIMESTAMP
      `;
      
      return { success: true, organization };
    } catch (error) {
      console.error('Failed to create organization:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Creation failed' };
    }
  }

  /**
   * Add member to organization
   */
  async addMember(organizationId: string, userId: string, role: string = 'member'): Promise<{ success: boolean; error?: string }> {
    await this.ensureInitialized();
    
    try {
      const memberId = crypto.randomUUID();
      const now = new Date().toISOString();
      
      await this.storage.sql`
        INSERT INTO organization_members (id, organization_id, user_id, role, status, joined_at)
        VALUES (${memberId}, ${organizationId}, ${userId}, ${role}, 'active', ${now})
      `;
      
      return { success: true };
    } catch (error) {
      console.error('Failed to add member:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add member' };
    }
  }

  /**
   * Get organization by ID
   */
  async getOrganization(orgId: string): Promise<Organization | null> {
    await this.ensureInitialized();
    
    const rows = await this.storage.sql`
      SELECT * FROM organizations WHERE id = ${orgId}
    `;
    
    if (rows.length === 0) return null;
    
    const row = rows[0];
    return {
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      ownerId: row.owner_id as string,
      status: row.status as any,
      planType: row.plan_type as any,
      settings: JSON.parse(row.settings as string),
      billing: row.billing ? JSON.parse(row.billing as string) : undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string
    };
  }

  /**
   * Get user's organizations
   */
  async getUserOrganizations(userId: string): Promise<Array<Organization & { role: string }>> {
    await this.ensureInitialized();
    
    const rows = await this.storage.sql`
      SELECT o.*, om.role 
      FROM organizations o
      JOIN organization_members om ON o.id = om.organization_id
      WHERE om.user_id = ${userId} AND om.status = 'active'
      ORDER BY om.joined_at DESC
    `;
    
    return rows.map(row => ({
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      ownerId: row.owner_id as string,
      status: row.status as any,
      planType: row.plan_type as any,
      settings: JSON.parse(row.settings as string),
      billing: row.billing ? JSON.parse(row.billing as string) : undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      role: row.role as string
    }));
  }

  /**
   * Get platform statistics
   */
  async getPlatformStats(): Promise<any> {
    await this.ensureInitialized();
    
    const stats = await this.storage.sql`
      SELECT * FROM platform_stats WHERE id = 1
    `;
    
    if (stats.length === 0) {
      return { totalOrganizations: 0, totalUsers: 0, totalEntities: 0 };
    }
    
    return {
      totalOrganizations: stats[0].total_organizations,
      totalUsers: stats[0].total_users,
      totalEntities: stats[0].total_entities,
      lastUpdated: stats[0].updated_at
    };
  }

  /**
   * Delete organization (admin operation)
   */
  async deleteOrganization(orgId: string): Promise<{ success: boolean; error?: string }> {
    await this.ensureInitialized();
    
    try {
      // Remove all members
      await this.storage.sql`
        DELETE FROM organization_members WHERE organization_id = ${orgId}
      `;
      
      // Remove organization
      await this.storage.sql`
        DELETE FROM organizations WHERE id = ${orgId}
      `;
      
      // Update platform stats
      await this.storage.sql`
        UPDATE platform_stats 
        SET total_organizations = total_organizations - 1,
            updated_at = CURRENT_TIMESTAMP
      `;
      
      return { success: true };
    } catch (error) {
      console.error('Failed to delete organization:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Deletion failed' };
    }
  }

  /**
   * Handle HTTP requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    
    try {
      switch (method) {
        case 'POST':
          if (url.pathname === '/organizations') {
            const body = await request.json();
            const result = await this.createOrganization(body);
            return new Response(JSON.stringify(result), {
              status: result.success ? 201 : 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          if (url.pathname.match(/\/organizations\/[^\/]+\/members$/)) {
            const orgId = url.pathname.split('/')[2];
            const body = await request.json();
            const result = await this.addMember(orgId, body.userId, body.role);
            return new Response(JSON.stringify(result), {
              status: result.success ? 201 : 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;
          
        case 'GET':
          if (url.pathname === '/stats') {
            const stats = await this.getPlatformStats();
            return new Response(JSON.stringify(stats), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          if (url.pathname.startsWith('/organizations/')) {
            const orgId = url.pathname.split('/')[2];
            const org = await this.getOrganization(orgId);
            return new Response(JSON.stringify(org), {
              status: org ? 200 : 404,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          if (url.pathname.startsWith('/users/') && url.pathname.endsWith('/organizations')) {
            const userId = url.pathname.split('/')[2];
            const orgs = await this.getUserOrganizations(userId);
            return new Response(JSON.stringify(orgs), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;
          
        case 'DELETE':
          if (url.pathname.startsWith('/organizations/')) {
            const orgId = url.pathname.split('/')[2];
            const result = await this.deleteOrganization(orgId);
            return new Response(JSON.stringify(result), {
              status: result.success ? 200 : 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;
      }
      
      return new Response('Not found', { status: 404 });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}