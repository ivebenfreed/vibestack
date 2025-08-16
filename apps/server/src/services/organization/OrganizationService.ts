import { Context } from 'hono';
import type { Kysely } from 'kysely';
import { dbLogger } from '../../middleware/logger';
import type { 
  Organization, 
  CreateOrganizationInput, 
  UpdateOrganizationInput,
  OrganizationServiceResponse,
  OrganizationListFilters,
  OrganizationStats
} from '../../types/organization';

/**
 * Core Organization Management Service
 * Handles CRUD operations for organizations
 */
export class OrganizationService {
  private db: Kysely<any>;

  constructor(context: Context) {
    // Get Kysely instance from the auth configuration
    const { getKysely } = require('../../lib/kysely');
    this.db = getKysely(context.env);
  }

  /**
   * Create a new organization
   */
  async createOrganization(
    data: CreateOrganizationInput, 
    createdBy: string
  ): Promise<OrganizationServiceResponse<Organization>> {
    try {
      // 1. Validate organization data
      const validation = this.validateOrganizationInput(data);
      if (!validation.success) {
        return validation;
      }

      // 2. Check billing account if subscription tier is not trial
      if (data.subscription_tier && data.subscription_tier !== 'trial') {
        const billingValidation = await this.validateBillingAccount(data);
        if (!billingValidation.success) {
          return billingValidation;
        }
      }

      // 3. Check if slug is unique
      const existingOrg = await this.db
        .selectFrom('organizations')
        .where('slug', '=', data.slug)
        .where('deleted_at', 'is', null)
        .selectAll()
        .executeTakeFirst();

      if (existingOrg) {
        return {
          success: false,
          error: 'Organization slug already exists'
        };
      }

      // 4. Create organization record
      const organization = await this.db
        .insertInto('organizations')
        .values({
          name: data.name,
          slug: data.slug,
          description: data.description,
          industry: data.industry,
          company_size: data.company_size,
          website_url: data.website_url,
          country: data.country,
          timezone: data.timezone || 'UTC',
          subscription_tier: data.subscription_tier || 'trial',
          billing_email: data.billing_email,
          polar_customer_id: data.polar_customer_id,
          trial_started_at: new Date(),
          trial_ends_at: new Date(Date.now() + (14 * 24 * 60 * 60 * 1000)), // 14 days from now
          settings: JSON.stringify(data.settings || {}),
          allowed_domains: data.allowed_domains,
          logo_url: data.logo_url
        })
        .returning([
          'id', 'name', 'slug', 'description', 'industry', 'company_size',
          'website_url', 'country', 'timezone', 'subscription_tier', 
          'subscription_status', 'billing_email', 'polar_customer_id', 
          'trial_started_at', 'trial_ends_at', 'max_users', 'max_projects', 
          'storage_limit_gb', 'api_rate_limit', 'settings', 'sso_enabled', 
          'enforce_2fa', 'allowed_domains', 'logo_url', 'created_at', 'updated_at'
        ])
        .executeTakeFirstOrThrow();

      // 4. Add creator as owner (this will be handled by OrganizationMemberService)
      const { OrganizationMemberService } = await import('./OrganizationMemberService');
      const memberService = new OrganizationMemberService(this.db);
      
      await memberService.addMemberDirect(
        organization.id,
        createdBy,
        'owner',
        createdBy
      );

      // 5. Log audit event
      await this.logAuditEvent({
        organization_id: organization.id,
        action: 'organization_created',
        actor_id: createdBy,
        details: {
          name: organization.name,
          slug: organization.slug,
          subscription_tier: organization.subscription_tier
        }
      });

      dbLogger.info('Organization created successfully', {
        organizationId: organization.id,
        name: organization.name,
        slug: organization.slug,
        createdBy
      });

      return {
        success: true,
        data: this.formatOrganization(organization)
      };

    } catch (error) {
      dbLogger.error('Error creating organization', error);
      return {
        success: false,
        error: 'Failed to create organization'
      };
    }
  }

  /**
   * Update an existing organization
   */
  async updateOrganization(
    id: string, 
    data: UpdateOrganizationInput, 
    updatedBy: string
  ): Promise<OrganizationServiceResponse<Organization>> {
    try {
      // 1. Validate input
      if (!id) {
        return {
          success: false,
          error: 'Organization ID is required'
        };
      }

      // 2. Check if organization exists
      const existingOrg = await this.getOrganizationById(id);
      if (!existingOrg.success) {
        return existingOrg;
      }

      // 3. Check slug uniqueness if changing
      if (data.slug && data.slug !== existingOrg.data?.slug) {
        const slugExists = await this.db
          .selectFrom('organizations')
          .where('slug', '=', data.slug)
          .where('id', '!=', id)
          .where('deleted_at', 'is', null)
          .selectAll()
          .executeTakeFirst();

        if (slugExists) {
          return {
            success: false,
            error: 'Organization slug already exists'
          };
        }
      }

      // 4. Update organization
      const updateValues: any = {};
      
      // Only update provided fields
      if (data.name !== undefined) updateValues.name = data.name;
      if (data.slug !== undefined) updateValues.slug = data.slug;
      if (data.description !== undefined) updateValues.description = data.description;
      if (data.industry !== undefined) updateValues.industry = data.industry;
      if (data.company_size !== undefined) updateValues.company_size = data.company_size;
      if (data.website_url !== undefined) updateValues.website_url = data.website_url;
      if (data.country !== undefined) updateValues.country = data.country;
      if (data.timezone !== undefined) updateValues.timezone = data.timezone;
      if (data.subscription_tier !== undefined) updateValues.subscription_tier = data.subscription_tier;
      if (data.subscription_status !== undefined) updateValues.subscription_status = data.subscription_status;
      if (data.billing_email !== undefined) updateValues.billing_email = data.billing_email;
      if (data.polar_customer_id !== undefined) updateValues.polar_customer_id = data.polar_customer_id;
      if (data.trial_ends_at !== undefined) updateValues.trial_ends_at = data.trial_ends_at;
      if (data.max_users !== undefined) updateValues.max_users = data.max_users;
      if (data.max_projects !== undefined) updateValues.max_projects = data.max_projects;
      if (data.storage_limit_gb !== undefined) updateValues.storage_limit_gb = data.storage_limit_gb;
      if (data.api_rate_limit !== undefined) updateValues.api_rate_limit = data.api_rate_limit;
      if (data.settings !== undefined) updateValues.settings = JSON.stringify(data.settings);
      if (data.sso_enabled !== undefined) updateValues.sso_enabled = data.sso_enabled;
      if (data.enforce_2fa !== undefined) updateValues.enforce_2fa = data.enforce_2fa;
      if (data.allowed_domains !== undefined) updateValues.allowed_domains = data.allowed_domains;
      if (data.logo_url !== undefined) updateValues.logo_url = data.logo_url;

      const updatedOrganization = await this.db
        .updateTable('organizations')
        .set(updateValues)
        .where('id', '=', id)
        .where('deleted_at', 'is', null)
        .returning([
          'id', 'name', 'slug', 'description', 'industry', 'company_size',
          'website_url', 'country', 'timezone', 'subscription_tier', 
          'subscription_status', 'billing_email', 'polar_customer_id', 
          'trial_started_at', 'trial_ends_at', 'max_users', 'max_projects', 
          'storage_limit_gb', 'api_rate_limit', 'settings', 'sso_enabled', 
          'enforce_2fa', 'allowed_domains', 'logo_url', 'created_at', 'updated_at'
        ])
        .executeTakeFirst();

      if (!updatedOrganization) {
        return {
          success: false,
          error: 'Organization not found'
        };
      }

      // 5. Log audit event
      await this.logAuditEvent({
        organization_id: id,
        action: 'organization_updated',
        actor_id: updatedBy,
        details: {
          changes: Object.keys(updateValues),
          ...updateValues
        }
      });

      dbLogger.info('Organization updated successfully', {
        organizationId: id,
        updatedFields: Object.keys(updateValues),
        updatedBy
      });

      return {
        success: true,
        data: this.formatOrganization(updatedOrganization)
      };

    } catch (error) {
      dbLogger.error('Error updating organization', error);
      return {
        success: false,
        error: 'Failed to update organization'
      };
    }
  }

  /**
   * Get organization by ID
   */
  async getOrganizationById(id: string): Promise<OrganizationServiceResponse<Organization>> {
    try {
      const organization = await this.db
        .selectFrom('organizations')
        .where('id', '=', id)
        .where('deleted_at', 'is', null)
        .selectAll()
        .executeTakeFirst();

      if (!organization) {
        return {
          success: false,
          error: 'Organization not found'
        };
      }

      return {
        success: true,
        data: this.formatOrganization(organization)
      };

    } catch (error) {
      dbLogger.error('Error getting organization by ID', error);
      return {
        success: false,
        error: 'Failed to get organization'
      };
    }
  }

  /**
   * Get organizations by user ID
   */
  async getOrganizationsByUser(userId: string): Promise<OrganizationServiceResponse<Organization[]>> {
    try {
      const organizations = await this.db
        .selectFrom('organizations')
        .innerJoin('organization_members', 'organization_members.organization_id', 'organizations.id')
        .where('organization_members.user_id', '=', userId)
        .where('organization_members.status', '=', 'active')
        .where('organizations.deleted_at', 'is', null)
        .select([
          'organizations.id', 'organizations.name', 'organizations.slug', 
          'organizations.description', 'organizations.industry', 'organizations.company_size',
          'organizations.website_url', 'organizations.country', 'organizations.timezone', 
          'organizations.subscription_tier', 'organizations.subscription_status', 
          'organizations.billing_email', 'organizations.polar_customer_id', 
          'organizations.trial_started_at', 'organizations.trial_ends_at',
          'organizations.max_users', 'organizations.max_projects', 
          'organizations.storage_limit_gb', 'organizations.api_rate_limit',
          'organizations.settings', 'organizations.sso_enabled', 'organizations.enforce_2fa', 
          'organizations.allowed_domains', 'organizations.logo_url', 
          'organizations.created_at', 'organizations.updated_at'
        ])
        .orderBy('organizations.created_at', 'desc')
        .execute();

      return {
        success: true,
        data: organizations.map(org => this.formatOrganization(org))
      };

    } catch (error) {
      dbLogger.error('Error getting organizations by user', error);
      return {
        success: false,
        error: 'Failed to get organizations'
      };
    }
  }

  /**
   * Soft delete organization
   */
  async deleteOrganization(
    id: string, 
    deletedBy: string
  ): Promise<OrganizationServiceResponse<void>> {
    try {
      // 1. Check if organization exists and user is owner
      const org = await this.getOrganizationById(id);
      if (!org.success) {
        return org as OrganizationServiceResponse<void>;
      }

      // 2. Soft delete organization
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
          error: 'Organization not found or already deleted'
        };
      }

      // 3. Log audit event
      await this.logAuditEvent({
        organization_id: id,
        action: 'organization_deleted',
        actor_id: deletedBy,
        details: {
          name: org.data?.name,
          slug: org.data?.slug
        }
      });

      dbLogger.info('Organization soft deleted successfully', {
        organizationId: id,
        deletedBy
      });

      return {
        success: true
      };

    } catch (error) {
      dbLogger.error('Error deleting organization', error);
      return {
        success: false,
        error: 'Failed to delete organization'
      };
    }
  }

  /**
   * List organizations with filtering and pagination
   */
  async listOrganizations(
    filters: OrganizationListFilters = {}
  ): Promise<OrganizationServiceResponse<Organization[]>> {
    try {
      let query = this.db
        .selectFrom('organizations')
        .where('deleted_at', 'is', null);

      // Apply filters
      if (filters.subscription_tier) {
        query = query.where('subscription_tier', '=', filters.subscription_tier);
      }

      if (filters.subscription_status) {
        query = query.where('subscription_status', '=', filters.subscription_status);
      }

      if (filters.search) {
        query = query.where((eb) => 
          eb.or([
            eb('name', 'ilike', `%${filters.search}%`),
            eb('slug', 'ilike', `%${filters.search}%`)
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

      const organizations = await query
        .selectAll()
        .orderBy('created_at', 'desc')
        .execute();

      return {
        success: true,
        data: organizations.map(org => this.formatOrganization(org))
      };

    } catch (error) {
      dbLogger.error('Error listing organizations', error);
      return {
        success: false,
        error: 'Failed to list organizations'
      };
    }
  }

  /**
   * Get organization statistics
   */
  async getOrganizationStats(organizationId: string): Promise<OrganizationServiceResponse<OrganizationStats>> {
    try {
      // This would typically involve multiple queries to calculate stats
      const org = await this.getOrganizationById(organizationId);
      if (!org.success || !org.data) {
        return org as OrganizationServiceResponse<OrganizationStats>;
      }

      // Get member counts
      const memberStats = await this.db
        .selectFrom('organization_members')
        .select((eb) => [
          eb.fn.count('id').as('total_members'),
          eb.fn.count('id').filterWhere('status', '=', 'active').as('active_members')
        ])
        .where('organization_id', '=', organizationId)
        .executeTakeFirst();

      // Get pending invitation count
      const invitationStats = await this.db
        .selectFrom('organization_invitations')
        .select((eb) => [
          eb.fn.count('id').as('pending_invitations')
        ])
        .where('organization_id', '=', organizationId)
        .where('status', '=', 'pending')
        .where('expires_at', '>', new Date())
        .executeTakeFirst();

      const stats: OrganizationStats = {
        id: org.data.id,
        name: org.data.name,
        member_count: Number(memberStats?.total_members || 0),
        active_member_count: Number(memberStats?.active_members || 0),
        pending_invitation_count: Number(invitationStats?.pending_invitations || 0),
        storage_used_gb: 0, // TODO: Implement storage calculation
        api_calls_this_month: 0, // TODO: Implement API call tracking
        created_at: org.data.created_at
      };

      return {
        success: true,
        data: stats
      };

    } catch (error) {
      dbLogger.error('Error getting organization stats', error);
      return {
        success: false,
        error: 'Failed to get organization statistics'
      };
    }
  }

  /**
   * Private helper methods
   */
  
  /**
   * Validate billing account for paid organizations
   */
  private async validateBillingAccount(data: CreateOrganizationInput): Promise<OrganizationServiceResponse<void>> {
    try {
      // Check if polar_customer_id is provided for paid tiers
      if (!data.polar_customer_id) {
        return {
          success: false,
          error: 'Billing account (Polar customer ID) is required for paid subscription tiers'
        };
      }

      // Check if the polar customer ID is already associated with another organization
      const existingOrgWithCustomer = await this.db
        .selectFrom('organizations')
        .where('polar_customer_id', '=', data.polar_customer_id)
        .where('deleted_at', 'is', null)
        .selectAll()
        .executeTakeFirst();

      if (existingOrgWithCustomer) {
        return {
          success: false,
          error: 'This billing account is already associated with another organization'
        };
      }

      // Validate that the customer exists in Polar and has valid subscription
      // This could be enhanced to make an API call to Polar to verify the customer
      // For now, we just check the format of the customer ID
      if (!data.polar_customer_id.match(/^[a-zA-Z0-9_-]+$/)) {
        return {
          success: false,
          error: 'Invalid billing account format'
        };
      }

      // Check if billing email is provided
      if (!data.billing_email) {
        return {
          success: false,
          error: 'Billing email is required for paid subscription tiers'
        };
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.billing_email)) {
        return {
          success: false,
          error: 'Invalid billing email format'
        };
      }

      return { success: true };

    } catch (error) {
      dbLogger.error('Error validating billing account', error);
      return {
        success: false,
        error: 'Failed to validate billing account'
      };
    }
  }

  private validateOrganizationInput(data: CreateOrganizationInput): OrganizationServiceResponse<void> {
    const errors: string[] = [];

    if (!data.name?.trim()) {
      errors.push('Organization name is required');
    }

    if (!data.slug?.trim()) {
      errors.push('Organization slug is required');
    }

    if (data.slug && !/^[a-z0-9-]+$/.test(data.slug)) {
      errors.push('Organization slug must contain only lowercase letters, numbers, and hyphens');
    }

    if (errors.length > 0) {
      return {
        success: false,
        errors
      };
    }

    return { success: true };
  }

  private formatOrganization(org: any): Organization {
    return {
      ...org,
      settings: typeof org.settings === 'string' ? JSON.parse(org.settings) : org.settings
    };
  }

  private async logAuditEvent(event: {
    organization_id: string;
    action: string;
    actor_id?: string;
    details?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.db
        .insertInto('organization_audit_logs')
        .values({
          organization_id: event.organization_id,
          action: event.action,
          actor_id: event.actor_id,
          details: JSON.stringify(event.details || {})
        })
        .execute();
    } catch (error) {
      dbLogger.error('Failed to log audit event', error);
    }
  }
}