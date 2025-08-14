/**
 * Access Control Service
 * 
 * Simple service for testing permission checks in comprehensive foundation test
 */

import type { Kysely } from 'kysely';

export interface PermissionCheckParams {
  userId: string;
  organizationId: string;
  resource: string;
  action: string;
  containerType?: string;
  containerId?: string;
}

export class AccessControlService {
  constructor(private kysely: Kysely<any>) {}

  async checkPermission(params: PermissionCheckParams): Promise<boolean> {
    const { userId, organizationId, resource, action, containerType, containerId } = params;

    // Simple permission logic for testing
    // Admin users can do everything
    const user = await this.kysely
      .selectFrom('user')
      .select(['role', 'is_super_admin'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!user) return false;

    // Super admin can do anything
    if (user.is_super_admin) return true;

    // Admin role can do most things
    if (user.role === 'admin') return true;

    // Member role has limited permissions
    if (user.role === 'member') {
      // Members can read most things
      if (action === 'read') return true;
      
      // Members can create tasks and comments
      if (action === 'create' && (resource === 'task' || resource === 'comment')) return true;
      
      return false;
    }

    // Viewer role can only read
    if (user.role === 'viewer') {
      return action === 'read';
    }

    return false;
  }
}