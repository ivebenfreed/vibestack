import { DatabaseProvisioningService, DatabaseProvisioningResult } from './DatabaseProvisioningService.js';
import { NeonApiService, createNeonApiService } from './NeonApiService.js';

/**
 * Production database provisioner using Neon API for branch-per-organization isolation
 */
export class NeonDatabaseProvisioner implements DatabaseProvisioningService {
  private neonApi: NeonApiService;

  constructor(neonApi?: NeonApiService) {
    this.neonApi = neonApi || createNeonApiService();
    if (!this.neonApi) {
      throw new Error('Neon API configuration required for NeonDatabaseProvisioner');
    }
  }

  getProviderType(): 'neon' | 'local' {
    return 'neon';
  }

  /**
   * Create a dedicated Neon branch for organization isolation
   */
  async createOrganizationDatabase(organizationId: string): Promise<DatabaseProvisioningResult> {
    try {
      const branchName = NeonApiService.getOrganizationBranchName(organizationId);
      
      console.log(`Creating Neon branch for organization ${organizationId}: ${branchName}`);

      // Create branch from main branch
      const createResult = await this.neonApi.createBranch({
        name: branchName,
        // Create from main branch (inherits schema but isolated data)
      });

      const branch = createResult.branch;
      const connectionUri = await this.neonApi.getBranchConnectionUri(branch.id);

      console.log(`Neon branch created: ${branch.id} (${branchName})`);

      return {
        organizationId,
        connectionString: connectionUri,
        databaseName: branchName,
        success: true,
        metadata: {
          provider: 'neon',
          branchId: branch.id,
          branchName: branchName,
          projectId: this.neonApi['projectId'], // Access private field for metadata
          createdAt: branch.created_at
        }
      };

    } catch (error) {
      console.error('Failed to create Neon branch for organization:', error);
      
      return {
        organizationId,
        connectionString: '',
        databaseName: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          provider: 'neon'
        }
      };
    }
  }

  /**
   * Delete organization's Neon branch
   */
  async deleteOrganizationDatabase(organizationId: string): Promise<boolean> {
    try {
      const branchName = NeonApiService.getOrganizationBranchName(organizationId);
      
      // Find branch by name
      const branches = await this.neonApi.listBranches();
      const targetBranch = branches.find(b => b.name === branchName);
      
      if (!targetBranch) {
        console.warn(`Branch not found for organization ${organizationId}: ${branchName}`);
        return true; // Consider already deleted as success
      }

      // Cannot delete primary branch
      if (targetBranch.primary) {
        console.error(`Cannot delete primary branch: ${branchName}`);
        return false;
      }

      console.log(`Deleting Neon branch for organization ${organizationId}: ${targetBranch.id}`);
      
      const deleted = await this.neonApi.deleteBranch(targetBranch.id);
      
      if (deleted) {
        console.log(`Neon branch deleted: ${targetBranch.id} (${branchName})`);
      }
      
      return deleted;

    } catch (error) {
      console.error('Failed to delete Neon branch for organization:', error);
      return false;
    }
  }

  /**
   * Get connection string for organization's Neon branch
   */
  async getOrganizationConnectionString(organizationId: string): Promise<string> {
    try {
      const branchName = NeonApiService.getOrganizationBranchName(organizationId);
      
      // Find branch by name
      const branches = await this.neonApi.listBranches();
      const targetBranch = branches.find(b => b.name === branchName);
      
      if (!targetBranch) {
        return '';
      }

      return await this.neonApi.getBranchConnectionUri(targetBranch.id);

    } catch (error) {
      console.error('Failed to get connection string for organization:', error);
      return '';
    }
  }

  /**
   * Test connection to organization's Neon branch
   */
  async testOrganizationConnection(organizationId: string): Promise<boolean> {
    try {
      const branchName = NeonApiService.getOrganizationBranchName(organizationId);
      
      // Find branch by name
      const branches = await this.neonApi.listBranches();
      const targetBranch = branches.find(b => b.name === branchName);
      
      if (!targetBranch) {
        return false;
      }

      return await this.neonApi.testBranchConnection(targetBranch.id);

    } catch (error) {
      console.error('Failed to test connection for organization:', error);
      return false;
    }
  }

  /**
   * Deploy schema to organization's Neon branch
   * Note: In Neon's branch model, new branches inherit the parent's schema
   * This method can be used for additional schema migrations specific to the organization
   */
  async deploySchema(organizationId: string): Promise<boolean> {
    try {
      const connectionString = await this.getOrganizationConnectionString(organizationId);
      
      if (!connectionString) {
        console.error(`No connection string available for organization ${organizationId}`);
        return false;
      }

      // In Neon's model, branches inherit schema from parent
      // This is where you would run organization-specific migrations
      // For now, we'll just verify the connection works
      
      const connectionTest = await this.testOrganizationConnection(organizationId);
      
      if (connectionTest) {
        console.log(`Schema deployment verified for organization ${organizationId}`);
        return true;
      } else {
        console.error(`Schema deployment failed - connection test failed for organization ${organizationId}`);
        return false;
      }

    } catch (error) {
      console.error('Failed to deploy schema for organization:', error);
      return false;
    }
  }

  /**
   * Get detailed information about organization's Neon branch
   */
  async getOrganizationBranchInfo(organizationId: string) {
    try {
      const branchName = NeonApiService.getOrganizationBranchName(organizationId);
      
      const branches = await this.neonApi.listBranches();
      const targetBranch = branches.find(b => b.name === branchName);
      
      if (!targetBranch) {
        return null;
      }

      const endpoints = await this.neonApi.getBranchEndpoints(targetBranch.id);
      const databases = await this.neonApi.getBranchDatabases(targetBranch.id);

      return {
        branch: targetBranch,
        endpoints,
        databases,
        connectionString: await this.getOrganizationConnectionString(organizationId)
      };

    } catch (error) {
      console.error('Failed to get branch info for organization:', error);
      return null;
    }
  }

  /**
   * Validate Neon API configuration
   */
  async validateConfiguration(): Promise<boolean> {
    try {
      return await this.neonApi.validateConfiguration();
    } catch (error) {
      console.error('Neon configuration validation failed:', error);
      return false;
    }
  }

  /**
   * List all organization branches
   */
  async listOrganizationBranches(): Promise<Array<{ organizationId: string; branchId: string; branchName: string }>> {
    try {
      const branches = await this.neonApi.listBranches();
      
      return branches
        .filter(branch => branch.name.startsWith('org_'))
        .map(branch => ({
          organizationId: this.extractOrganizationIdFromBranchName(branch.name),
          branchId: branch.id,
          branchName: branch.name
        }));

    } catch (error) {
      console.error('Failed to list organization branches:', error);
      return [];
    }
  }

  /**
   * Extract organization ID from Neon branch name
   */
  private extractOrganizationIdFromBranchName(branchName: string): string {
    // Convert org_uuid_with_underscores back to org-uuid-with-hyphens
    if (branchName.startsWith('org_')) {
      const withoutPrefix = branchName.substring(4);
      // Convert underscores back to hyphens for UUIDs
      return withoutPrefix.replace(/_/g, '-');
    }
    return branchName;
  }
}

/**
 * Factory function to create NeonDatabaseProvisioner with environment configuration
 */
export function createNeonDatabaseProvisioner(): NeonDatabaseProvisioner | null {
  try {
    const neonApi = createNeonApiService();
    if (!neonApi) {
      return null;
    }
    return new NeonDatabaseProvisioner(neonApi);
  } catch (error) {
    console.error('Failed to create NeonDatabaseProvisioner:', error);
    return null;
  }
}