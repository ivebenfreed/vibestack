/**
 * Organization-Aware Sync Manager
 * 
 * Handles organization context extraction, validation, and permission checking
 * for sync operations. Integrates with Better Auth and OrgOpsDO for fast
 * organization-scoped sync filtering.
 */

import type { Env } from '../types/env';
import type { MinimalContext } from '../types/hono';
import { initializeAuth } from '../lib/auth';
import { OrgAccessService } from '../services/org-access-service';
import { getDBClient } from '../lib/db';
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

export interface OrgSyncValidation {
  isValid: boolean;
  connection?: SyncConnection;
  error?: string;
}

export interface SyncPermissions {
  'entities:read': Set<string>;    // Set of entity names user can read
  'entities:write': Set<string>;   // Set of entity names user can write  
  'sync:subscribe': boolean;       // Can establish sync connection
  'sync:broadcast': boolean;       // Can trigger broadcasts to others
}

export class OrgAwareSyncManager {
  private orgAccessService: OrgAccessService;
  
  constructor(
    private env: Env,
    private context: MinimalContext
  ) {
    const kysely = getDBClient(env);
    this.orgAccessService = new OrgAccessService(kysely, env);
  }

  /**
   * Extract and validate organization context from WebSocket upgrade request
   */
  async validateSyncConnection(
    request: Request,
    clientId: string,
    organizationSlug?: string
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
        
        if (!targetOrgSlug) {
          // Get user's first organization as default
          const userOrgs = await this.orgAccessService.getUserOrganizations(sessionData.user.id);
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
      const orgAccess = await this.orgAccessService.checkUserOrgAccess(
        sessionData.user.id,
        targetOrgSlug
      );

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

      // 3. Use OrgOpsDO for fast permission validation
      if (this.env.ORG_OPS) {
        const doId = this.env.ORG_OPS.idFromName(connection.organizationId);
        const doStub = this.env.ORG_OPS.get(doId);

        const response = await doStub.fetch(new Request(`http://localhost/validate-sync-access`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: connection.userId,
            entityName,
            action,
            userRole: connection.userRole
          })
        }));

        if (response.ok) {
          const result = await response.json();
          return result.hasAccess;
        }
      }

      // 4. Fallback to basic role-based access
      return this.validateBasicTableAccess(connection.userRole, action);

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
   * Filter changes by organization and permissions
   */
  async filterChangesByOrg(
    changes: TableChange[],
    connection: SyncConnection,
    action: 'read' | 'write' = 'read'
  ): Promise<TableChange[]> {
    try {
      const filteredChanges: TableChange[] = [];

      for (const change of changes) {
        // Validate each change against user's organization and permissions
        const hasAccess = await this.validateTableAccess(connection, change.table, action);
        
        if (hasAccess) {
          filteredChanges.push(change);
        } else {
          syncLogger.debug('Change filtered due to insufficient permissions', {
            userId: connection.userId,
            organizationId: connection.organizationId,
            table: change.table,
            action,
            changeId: change.id
          }, MODULE_NAME);
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
      if (!this.env.ORG_OPS) {
        syncLogger.warn('ORG_OPS binding not available for broadcast filtering', {
          tableName,
          organizationId
        }, MODULE_NAME);
        return [];
      }

      // Extract entity name
      const entityName = tableName.startsWith(`${organizationId}_`) 
        ? tableName.substring(organizationId.length + 1)
        : tableName;

      // Use OrgOpsDO to get authorized users
      const doId = this.env.ORG_OPS.idFromName(organizationId);
      const doStub = this.env.ORG_OPS.get(doId);

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
      const orgAccess = await this.orgAccessService.checkUserOrgAccess(
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