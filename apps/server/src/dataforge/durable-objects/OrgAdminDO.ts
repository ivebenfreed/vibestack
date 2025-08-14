/**
 * Organization Admin Durable Object
 * 
 * Per-org access control cache layer for performance.
 * Caches frequently accessed permission data from PostgreSQL.
 * Syncs with PostgreSQL source of truth for user-org relationships.
 */

import { Actor } from '@cloudflare/actors';

export interface CachedMember {
  id: string;
  userId: string;
  role: 'admin' | 'member' | 'viewer';
  status: 'active' | 'suspended' | 'pending';
  joinedAt: string;
  lastActiveAt?: string;
  permissions?: string[];
}

export interface CachedOrganization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  status: 'active' | 'suspended' | 'deleted';
  planType: 'free' | 'pro' | 'enterprise';
  settings: any;
  lastSyncAt: string;
}

export interface AccessControlCache {
  organization: CachedOrganization;
  members: Record<string, CachedMember>; // userId -> member
  lastSyncAt: string;
  version: number;
}

export class OrgAdminDO extends Actor<any> {
  private orgId: string = '';
  
  constructor(ctx: any, env: any) {
    super(ctx, env);
    
    // Extract org ID from DO name
    this.orgId = ctx.id?.toString() || 'unknown';
    
    // Access control cache storage schema
    this.storage.migrations = [
      {
        tag: 'v1-org-access-control',
        description: 'Create org access control cache tables',
        sql: `
          CREATE TABLE IF NOT EXISTS org_cache (
            id INTEGER PRIMARY KEY DEFAULT 1,
            org_id TEXT NOT NULL,
            org_data TEXT NOT NULL,
            last_sync_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            version INTEGER DEFAULT 1
          );
          
          CREATE TABLE IF NOT EXISTS member_cache (
            user_id TEXT PRIMARY KEY,
            member_data TEXT NOT NULL,
            last_sync_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE TABLE IF NOT EXISTS permission_cache (
            user_id TEXT PRIMARY KEY,
            permissions TEXT NOT NULL,
            last_checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `
      }
    ];
  }

  /**
   * Initialize cache storage
   */
  private async ensureInitialized(): Promise<void> {
    try {
      await this.storage.sql`SELECT 1 FROM org_cache LIMIT 1`;
    } catch (error) {
      console.log('Creating org access control cache tables');
      
      // Create tables individually
      await this.storage.sql`
        CREATE TABLE org_cache (
          id INTEGER PRIMARY KEY DEFAULT 1,
          org_id TEXT NOT NULL,
          org_data TEXT NOT NULL,
          last_sync_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          version INTEGER DEFAULT 1
        )
      `;
      
      await this.storage.sql`
        CREATE TABLE member_cache (
          user_id TEXT PRIMARY KEY,
          member_data TEXT NOT NULL,
          last_sync_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      await this.storage.sql`
        CREATE TABLE permission_cache (
          user_id TEXT PRIMARY KEY,
          permissions TEXT NOT NULL,
          last_checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      console.log('Org access control cache initialized for:', this.orgId);
    }
  }

  /**
   * Sync organization data from PostgreSQL truth
   */
  async syncFromPostgreSQL(postgresData: {
    organization: any;
    members: any[];
  }): Promise<{ success: boolean; cached?: AccessControlCache; error?: string }> {
    await this.ensureInitialized();
    
    try {
      const now = new Date().toISOString();
      
      // Cache organization data
      const orgData: CachedOrganization = {
        id: postgresData.organization.id,
        name: postgresData.organization.name,
        slug: postgresData.organization.slug,
        ownerId: postgresData.organization.owner_id,
        status: postgresData.organization.status,
        planType: postgresData.organization.plan_type,
        settings: postgresData.organization.settings || {},
        lastSyncAt: now
      };
      
      // Store org data
      await this.storage.sql`
        INSERT OR REPLACE INTO org_cache (id, org_id, org_data, last_sync_at, version)
        VALUES (1, ${this.orgId}, ${JSON.stringify(orgData)}, ${now}, 1)
      `;
      
      // Cache member data
      const memberMap: Record<string, CachedMember> = {};
      for (const member of postgresData.members) {
        const cachedMember: CachedMember = {
          id: member.id,
          userId: member.user_id,
          role: member.role,
          status: member.status || 'active',
          joinedAt: member.joined_at || member.created_at,
          lastActiveAt: member.last_active_at,
          permissions: this.getRolePermissions(member.role)
        };
        
        memberMap[member.user_id] = cachedMember;
        
        // Store individual member cache
        await this.storage.sql`
          INSERT OR REPLACE INTO member_cache (user_id, member_data, last_sync_at)
          VALUES (${member.user_id}, ${JSON.stringify(cachedMember)}, ${now})
        `;
        
        // Store permission cache
        await this.storage.sql`
          INSERT OR REPLACE INTO permission_cache (user_id, permissions, last_checked_at)
          VALUES (${member.user_id}, ${JSON.stringify(cachedMember.permissions)}, ${now})
        `;
      }
      
      const cache: AccessControlCache = {
        organization: orgData,
        members: memberMap,
        lastSyncAt: now,
        version: 1
      };
      
      return { success: true, cached: cache };
    } catch (error) {
      console.error('Failed to sync from PostgreSQL:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Sync failed' };
    }
  }

  /**
   * Check if user has access to organization
   */
  async checkUserAccess(userId: string): Promise<{
    hasAccess: boolean;
    member?: CachedMember;
    permissions?: string[];
    needsSync?: boolean;
  }> {
    await this.ensureInitialized();
    
    try {
      // Get cached member data
      const memberRows = await this.storage.sql`
        SELECT member_data, last_sync_at FROM member_cache WHERE user_id = ${userId}
      `;
      
      if (memberRows.length === 0) {
        return { hasAccess: false, needsSync: true };
      }
      
      const memberData: CachedMember = JSON.parse(memberRows[0].member_data as string);
      const lastSync = new Date(memberRows[0].last_sync_at as string);
      const now = new Date();
      
      // Check if cache is stale (older than 5 minutes)
      const cacheAge = now.getTime() - lastSync.getTime();
      const isStale = cacheAge > 5 * 60 * 1000; // 5 minutes
      
      return {
        hasAccess: memberData.status === 'active',
        member: memberData,
        permissions: memberData.permissions,
        needsSync: isStale
      };
    } catch (error) {
      console.error('Failed to check user access:', error);
      return { hasAccess: false, needsSync: true };
    }
  }

  /**
   * Get organization data from cache
   */
  async getOrganizationCache(): Promise<CachedOrganization | null> {
    await this.ensureInitialized();
    
    try {
      const orgRows = await this.storage.sql`
        SELECT org_data FROM org_cache WHERE id = 1
      `;
      
      if (orgRows.length === 0) return null;
      
      return JSON.parse(orgRows[0].org_data as string);
    } catch (error) {
      console.error('Failed to get organization cache:', error);
      return null;
    }
  }

  /**
   * Get all cached members
   */
  async getAllMembers(): Promise<CachedMember[]> {
    await this.ensureInitialized();
    
    try {
      const memberRows = await this.storage.sql`
        SELECT member_data FROM member_cache ORDER BY last_sync_at DESC
      `;
      
      return memberRows.map(row => JSON.parse(row.member_data as string));
    } catch (error) {
      console.error('Failed to get all members:', error);
      return [];
    }
  }

  /**
   * Invalidate cache for user (force re-sync)
   */
  async invalidateUser(userId: string): Promise<{ success: boolean }> {
    await this.ensureInitialized();
    
    try {
      await this.storage.sql`DELETE FROM member_cache WHERE user_id = ${userId}`;
      await this.storage.sql`DELETE FROM permission_cache WHERE user_id = ${userId}`;
      
      return { success: true };
    } catch (error) {
      console.error('Failed to invalidate user cache:', error);
      return { success: false };
    }
  }

  /**
   * Get role-based permissions
   */
  private getRolePermissions(role: string): string[] {
    switch (role) {
      case 'admin':
        return [
          'org:read', 'org:write', 'org:admin',
          'members:read', 'members:write', 'members:admin',
          'entities:read', 'entities:write', 'entities:admin',
          'invitations:send', 'invitations:manage'
        ];
      case 'member':
        return [
          'org:read',
          'members:read',
          'entities:read', 'entities:write'
        ];
      case 'viewer':
        return [
          'org:read',
          'members:read',
          'entities:read'
        ];
      default:
        return [];
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
          if (url.pathname === '/sync') {
            const body = await request.json();
            const result = await this.syncFromPostgreSQL(body);
            return new Response(JSON.stringify(result), {
              status: result.success ? 200 : 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          if (url.pathname === '/invalidate') {
            const { userId } = await request.json();
            const result = await this.invalidateUser(userId);
            return new Response(JSON.stringify(result), {
              status: result.success ? 200 : 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;
          
        case 'GET':
          if (url.pathname.startsWith('/access/')) {
            const userId = url.pathname.split('/')[2];
            const access = await this.checkUserAccess(userId);
            return new Response(JSON.stringify(access), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          if (url.pathname === '/organization') {
            const org = await this.getOrganizationCache();
            return new Response(JSON.stringify(org), {
              status: org ? 200 : 404,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          if (url.pathname === '/members') {
            const members = await this.getAllMembers();
            return new Response(JSON.stringify(members), {
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