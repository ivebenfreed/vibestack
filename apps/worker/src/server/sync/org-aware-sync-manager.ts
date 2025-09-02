/**
 * Organization-Aware Sync Manager
 * 
 * Handles organization context extraction, validation, and permission checking
 * for sync operations. Integrates with Better Auth for fast
 * organization-scoped sync filtering.
 */

import type { Env } from '../types/env';
import type { MinimalContext } from '../types/hono';
import { initializeAuth } from '../lib/auth';
import { OrgAccessService } from '../services/org-access-service';
import { createKyselyForPersistentUse, withKysely } from '../lib/database-manager';
import type { TableChange } from '@repo/sync-types';
import { syncLogger } from '../middleware/logger';

const MODULE_NAME = 'OrgAwareSyncManager';

export interface SyncConnection {
  clientId: string;
  userId: string;
  organizationId: string;
  organizationSlug: string;
  userRole: string;
  permissions: string[];
  sessionData: any;
  validatedAt: Date;
}

export interface OrganizationAccess {
  id: string;
  slug: string;
  name: string;
  role: string;
  permissions: string[];
}

export interface MultiOrgSyncConnection {
  clientId: string;
  userId: string;
  organizations: OrganizationAccess[];
  sessionData: any;
  validatedAt: Date;
}

export interface OrgSyncValidation {
  isValid: boolean;
  connection?: SyncConnection;
  error?: string;
}

export interface MultiOrgSyncValidation {
  isValid: boolean;
  connection?: MultiOrgSyncConnection;
  error?: string;
}

export interface SyncPermissions {
  'entities:read': Set<string>;    // Set of entity names user can read
  'entities:write': Set<string>;   // Set of entity names user can write  
  'sync:subscribe': boolean;       // Can establish sync connection
  'sync:broadcast': boolean;       // Can trigger broadcasts to others
}

export class OrgAwareSyncManager {
  
  constructor(
    private env: Env,
    private context: MinimalContext
  ) {
    // Database connections are now created per-operation to avoid sharing across request contexts
  }

  /**
   * Get OrgAccessService with fresh database connection for this operation
   * Creates isolated connections to avoid I/O context sharing
   */
  private async getOrgAccessService(): Promise<OrgAccessService> {
    // Create persistent database connection for this DO operation (like Better Auth)
    const kysely = createKyselyForPersistentUse();
    return new OrgAccessService(kysely, this.env);
  }

  /**
   * Extract and validate organization context from WebSocket upgrade request
   */
  async validateSyncConnection(
    request: Request,
    clientId: string,
    organizationSlug?: string,
    organizationId?: string
  ): Promise<OrgSyncValidation> {
    try {
      // 1. Extract session from request (cookie or Authorization header)
      const sessionData = await this.extractSession(request);
      if (!sessionData?.user) {
        return {
          isValid: false,
          error: 'No valid session found - authentication required for sync'
        };
      }

      // 2. Determine organization context
      let targetOrgSlug = organizationSlug;
      
      if (!targetOrgSlug) {
        // Try to get org from query params or user's default org
        const url = new URL(request.url);
        targetOrgSlug = url.searchParams.get('org') || url.searchParams.get('organization');
        
        // Check if organizationId is provided and convert to slug
        if (!targetOrgSlug && organizationId) {
          // Look up organization slug by ID
          const orgAccessService = await this.getOrgAccessService();
          const orgByID = await orgAccessService.getOrganizationById(organizationId);
          if (orgByID) {
            targetOrgSlug = orgByID.slug;
            syncLogger.info('Resolved organization ID to slug', {
              organizationId,
              slug: targetOrgSlug,
              orgName: orgByID.name,
              resolvedOrgId: orgByID.id
            }, MODULE_NAME);
          } else {
            return {
              isValid: false,
              error: `Organization not found for ID: ${organizationId}`
            };
          }
        }
        
        if (!targetOrgSlug) {
          // Get user's first organization as default
          const userOrgs = await this.getOrgAccessService().getUserOrganizations(sessionData.user.id, sessionData.user.role);
          if (userOrgs.length === 0) {
            return {
              isValid: false,
              error: 'User is not a member of any organization'
            };
          }
          targetOrgSlug = userOrgs[0].organization.slug;
        }
      }

      // 3. Validate user access to organization
      syncLogger.info('Checking user access to organization', {
        userId: sessionData.user.id,
        targetOrgSlug,
        providedOrganizationId: organizationId
      }, MODULE_NAME);
      
      const orgAccessService = await this.getOrgAccessService();
      const orgAccess = await orgAccessService.checkUserOrgAccess(
        sessionData.user.id,
        targetOrgSlug
      );
      
      syncLogger.info('Organization access check result', {
        hasAccess: orgAccess.hasAccess,
        returnedOrgId: orgAccess.organization?.id,
        returnedOrgSlug: orgAccess.organization?.slug,
        returnedOrgName: orgAccess.organization?.name,
        userRole: orgAccess.role,
        fromCache: orgAccess.fromCache
      }, MODULE_NAME);

      if (!orgAccess.hasAccess) {
        return {
          isValid: false,
          error: `User does not have access to organization: ${targetOrgSlug}`
        };
      }

      // 4. Build connection context
      const connection: SyncConnection = {
        clientId,
        userId: sessionData.user.id,
        organizationId: orgAccess.organization!.id,
        organizationSlug: targetOrgSlug,
        userRole: orgAccess.role!,
        permissions: orgAccess.permissions || [],
        sessionData,
        validatedAt: new Date()
      };

      syncLogger.info('Sync connection validated', {
        clientId,
        userId: sessionData.user.id,
        organizationId: connection.organizationId,
        organizationSlug: targetOrgSlug,
        userRole: connection.userRole,
        fromCache: orgAccess.fromCache
      }, MODULE_NAME);

      return {
        isValid: true,
        connection
      };

    } catch (error) {
      syncLogger.error('Failed to validate sync connection', {
        clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);

      return {
        isValid: false,
        error: `Connection validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Validate multi-organization sync connection for a user
   * Returns all organizations the user has access to
   */
  async validateMultiOrgSyncConnection(
    request: Request,
    clientId: string
  ): Promise<MultiOrgSyncValidation> {
    try {
      // 1. Extract session from request (cookie or Authorization header)
      const sessionData = await this.extractSession(request);
      if (!sessionData?.user) {
        return {
          isValid: false,
          error: 'No valid session found - authentication required for sync'
        };
      }

      // 2. Get all organizations the user has access to (PostgreSQL direct, no cache)
      syncLogger.info('Getting all user organizations for multi-org sync', {
        userId: sessionData.user.id,
        clientId
      }, MODULE_NAME);

      // Direct PostgreSQL query to avoid Organization Actor cache (prevents I/O context sharing)
      const userOrgs = await withKysely(async (kysely) => {
        return await kysely
          .selectFrom('organizations as o')
          .innerJoin('organization_members as m', 'm.organization_id', 'o.id')
          .select([
            'o.id as org_id',
            'o.name as org_name', 
            'o.slug as org_slug',
            'm.role as member_role'
          ])
          .where('m.user_id', '=', sessionData.user.id)
          .execute();
      });

      if (userOrgs.length === 0) {
        return {
          isValid: false,
          error: 'User is not a member of any organization'
        };
      }

      // 3. Build multi-org connection context
      const organizations: OrganizationAccess[] = userOrgs.map(orgData => ({
        id: orgData.org_id,
        slug: orgData.org_slug,
        name: orgData.org_name,
        role: orgData.member_role,
        permissions: this.getRolePermissions(orgData.member_role)
      }));

      const connection: MultiOrgSyncConnection = {
        clientId,
        userId: sessionData.user.id,
        organizations,
        sessionData,
        validatedAt: new Date()
      };

      syncLogger.info('Multi-org sync connection validated', {
        clientId,
        userId: sessionData.user.id,
        organizationCount: organizations.length,
        organizationIds: organizations.map(org => org.id),
        organizationSlugs: organizations.map(org => org.slug)
      }, MODULE_NAME);

      return {
        isValid: true,
        connection
      };

    } catch (error) {
      syncLogger.error('Failed to validate multi-org sync connection', {
        clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);

      return {
        isValid: false,
        error: `Multi-org connection validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get role-based permissions (moved from private to reuse)
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

  /**
   * Validate table access for sync operations
   */
  async validateTableAccess(
    connection: SyncConnection,
    tableName: string,
    action: 'read' | 'write'
  ): Promise<boolean> {
    try {
      // 1. Check if table belongs to user's organization
      if (!tableName.startsWith(`${connection.organizationId}_`)) {
        syncLogger.warn('Cross-organization table access attempt', {
          userId: connection.userId,
          organizationId: connection.organizationId,
          tableName,
          action
        }, MODULE_NAME);
        return false;
      }

      // 2. Extract entity name from table name
      const entityName = tableName.substring(connection.organizationId.length + 1);

      // 3. Pull-based sync - permissions validated at query time
      // Since sync is now pull-based, we skip the push-based permission validation
      // and allow the client to pull data, with permissions checked during actual queries
      
      syncLogger.debug('Pull-based sync - allowing access, permissions checked at query time', {
        userId: connection.userId,
        entityName,
        action,
        userRole: connection.userRole
      });

      // For pull-based sync, return true - real permission checks happen during data queries
      return true;

    } catch (error) {
      syncLogger.error('Table access validation failed', {
        userId: connection.userId,
        tableName,
        action,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return false;
    }
  }

  /**
   * Filter changes by organization - only return changes for the user's organization
   */
  async filterChangesByOrg(
    changes: TableChange[],
    connection: SyncConnection,
    action: 'read' | 'write' = 'read'
  ): Promise<TableChange[]> {
    try {
      const filteredChanges: TableChange[] = [];

      for (const change of changes) {
        // Extract organization ID from table name
        const orgMatch = change.table.match(/^org_([0-9a-f]{8}_[0-9a-f]{4}_[0-9a-f]{4}_[0-9a-f]{4}_[0-9a-f]{12})_(.+)$/i);
        
        if (orgMatch) {
          const tableOrgId = orgMatch[1].replace(/_/g, '-');
          
          // Only include changes for the user's organization
          if (tableOrgId === connection.organizationId) {
            filteredChanges.push(change);
          }
        } else {
          // Include non-org tables (system tables, etc.)
          filteredChanges.push(change);
        }
      }

      syncLogger.debug('Changes filtered by organization', {
        userId: connection.userId,
        organizationId: connection.organizationId,
        originalCount: changes.length,
        filteredCount: filteredChanges.length,
        action
      }, MODULE_NAME);

      return filteredChanges;

    } catch (error) {
      syncLogger.error('Failed to filter changes by organization', {
        userId: connection.userId,
        organizationId: connection.organizationId,
        changeCount: changes.length,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);

      return []; // Return empty array on error for security
    }
  }

  /**
   * Get authorized clients for broadcasting changes to specific table
   */
  async getAuthorizedClientsForBroadcast(
    tableName: string,
    organizationId: string
  ): Promise<string[]> {
    try {
      if (!this.env.ORGANIZATION_ACTOR) {
        syncLogger.warn('ORGANIZATION_ACTOR binding not available for broadcast filtering', {
          tableName,
          organizationId
        }, MODULE_NAME);
        return [];
      }

      // Extract entity name
      const entityName = tableName.startsWith(`${organizationId}_`) 
        ? tableName.substring(organizationId.length + 1)
        : tableName;

      // Use OrganizationActor to get authorized users
      const doId = this.env.ORGANIZATION_ACTOR.idFromName(organizationId);
      const doStub = this.env.ORGANIZATION_ACTOR.get(doId);

      const response = await doStub.fetch(new Request(`http://localhost/authorized-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityName,
          action: 'read'
        })
      }));

      if (response.ok) {
        const result = await response.json();
        return result.authorizedUsers || [];
      }

      return [];

    } catch (error) {
      syncLogger.error('Failed to get authorized clients for broadcast', {
        tableName,
        organizationId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);

      return [];
    }
  }

  /**
   * Extract session data from WebSocket upgrade request
   */
  private async extractSession(request: Request): Promise<any> {
    try {
      // Initialize Better Auth for session validation
      const auth = initializeAuth(this.env);

      // Get session from request (handles both cookie and Authorization header)
      const session = await auth.api.getSession({
        headers: request.headers
      });

      return session;

    } catch (error) {
      syncLogger.debug('Session extraction failed', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);

      return null;
    }
  }

  /**
   * Basic role-based table access validation (fallback)
   */
  private validateBasicTableAccess(userRole: string, action: 'read' | 'write'): boolean {
    switch (userRole) {
      case 'admin':
        return true; // Admin can read/write everything
      case 'member':
        return true; // Members can read/write (refined by container permissions)
      case 'viewer':
        return action === 'read'; // Viewers can only read
      default:
        return false;
    }
  }

  /**
   * Check if connection is still valid (for long-lived connections)
   */
  isConnectionValid(connection: SyncConnection): boolean {
    // Check if connection is older than 24 hours
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const age = Date.now() - connection.validatedAt.getTime();
    
    return age < maxAge;
  }

  /**
   * Refresh connection validation (for long-lived connections)
   */
  async refreshConnectionValidation(connection: SyncConnection): Promise<SyncConnection | null> {
    try {
      // Re-validate user's organization access
      const orgAccess = await this.getOrgAccessService().checkUserOrgAccess(
        connection.userId,
        connection.organizationSlug
      );

      if (!orgAccess.hasAccess) {
        syncLogger.warn('Connection validation refresh failed - access revoked', {
          userId: connection.userId,
          organizationSlug: connection.organizationSlug
        }, MODULE_NAME);
        return null;
      }

      // Update connection with fresh data
      const refreshedConnection: SyncConnection = {
        ...connection,
        userRole: orgAccess.role!,
        permissions: orgAccess.permissions || [],
        validatedAt: new Date()
      };

      syncLogger.debug('Connection validation refreshed', {
        userId: connection.userId,
        organizationId: connection.organizationId,
        newRole: refreshedConnection.userRole
      }, MODULE_NAME);

      return refreshedConnection;

    } catch (error) {
      syncLogger.error('Failed to refresh connection validation', {
        userId: connection.userId,
        organizationId: connection.organizationId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);

      return null;
    }
  }
}