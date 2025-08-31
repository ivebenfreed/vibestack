/**
 * Organization Access Service
 * 
 * Manages the three-tier architecture:
 * PostgreSQL (truth) → Durable Objects (cache) → API (fast lookups)
 * 
 * Handles synchronization between PostgreSQL source of truth
 * and organization access control for performance.
 */

import type { Kysely } from 'kysely';
import type { HardcodedDatabase } from '../dataforge/base/hardcoded-database';
// OrgOpsDO archived - define types locally for now
export interface CachedMember {
  id: string;
  userId: string;
  role: string;
  status: string;
  joinedAt: string;
  lastActiveAt?: string;
  permissions?: string[];
}

export interface CachedOrganization {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  settings?: any;
}

export interface UserOrgAccess {
  hasAccess: boolean;
  role?: string;
  permissions?: string[];
  organization?: any;
  member?: any;
  fromCache?: boolean;
}

export interface OrgSyncData {
  organization: any;
  members: any[];
  syncedAt: string;
}

export class OrgAccessService {
  constructor(
    private kysely: Kysely<HardcodedDatabase>,
    private env: any // Cloudflare env for DO bindings
  ) {}

  /**
   * Check user access with cache-first lookup
   * Falls back to PostgreSQL if cache miss or stale
   */
  async checkUserOrgAccess(
    userId: string,
    orgSlug: string
  ): Promise<UserOrgAccess> {
    try {
      // 1. Get organization ID from PostgreSQL (always fresh)
      const org = await this.kysely
        .selectFrom('organizations as o')
        .select(['o.id', 'o.name', 'o.slug'])
        .where('o.slug', '=', orgSlug)
        .executeTakeFirst();

      if (!org) {
        return { hasAccess: false };
      }

      // 2. Check cache first (Organization Actor)
      if (this.env.ORGANIZATION_ACTOR) {
        try {
          const orgActorId = this.env.ORGANIZATION_ACTOR.idFromName(`org:${org.id}`);
          const orgActor = this.env.ORGANIZATION_ACTOR.get(orgActorId);
          
          const response = await orgActor.fetch(new Request(`https://internal/role-check?userId=${userId}&organizationId=${org.id}`));
          if (response.ok) {
            const cacheResult = await response.json();
            
            // If cache is fresh and user has role, return immediately
            if (cacheResult.cached && cacheResult.role) {
              console.log('🔍 OrgAccessService Organization Actor cache hit:', {
                userId,
                orgId: org.id,
                orgSlug,
                cachedRole: cacheResult.role.role,
                cacheResult
              });

              return {
                hasAccess: true,
                role: cacheResult.role.role,
                permissions: cacheResult.role.permissions,
                organization: org,
                member: { userId, role: cacheResult.role.role },
                fromCache: true
              };
            }
            
            // Cache miss or stale - need to sync from PostgreSQL
          }
        } catch (error) {
          console.warn('Organization Actor cache lookup failed, falling back to PostgreSQL:', error);
        }
      }

      // 3. Fallback to PostgreSQL truth
      const member = await this.kysely
        .selectFrom('organization_members as m')
        .innerJoin('user as u', 'u.id', 'm.user_id')
        .select([
          'm.id',
          'm.user_id as userId',
          'm.role',
          'm.created_at as createdAt',
          'u.name as user_name',
          'u.email as user_email'
        ])
        .where('m.organization_id', '=', org.id)
        .where('m.user_id', '=', userId)
        .executeTakeFirst();

      if (!member) {
        // User not in organization - sync empty cache
        await this.syncOrgCache(org.id, { organization: org, members: [] });
        return { hasAccess: false };
      }

      // 4. Sync cache with current data
      const allMembers = await this.kysely
        .selectFrom('organization_members as m')
        .innerJoin('user as u', 'u.id', 'm.user_id')
        .select([
          'm.id',
          'm.organization_id as organizationId',
          'm.user_id as userId',
          'm.role',
          'm.created_at as createdAt',
          'u.name as user_name',
          'u.email as user_email'
        ])
        .where('m.organization_id', '=', org.id)
        .execute();

      await this.syncOrgCache(org.id, {
        organization: org,
        members: allMembers
      });

      console.log('🔍 OrgAccessService PostgreSQL role resolution:', {
        userId,
        userEmail: member.user_email,
        orgSlug,
        resolvedRole: member.role,
        memberData: JSON.stringify(member, null, 2)
      });

      return {
        hasAccess: true,
        role: member.role,
        permissions: this.getRolePermissions(member.role),
        organization: org,
        member,
        fromCache: false
      };

    } catch (error) {
      console.error('Failed to check user org access:', error);
      return { hasAccess: false };
    }
  }

  /**
   * Get organization by ID
   */
  async getOrganizationById(organizationId: string): Promise<{ id: string; name: string; slug: string } | null> {
    try {
      const org = await this.kysely
        .selectFrom('organizations as o')
        .select(['o.id', 'o.name', 'o.slug'])
        .where('o.id', '=', organizationId)
        .executeTakeFirst();

      return org || null;
    } catch (error) {
      console.error('Failed to get organization by ID:', error);
      return null;
    }
  }

  /**
   * Get user's organizations with caching
   */
  async getUserOrganizations(userId: string, userRole?: string): Promise<Array<{
    organization: any;
    member: any;
    role: string;
  }>> {
    try {
      // Get from PostgreSQL (source of truth)
      const results = await this.kysely
        .selectFrom('organizations as o')
        .innerJoin('organization_members as m', 'm.organization_id', 'o.id')
        .select([
          'o.id as org_id',
          'o.name as org_name', 
          'o.slug as org_slug',
          'o.created_at as org_created_at',
          'm.id as member_id',
          'm.role as member_role',
          'm.created_at as member_created_at'
        ])
        .where('m.user_id', '=', userId)
        .execute();

      const organizations = results.map(row => ({
        organization: {
          id: row.org_id,
          name: row.org_name,
          slug: row.org_slug,
          status: row.org_status,
          created_at: row.org_created_at
        },
        member: {
          id: row.member_id,
          role: row.member_role,
          created_at: row.member_created_at
        },
        role: row.member_role as string
      }));

      // Async cache sync for each organization
      for (const orgData of organizations) {
        this.syncOrgCacheAsync(orgData.organization.id).catch(error => {
          console.warn(`Failed to sync cache for org ${orgData.organization.id}:`, error);
        });
      }

      return organizations;
    } catch (error) {
      console.error('Failed to get user organizations:', error);
      return [];
    }
  }

  /**
   * Create organization with immediate cache sync
   */
  async createOrganization(data: {
    name: string;
    slug: string;
    ownerId: string;
  }): Promise<{ success: boolean; organization?: any; error?: string }> {
    try {
      // 1. Create in PostgreSQL truth
      const orgId = crypto.randomUUID();
      const now = new Date();

      await this.kysely
        .insertInto('organization')
        .values({
          id: orgId,
          name: data.name,
          slug: data.slug,
          createdAt: now
        })
        .execute();

      // 2. Add owner as owner member (Better Auth will handle this automatically)
      const memberId = crypto.randomUUID();
      await this.kysely
        .insertInto('member')
        .values({
          id: memberId,
          organizationId: orgId,
          userId: data.ownerId,
          role: 'owner', // Creator gets owner role
          createdAt: now
        })
        .execute();

      // 3. Get fresh data for cache sync
      const organization = await this.kysely
        .selectFrom('organization')
        .selectAll()
        .where('id', '=', orgId)
        .executeTakeFirst();

      const members = await this.kysely
        .selectFrom('member as m')
        .innerJoin('user as u', 'u.id', 'm.userId')
        .select([
          'm.id',
          'm.organizationId',
          'm.userId',
          'm.role',
          'm.created_at',
          'u.name as user_name',
          'u.email as user_email'
        ])
        .where('m.organizationId', '=', orgId)
        .execute();

      // 4. Sync cache immediately
      await this.syncOrgCache(orgId, {
        organization,
        members
      });

      return { success: true, organization };
    } catch (error) {
      console.error('Failed to create organization:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Creation failed' 
      };
    }
  }

  /**
   * Add member to organization with cache invalidation
   */
  async addMember(
    orgId: string, 
    userId: string, 
    role: string = 'member'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Add to PostgreSQL truth
      const memberId = crypto.randomUUID();
      await this.kysely
        .insertInto('member')
        .values({
          id: memberId,
          organizationId: orgId,
          userId: userId,
          role,
          createdAt: new Date()
        })
        .execute();

      // 2. Invalidate cache for immediate re-sync
      await this.invalidateOrgCache(orgId);

      return { success: true };
    } catch (error) {
      console.error('Failed to add member:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to add member' 
      };
    }
  }

  /**
   * Remove member from organization with cache invalidation
   */
  async removeMember(orgId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. Remove from PostgreSQL truth
      await this.kysely
        .deleteFrom('member')
        .where('organizationId', '=', orgId)
        .where('userId', '=', userId)
        .execute();

      // 2. Invalidate cache for immediate re-sync
      await this.invalidateOrgCache(orgId);

      return { success: true };
    } catch (error) {
      console.error('Failed to remove member:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to remove member' 
      };
    }
  }

  /**
   * Sync organization cache with PostgreSQL truth
   */
  private async syncOrgCache(orgId: string, data: {
    organization: any;
    members: any[];
  }): Promise<void> {
    if (!this.env.ORGANIZATION_ACTOR) {
      console.warn('ORGANIZATION_ACTOR binding not available for cache sync');
      return;
    }

    try {
      const orgActorId = this.env.ORGANIZATION_ACTOR.idFromName(`org:${orgId}`);
      const orgActor = this.env.ORGANIZATION_ACTOR.get(orgActorId);
      
      // Bulk cache all member roles
      const roles = data.members.map(member => ({
        userId: member.userId,
        role: member.role,
        permissions: this.getRolePermissions(member.role)
      }));
      
      const response = await orgActor.fetch(new Request('https://internal/bulk-cache-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roles: roles.map(role => ({
            ...role,
            organizationId: orgId
          }))
        })
      }));

      if (!response.ok) {
        console.warn('Organization Actor cache sync failed:', await response.text());
      }
    } catch (error) {
      console.warn('Failed to sync Organization Actor cache:', error);
    }
  }

  /**
   * Async cache sync (fire and forget)
   */
  private async syncOrgCacheAsync(orgId: string): Promise<void> {
    try {
      const organization = await this.kysely
        .selectFrom('organizations')
        .selectAll()
        .where('id', '=', orgId)
        .executeTakeFirst();

      if (!organization) return;

      const members = await this.kysely
        .selectFrom('organization_members as m')
        .innerJoin('user as u', 'u.id', 'm.user_id')
        .select([
          'm.id',
          'm.organization_id', 
          'm.user_id',
          'm.role',
          'm.created_at',
          'u.name as user_name',
          'u.email as user_email'
        ])
        .where('m.organization_id', '=', orgId)
        .execute();

      await this.syncOrgCache(orgId, { organization, members });
    } catch (error) {
      console.warn('Async cache sync failed:', error);
    }
  }

  /**
   * Invalidate organization cache
   */
  private async invalidateOrgCache(orgId: string): Promise<void> {
    if (!this.env.ORGANIZATION_ACTOR) return;

    try {
      const orgActorId = this.env.ORGANIZATION_ACTOR.idFromName(`org:${orgId}`);
      const orgActor = this.env.ORGANIZATION_ACTOR.get(orgActorId);
      
      // Invalidate all cached roles to force fresh sync
      const response = await orgActor.fetch(new Request('https://internal/invalidate-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId })
      }));

      if (!response.ok) {
        console.warn('Organization Actor cache invalidation failed:', await response.text());
      }
    } catch (error) {
      console.warn('Failed to invalidate Organization Actor cache:', error);
    }
  }

  /**
   * Get role-based permissions using minimum floor inheritance model
   * Each role includes permissions from lower roles
   */
  private getRolePermissions(role: string): string[] {
    switch (role) {
      case 'owner':
        return [
          'org:read', 'org:write', 'org:admin', 'org:delete', 'org:billing',
          'members:read', 'members:write', 'members:admin',
          'entities:read', 'entities:write', 'entities:admin',
          'invitations:send', 'invitations:manage',
          'roles:assign', 'roles:revoke'
        ];
      case 'admin':
        return [
          'org:read', 'org:write', 'org:admin',
          'members:read', 'members:write', 'members:admin',
          'entities:read', 'entities:write', 'entities:admin',
          'invitations:send', 'invitations:manage',
          'roles:assign' // Can assign up to manager role
        ];
      case 'manager':
        return [
          'org:read', 'org:write',
          'members:read', 'members:invite',
          'entities:read', 'entities:write', 'entities:admin',
          'invitations:send'
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
}