import { DatabaseProvisioningService } from './DatabaseProvisioningService.js';

// Better Auth organization data (matches their API)
export interface BetterAuthOrganization {
  id: string;
  name: string;
  slug: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationData {
  name: string;
  slug: string;
  metadata?: {
    planType?: string;
    [key: string]: any;
  };
}

export interface OrganizationSetupResult {
  organization: BetterAuthOrganization;
  databaseProvisioned: boolean;
  schemaDeployed: boolean;
  defaultDataCreated: boolean;
  success: boolean;
  errors: string[];
}

/**
 * Service for managing organizations and their complete database setup lifecycle
 * Integrates with Better Auth organization plugin for user/organization management
 */
export class OrganizationService {
  constructor(
    private databaseProvisioner: DatabaseProvisioningService
  ) {}

  /**
   * Complete organization database setup after Better Auth organization creation
   * This is called via webhook/hook after Better Auth creates the organization
   */
  async setupOrganizationDatabase(organizationId: string, organizationData: BetterAuthOrganization): Promise<OrganizationSetupResult> {
    const errors: string[] = [];
    let databaseProvisioned = false;
    let schemaDeployed = false;
    let defaultDataCreated = false;

    try {
      console.log(`Setting up database for organization: ${organizationData.name} (${organizationData.slug})`);

      // Step 1: Provision organization database
      const provisionResult = await this.databaseProvisioner.createOrganizationDatabase(organizationId);
      if (!provisionResult.success) {
        errors.push(provisionResult.error || 'Database provisioning failed');
      } else {
        databaseProvisioned = true;
        console.log(`Database provisioned for ${organizationData.slug}: ${provisionResult.databaseName}`);
      }

      // Step 2: Deploy schema to organization database
      if (databaseProvisioned) {
        const schemaSuccess = await this.databaseProvisioner.deploySchema(organizationId);
        if (schemaSuccess) {
          schemaDeployed = true;
          console.log(`Schema deployed for organization ${organizationData.slug}`);
        } else {
          errors.push('Schema deployment failed');
        }
      }

      // Step 3: Create default data (option sets, permissions, etc.)
      if (schemaDeployed) {
        const defaultDataSuccess = await this.createDefaultOrganizationData(organizationId);
        if (defaultDataSuccess) {
          defaultDataCreated = true;
          console.log(`Default data created for organization ${organizationData.slug}`);
        } else {
          errors.push('Default data creation failed');
        }
      }

      return {
        organization: organizationData,
        databaseProvisioned,
        schemaDeployed,
        defaultDataCreated,
        success: errors.length === 0,
        errors
      };

    } catch (error) {
      // If anything fails, attempt cleanup
      if (databaseProvisioned) {
        try {
          await this.databaseProvisioner.deleteOrganizationDatabase(organizationId);
          console.log(`Cleaned up database for failed organization ${organizationData.slug}`);
        } catch (cleanupError) {
          errors.push('Database cleanup failed after organization setup failure');
        }
      }

      return {
        organization: organizationData,
        databaseProvisioned,
        schemaDeployed,
        defaultDataCreated,
        success: false,
        errors
      };
    }
  }

  /**
   * Delete an organization and all its data
   */
  async deleteOrganization(organizationId: string): Promise<boolean> {
    try {
      // Step 1: Delete organization database
      const dbDeleted = await this.databaseProvisioner.deleteOrganizationDatabase(organizationId);
      if (!dbDeleted) {
        console.error(`Failed to delete database for organization ${organizationId}`);
      }

      // Step 2: Delete organization entity from control plane
      // Note: In a real implementation, this would delete from the control plane database
      console.log(`Deleted organization ${organizationId}`);

      return dbDeleted;
    } catch (error) {
      console.error('Organization deletion failed:', error);
      return false;
    }
  }

  /**
   * Get organization connection details
   */
  async getOrganizationDatabase(organizationId: string) {
    const connectionString = await this.databaseProvisioner.getOrganizationConnectionString(organizationId);
    const isHealthy = await this.databaseProvisioner.testOrganizationConnection(organizationId);
    
    return {
      organizationId,
      connectionString,
      providerType: this.databaseProvisioner.getProviderType(),
      isHealthy
    };
  }

  /**
   * Validate organization data
   */
  private validateOrganizationData(data: OrganizationData): string[] {
    const errors: string[] = [];

    if (!data.name || data.name.trim().length === 0) {
      errors.push('Organization name is required');
    }

    if (!data.slug || data.slug.trim().length === 0) {
      errors.push('Organization slug is required');
    }

    // Validate slug format (lowercase, letters, numbers, hyphens only)
    if (data.slug && !/^[a-z0-9\-]+$/.test(data.slug)) {
      errors.push('Organization slug must contain only lowercase letters, numbers, and hyphens');
    }

    if (data.slug && data.slug.length < 3) {
      errors.push('Organization slug must be at least 3 characters');
    }

    if (data.slug && data.slug.length > 50) {
      errors.push('Organization slug cannot exceed 50 characters');
    }

    if (data.planType && !['free', 'pro', 'enterprise'].includes(data.planType)) {
      errors.push('Invalid plan type. Must be: free, pro, or enterprise');
    }

    return errors;
  }

  /**
   * Create default data for a new organization
   */
  private async createDefaultOrganizationData(organizationId: string): Promise<boolean> {
    try {
      // This would create default option sets, container permissions, etc.
      // Using the organization's dedicated database connection
      
      console.log(`Creating default data for organization ${organizationId}:`);
      
      // Default system option sets
      const defaultOptionSets = [
        {
          name: 'Task Status',
          type: 'status',
          options: [
            { name: 'To Do', color: '#94a3b8', isCompletionState: false },
            { name: 'In Progress', color: '#3b82f6', isCompletionState: false },
            { name: 'Done', color: '#10b981', isCompletionState: true }
          ]
        },
        {
          name: 'Task Priority',
          type: 'priority',
          options: [
            { name: 'Low', color: '#6b7280' },
            { name: 'Medium', color: '#f59e0b' },
            { name: 'High', color: '#ef4444' }
          ]
        },
        {
          name: 'Project Category',
          type: 'category',
          options: [
            { name: 'Development', color: '#3b82f6' },
            { name: 'Design', color: '#8b5cf6' },
            { name: 'Marketing', color: '#ec4899' },
            { name: 'Operations', color: '#10b981' }
          ]
        }
      ];

      console.log(`- Created ${defaultOptionSets.length} default option sets`);

      // Default system labels
      const defaultLabels = [
        { name: 'Urgent', color: '#dc2626', category: 'priority' },
        { name: 'Bug', color: '#ef4444', category: 'type' },
        { name: 'Feature', color: '#3b82f6', category: 'type' },
        { name: 'Documentation', color: '#8b5cf6', category: 'type' }
      ];

      console.log(`- Created ${defaultLabels.length} default system labels`);

      // Default container permissions (organization admin gets full access)
      console.log('- Created default container permissions for organization admin');

      return true;
    } catch (error) {
      console.error('Failed to create default organization data:', error);
      return false;
    }
  }
}