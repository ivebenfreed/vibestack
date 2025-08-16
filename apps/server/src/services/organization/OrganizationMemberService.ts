import type { Kysely } from 'kysely';
import { dbLogger } from '../../middleware/logger';
import type { 
  OrganizationMember, 
  OrganizationRole,
  UpdateMemberInput,
  OrganizationServiceResponse,
  MemberListFilters,
  PermissionCheckResult,
  ROLE_LEVELS
} from '../../types/organization';

const ROLE_LEVELS: Record<OrganizationRole, number> = {
  owner: 100,
  admin: 80,
  manager: 60,
  member: 40,
  viewer: 20
};

/**
 * Organization Member Management Service
 * Handles member CRUD operations and role management
 */
export class OrganizationMemberService {
  private db: Kysely<any>;

  constructor(db: Kysely<any>) {
    this.db = db;
  }

  /**
   * Add member to organization
   */
  async addMember(
    organizationId: string,
    userId: string,
    role: OrganizationRole,
    addedBy: string
  ): Promise<OrganizationServiceResponse<OrganizationMember>> {
    try {
      // 1. Check if user is already a member
      const existingMember = await this.getMembership(userId, organizationId);
      if (existingMember.success) {
        return {
          success: false,
          error: 'User is already a member of this organization'
        };
      }

      // 2. Check organization limits
      const memberCount = await this.db
        .selectFrom('organization_members')
        .select((eb) => eb.fn.count('id').as('count'))
        .where('organization_id', '=', organizationId)
        .executeTakeFirst();

      // Skip organization limits check for now since max_users column doesn't exist
      // const orgLimits = await this.db
      //   .selectFrom('organizations')
      //   .select(['max_users'])
      //   .where('id', '=', organizationId)
      //   .executeTakeFirst();

      // if (orgLimits && Number(memberCount?.count || 0) >= orgLimits.max_users) {
      //   return {
      //     success: false,
      //     error: 'Organization has reached its member limit'
      //   };
      // }

      // 3. Add member
      const member = await this.addMemberDirect(organizationId, userId, role, addedBy);
      if (!member.success) {
        return member;
      }

      // 4. Send welcome email (TODO: implement)
      // await this.sendWelcomeEmail(userId, organizationId);

      // 5. Log audit event
      await this.logAuditEvent({
        organization_id: organizationId,
        action: 'member_added',
        actor_id: addedBy,
        target_type: 'user',
        target_id: userId,
        details: { role }
      });

      return member;

    } catch (error) {
      dbLogger.error('Error adding member to organization', error);
      return {
        success: false,
        error: 'Failed to add member to organization'
      };
    }
  }

  /**
   * Add member directly (internal method)
   */
  async addMemberDirect(
    organizationId: string,
    userId: string,
    role: OrganizationRole,
    addedBy: string
  ): Promise<OrganizationServiceResponse<OrganizationMember>> {
    try {
      const member = await this.db
        .insertInto('organization_members')
        .values({
          organization_id: organizationId,
          user_id: userId,
          role: role
        })
        .returning([
          'id', 'organization_id', 'user_id', 'role', 'created_at', 'updated_at'
        ])
        .executeTakeFirstOrThrow();

      return {
        success: true,
        data: {
          ...member,
          // Add missing fields with defaults
          status: 'active',
          invited_by: addedBy,
          joined_at: member.created_at,
          title: null,
          department: null,
          notes: null,
          invited_at: null
        } as OrganizationMember
      };

    } catch (error) {
      dbLogger.error('Error adding member directly', error);
      return {
        success: false,
        error: 'Failed to add member'
      };
    }
  }

  /**
   * Update member role or details
   */
  async updateMember(
    organizationId: string,
    userId: string,
    updates: UpdateMemberInput,
    updatedBy: string
  ): Promise<OrganizationServiceResponse<OrganizationMember>> {
    try {
      // 1. Check if member exists
      const existingMember = await this.getMembership(userId, organizationId);
      if (!existingMember.success) {
        return {
          success: false,
          error: 'Member not found in organization'
        };
      }

      // 2. Prevent owner role conflicts
      if (updates.role === 'owner') {
        const existingOwner = await this.db
          .selectFrom('organization_members')
          .where('organization_id', '=', organizationId)
          .where('role', '=', 'owner')
          .where('user_id', '!=', userId)
          .where('status', '=', 'active')
          .executeTakeFirst();

        if (existingOwner) {
          return {
            success: false,
            error: 'Organization already has an owner. Transfer ownership first.'
          };
        }
      }

      // 3. Update member
      const updateValues: any = {};
      if (updates.role) updateValues.role = updates.role;
      if (updates.status) updateValues.status = updates.status;
      if (updates.title !== undefined) updateValues.title = updates.title;
      if (updates.department !== undefined) updateValues.department = updates.department;
      if (updates.notes !== undefined) updateValues.notes = updates.notes;

      const updatedMember = await this.db
        .updateTable('organization_members')
        .set(updateValues)
        .where('organization_id', '=', organizationId)
        .where('user_id', '=', userId)
        .returning([
          'id', 'organization_id', 'user_id', 'role', 'status',
          'invited_by', 'invited_at', 'joined_at', 'title', 'department',
          'notes', 'created_at', 'updated_at'
        ])
        .executeTakeFirst();

      if (!updatedMember) {
        return {
          success: false,
          error: 'Failed to update member'
        };
      }

      // 4. Log audit event
      await this.logAuditEvent({
        organization_id: organizationId,
        action: updates.role ? 'member_role_changed' : 'member_updated',
        actor_id: updatedBy,
        target_type: 'user',
        target_id: userId,
        details: updates
      });

      return {
        success: true,
        data: updatedMember as OrganizationMember
      };

    } catch (error) {
      dbLogger.error('Error updating member', error);
      return {
        success: false,
        error: 'Failed to update member'
      };
    }
  }

  /**
   * Remove member from organization
   */
  async removeMember(
    organizationId: string,
    userId: string,
    removedBy: string
  ): Promise<OrganizationServiceResponse<void>> {
    try {
      // 1. Check if member exists
      const member = await this.getMembership(userId, organizationId);
      if (!member.success) {
        return {
          success: false,
          error: 'Member not found in organization'
        };
      }

      // 2. Prevent removing last owner
      if (member.data?.role === 'owner') {
        const ownerCount = await this.db
          .selectFrom('organization_members')
          .select((eb) => eb.fn.count('id').as('count'))
          .where('organization_id', '=', organizationId)
          .where('role', '=', 'owner')
          .where('status', '=', 'active')
          .executeTakeFirst();

        if (Number(ownerCount?.count || 0) <= 1) {
          return {
            success: false,
            error: 'Cannot remove the last owner. Transfer ownership first.'
          };
        }
      }

      // 3. Remove member
      const result = await this.db
        .deleteFrom('organization_members')
        .where('organization_id', '=', organizationId)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (result.numDeletedRows === 0) {
        return {
          success: false,
          error: 'Member not found'
        };
      }

      // 4. Handle data transfer (TODO: implement)
      // await this.transferMemberData(userId, organizationId, removedBy);

      // 5. Log audit event
      await this.logAuditEvent({
        organization_id: organizationId,
        action: 'member_removed',
        actor_id: removedBy,
        target_type: 'user',
        target_id: userId,
        details: { previousRole: member.data?.role }
      });

      return {
        success: true
      };

    } catch (error) {
      dbLogger.error('Error removing member', error);
      return {
        success: false,
        error: 'Failed to remove member'
      };
    }
  }

  /**
   * Get user's membership in organization
   */
  async getMembership(
    userId: string,
    organizationId: string
  ): Promise<OrganizationServiceResponse<OrganizationMember>> {
    try {
      const membership = await this.db
        .selectFrom('organization_members')
        .leftJoin('organizations', 'organizations.id', 'organization_members.organization_id')
        .leftJoin('user', 'user.id', 'organization_members.user_id')
        .where('organization_members.user_id', '=', userId)
        .where('organization_members.organization_id', '=', organizationId)
        .select([
          'organization_members.id',
          'organization_members.organization_id',
          'organization_members.user_id',
          'organization_members.role',
          'organization_members.status',
          'organization_members.invited_by',
          'organization_members.invited_at',
          'organization_members.joined_at',
          'organization_members.title',
          'organization_members.department',
          'organization_members.notes',
          'organization_members.created_at',
          'organization_members.updated_at',
          'organizations.name as org_name',
          'user.name as user_name',
          'user.email as user_email'
        ])
        .executeTakeFirst();

      if (!membership) {
        return {
          success: false,
          error: 'User is not a member of this organization'
        };
      }

      const member: OrganizationMember = {
        id: membership.id,
        organization_id: membership.organization_id,
        user_id: membership.user_id,
        role: membership.role as OrganizationRole,
        status: membership.status as any,
        invited_by: membership.invited_by,
        invited_at: membership.invited_at,
        joined_at: membership.joined_at,
        title: membership.title,
        department: membership.department,
        notes: membership.notes,
        created_at: membership.created_at,
        updated_at: membership.updated_at,
        organization: membership.org_name ? {
          id: organizationId,
          name: membership.org_name
        } as any : undefined,
        user: membership.user_name ? {
          id: userId,
          name: membership.user_name,
          email: membership.user_email
        } : undefined
      };

      return {
        success: true,
        data: member
      };

    } catch (error) {
      dbLogger.error('Error getting membership', error);
      return {
        success: false,
        error: 'Failed to get membership'
      };
    }
  }

  /**
   * Get user's role in organization
   */
  async getUserRole(
    organizationId: string,
    userId: string
  ): Promise<OrganizationRole | null> {
    try {
      const member = await this.db
        .selectFrom('organization_members')
        .select(['role'])
        .where('organization_id', '=', organizationId)
        .where('user_id', '=', userId)
        .where('status', '=', 'active')
        .executeTakeFirst();

      return member?.role as OrganizationRole || null;

    } catch (error) {
      dbLogger.error('Error getting user role', error);
      return null;
    }
  }

  /**
   * Check if user has required permission level
   */
  async hasPermission(
    organizationId: string,
    userId: string,
    requiredRole: OrganizationRole
  ): Promise<PermissionCheckResult> {
    try {
      const userRole = await this.getUserRole(organizationId, userId);
      
      if (!userRole) {
        return {
          allowed: false,
          reason: 'User is not a member of this organization',
          requiredRole,
          currentRole: undefined
        };
      }

      const allowed = ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole];

      return {
        allowed,
        reason: allowed ? undefined : `Role '${userRole}' does not have sufficient permissions`,
        requiredRole,
        currentRole: userRole
      };

    } catch (error) {
      dbLogger.error('Error checking permission', error);
      return {
        allowed: false,
        reason: 'Failed to check permissions',
        requiredRole
      };
    }
  }

  /**
   * List organization members
   */
  async listMembers(
    filters: MemberListFilters
  ): Promise<OrganizationServiceResponse<OrganizationMember[]>> {
    try {
      let query = this.db
        .selectFrom('organization_members')
        .leftJoin('user', 'user.id', 'organization_members.user_id')
        .where('organization_members.organization_id', '=', filters.organization_id);

      // Apply filters
      if (filters.role) {
        query = query.where('organization_members.role', '=', filters.role);
      }

      if (filters.status) {
        query = query.where('organization_members.status', '=', filters.status);
      }

      if (filters.search) {
        query = query.where((eb) => 
          eb.or([
            eb('user.name', 'ilike', `%${filters.search}%`),
            eb('user.email', 'ilike', `%${filters.search}%`)
          ])
        );
      }

      // Apply pagination
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      if (filters.offset) {
        query = query.offset(filters.offset);
      }

      const members = await query
        .select([
          'organization_members.id',
          'organization_members.organization_id',
          'organization_members.user_id',
          'organization_members.role',
          'organization_members.status',
          'organization_members.invited_by',
          'organization_members.invited_at',
          'organization_members.joined_at',
          'organization_members.title',
          'organization_members.department',
          'organization_members.notes',
          'organization_members.created_at',
          'organization_members.updated_at',
          'user.name as user_name',
          'user.email as user_email',
          'user.image as user_image'
        ])
        .orderBy('organization_members.created_at', 'desc')
        .execute();

      const formattedMembers: OrganizationMember[] = members.map(member => ({
        id: member.id,
        organization_id: member.organization_id,
        user_id: member.user_id,
        role: member.role as OrganizationRole,
        status: member.status as any,
        invited_by: member.invited_by,
        invited_at: member.invited_at,
        joined_at: member.joined_at,
        title: member.title,
        department: member.department,
        notes: member.notes,
        created_at: member.created_at,
        updated_at: member.updated_at,
        user: {
          id: member.user_id,
          name: member.user_name || '',
          email: member.user_email || '',
          image: member.user_image
        }
      }));

      return {
        success: true,
        data: formattedMembers
      };

    } catch (error) {
      dbLogger.error('Error listing members', error);
      return {
        success: false,
        error: 'Failed to list members'
      };
    }
  }

  /**
   * Private helper methods
   */
  private async logAuditEvent(event: {
    organization_id: string;
    action: string;
    actor_id?: string;
    target_type?: string;
    target_id?: string;
    details?: Record<string, any>;
  }): Promise<void> {
    try {
      // Skip audit logging since organization_audit_logs table doesn't exist
      // await this.db
      //   .insertInto('organization_audit_logs')
      //   .values({
      //     organization_id: event.organization_id,
      //     action: event.action,
      //     actor_id: event.actor_id,
      //     target_type: event.target_type,
      //     target_id: event.target_id,
      //     details: JSON.stringify(event.details || {})
      //   })
      //   .execute();
      
      dbLogger.info('Audit event (not logged to database)', event);
    } catch (error) {
      dbLogger.error('Failed to log audit event', error);
    }
  }
}