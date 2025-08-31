/**
 * RLS-Enhanced Organization Service
 * Organization service with Row Level Security integration
 */

import { Kysely } from 'kysely';
import { Database } from '../../types/database';
import { dbLogger } from '../../middleware/logger';
import { 
  Organization, 
  OrganizationMember, 
  OrganizationInvitation,
  CreateOrganizationInput,
  UpdateOrganizationInput,
  OrganizationServiceResponse,
  OrganizationStatsResponse,
  OrganizationRole
} from '../../types/organization';

export class RLSOrganizationService {
  constructor(private db: Kysely<Database>) {}

  /**
   * Create a new organization (automatically creates owner membership via RLS)
   */
  async createOrganization(
    data: CreateOrganizationInput,
    createdBy: string
  ): Promise<OrganizationServiceResponse<Organization>> {
    try {
      const organizationId = this.generateUUID();
      
      dbLogger.info('Creating organization with RLS security', {
        organizationId,
        name: data.name,
        slug: data.slug,
        createdBy
      }, 'rls-organization');

      // Create organization (RLS context will be set by middleware)
      const organization = await this.db
        .insertInto('organizations')
        .values({
          id: organizationId,
          name: data.name,
          slug: data.slug,
          description: data.description,
          industry: data.industry,
          company_size: data.company_size,
          website_url: data.website_url,
          country: data.country,
          timezone: data.timezone || 'UTC',
          subscription_tier: data.subscription_tier || 'free',
          subscription_status: 'active',
          billing_email: data.billing_email,
          max_users: this.getMaxUsersForTier(data.subscription_tier || 'free'),
          max_projects: this.getMaxProjectsForTier(data.subscription_tier || 'free'),
          storage_limit_gb: this.getStorageLimitForTier(data.subscription_tier || 'free'),
          settings: data.settings || {},
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning([
          'id', 'name', 'slug', 'description', 'industry', 'company_size',
          'website_url', 'country', 'timezone', 'subscription_tier',
          'subscription_status', 'created_at', 'updated_at'
        ])
        .executeTakeFirstOrThrow();

      // Create owner membership (bypasses RLS for initial setup)
      await this.db
        .insertInto('organization_members')
        .values({
          id: this.generateUUID(),
          organization_id: organizationId,
          user_id: createdBy,
          role: 'owner',
          status: 'active',
          joined_at: new Date(),
          invited_by: createdBy
        })
        .execute();

      // Log organization creation in audit trail
      await this.db
        .insertInto('organization_audit_logs')
        .values({
          id: this.generateUUID(),
          organization_id: organizationId,
          user_id: createdBy,
          action: 'organization_created',
          resource_type: 'organization',
          resource_id: organizationId,
          details: `Organization "${data.name}" created`,
          metadata: {
            organization_name: data.name,
            subscription_tier: data.subscription_tier || 'free',
            industry: data.industry
          },
          created_at: new Date()
        })
        .execute();

      dbLogger.info('Organization created successfully with RLS', {
        organizationId,
        name: data.name,
        createdBy
      }, 'rls-organization');

      return {
        success: true,
        data: organization as Organization
      };

    } catch (error) {
      dbLogger.error('Failed to create organization with RLS', {
        error: error instanceof Error ? error.message : 'Unknown error',
        data,
        createdBy
      }, 'rls-organization');

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Organization creation failed'
      };
    }
  }

  /**
   * Get organization by ID (automatically filtered by RLS)
   */
  async getOrganization(id: string): Promise<OrganizationServiceResponse<Organization>> {
    try {
      // RLS automatically filters to current organization context
      const organization = await this.db
        .selectFrom('organizations')
        .selectAll()
        .where('id', '=', id)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();

      if (!organization) {
        return {
          success: false,
          error: 'Organization not found or access denied'
        };
      }

      return {
        success: true,
        data: organization as Organization
      };

    } catch (error) {
      dbLogger.error('Failed to get organization', {
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId: id
      }, 'rls-organization');

      return {
        success: false,
        error: 'Failed to retrieve organization'
      };
    }
  }

  /**
   * List user's organizations (uses RLS membership policy)
   */
  async listUserOrganizations(userId: string): Promise<OrganizationServiceResponse<Organization[]>> {
    try {
      // RLS policy allows seeing organizations where user is a member
      const organizations = await this.db
        .selectFrom('organizations')
        .selectAll()
        .where('deleted_at', 'is', null)
        .orderBy('name', 'asc')
        .execute();

      return {
        success: true,
        data: organizations as Organization[]
      };

    } catch (error) {
      dbLogger.error('Failed to list user organizations', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      }, 'rls-organization');

      return {
        success: false,
        error: 'Failed to list organizations'
      };
    }
  }

  /**
   * Update organization (RLS ensures only current org can be updated)
   */
  async updateOrganization(
    id: string,
    data: UpdateOrganizationInput,
    updatedBy: string
  ): Promise<OrganizationServiceResponse<Organization>> {
    try {
      // RLS automatically ensures we can only update the current organization
      const updatedOrg = await this.db
        .updateTable('organizations')
        .set({
          ...data,
          updated_at: new Date()
        })
        .where('id', '=', id)
        .where('deleted_at', 'is', null)
        .returning([
          'id', 'name', 'slug', 'description', 'industry', 'company_size',
          'website_url', 'country', 'timezone', 'subscription_tier',
          'subscription_status', 'updated_at'
        ])
        .executeTakeFirst();

      if (!updatedOrg) {
        return {
          success: false,
          error: 'Organization not found or update not permitted'
        };
      }

      // Log update in audit trail
      await this.db
        .insertInto('organization_audit_logs')
        .values({
          id: this.generateUUID(),
          organization_id: id,
          user_id: updatedBy,
          action: 'organization_updated',
          resource_type: 'organization',
          resource_id: id,
          details: 'Organization details updated',
          metadata: data,
          created_at: new Date()
        })
        .execute();

      return {
        success: true,
        data: updatedOrg as Organization
      };

    } catch (error) {
      dbLogger.error('Failed to update organization', {
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId: id,
        updatedBy
      }, 'rls-organization');

      return {
        success: false,
        error: 'Organization update failed'
      };
    }
  }

  /**
   * Get organization statistics (RLS-filtered)
   */
  async getOrganizationStats(organizationId: string): Promise<OrganizationServiceResponse<OrganizationStatsResponse>> {
    try {
      // Use the RLS-enabled view for statistics
      const stats = await this.db
        .selectFrom('organization_statistics')
        .selectAll()
        .where('id', '=', organizationId)
        .executeTakeFirst();

      if (!stats) {
        return {
          success: false,
          error: 'Organization statistics not found'
        };
      }

      const response: OrganizationStatsResponse = {
        id: stats.id,
        name: stats.name,
        active_member_count: Number(stats.active_member_count),
        pending_invitation_count: Number(stats.pending_invitation_count),
        audit_log_count: Number(stats.audit_log_count),
        last_activity: stats.last_activity,
        subscription_tier: stats.subscription_tier,
        created_at: stats.created_at
      };

      return {
        success: true,
        data: response
      };

    } catch (error) {
      dbLogger.error('Failed to get organization statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId
      }, 'rls-organization');

      return {
        success: false,
        error: 'Failed to retrieve organization statistics'
      };
    }
  }

  /**
   * Delete organization (soft delete with RLS protection)
   */
  async deleteOrganization(
    id: string,
    deletedBy: string
  ): Promise<OrganizationServiceResponse<boolean>> {
    try {
      // RLS ensures only current organization can be deleted
      const result = await this.db
        .updateTable('organizations')
        .set({
          deleted_at: new Date(),
          updated_at: new Date()
        })
        .where('id', '=', id)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();

      if (result.numUpdatedRows === 0) {
        return {
          success: false,
          error: 'Organization not found or deletion not permitted'
        };
      }

      // Log deletion in audit trail
      await this.db
        .insertInto('organization_audit_logs')
        .values({
          id: this.generateUUID(),
          organization_id: id,
          user_id: deletedBy,
          action: 'organization_deleted',
          resource_type: 'organization',
          resource_id: id,
          details: 'Organization deleted (soft delete)',
          metadata: { deleted_at: new Date() },
          created_at: new Date()
        })
        .execute();

      dbLogger.info('Organization deleted successfully', {
        organizationId: id,
        deletedBy
      }, 'rls-organization');

      return {
        success: true,
        data: true
      };

    } catch (error) {
      dbLogger.error('Failed to delete organization', {
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId: id,
        deletedBy
      }, 'rls-organization');

      return {
        success: false,
        error: 'Organization deletion failed'
      };
    }
  }

  /**
   * Validate user access to organization (uses RLS)
   */
  async validateOrganizationAccess(
    organizationId: string,
    userId: string
  ): Promise<OrganizationServiceResponse<{ role: OrganizationRole; status: string }>> {
    try {
      // RLS automatically filters to accessible memberships
      const membership = await this.db
        .selectFrom('organization_members')
        .select(['role', 'status'])
        .where('organization_id', '=', organizationId)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!membership || membership.status !== 'active') {
        return {
          success: false,
          error: 'Organization access denied'
        };
      }

      return {
        success: true,
        data: {
          role: membership.role as OrganizationRole,
          status: membership.status
        }
      };

    } catch (error) {
      dbLogger.error('Failed to validate organization access', {
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId,
        userId
      }, 'rls-organization');

      return {
        success: false,
        error: 'Access validation failed'
      };
    }
  }

  // Helper methods
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private getMaxUsersForTier(tier: string): number {
    const limits = { free: 5, pro: 50, enterprise: 500 };
    return limits[tier as keyof typeof limits] || 5;
  }

  private getMaxProjectsForTier(tier: string): number {
    const limits = { free: 3, pro: 50, enterprise: 500 };
    return limits[tier as keyof typeof limits] || 3;
  }

  private getStorageLimitForTier(tier: string): number {
    const limits = { free: 1, pro: 100, enterprise: 1000 };
    return limits[tier as keyof typeof limits] || 1;
  }
}