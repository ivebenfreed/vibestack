export interface DatabaseProvisioningResult {
  organizationId: string;
  connectionString: string;
  databaseName: string;
  success: boolean;
  error?: string;
  metadata?: {
    provider: 'neon' | 'local';
    branchId?: string;
    schemaName?: string;
  };
}

export interface DatabaseProvisioningService {
  /**
   * Create a new database/schema for an organization
   */
  createOrganizationDatabase(organizationId: string): Promise<DatabaseProvisioningResult>;

  /**
   * Delete an organization's database/schema
   */
  deleteOrganizationDatabase(organizationId: string): Promise<boolean>;

  /**
   * Get connection string for an organization's database
   */
  getOrganizationConnectionString(organizationId: string): Promise<string>;

  /**
   * Test connection to an organization's database
   */
  testOrganizationConnection(organizationId: string): Promise<boolean>;

  /**
   * Deploy schema to organization's database
   */
  deploySchema(organizationId: string): Promise<boolean>;

  /**
   * Get provisioning service type (for environment detection)
   */
  getProviderType(): 'neon' | 'local';
}

export interface EnvironmentConfig {
  multiTenantMode: 'local' | 'production';
  neonApiKey?: string;
  localDbSchemaPrefix?: string;
  baseConnectionString: string;
}

/**
 * Factory function to create appropriate database provisioning service based on environment
 */
export function createDatabaseProvisioningService(config: EnvironmentConfig): DatabaseProvisioningService {
  if (config.multiTenantMode === 'production') {
    if (!config.neonApiKey) {
      throw new Error('NEON_API_KEY is required for production mode');
    }
    return new NeonDatabaseProvisioner(config);
  } else {
    return new LocalDatabaseProvisioner(config);
  }
}

/**
 * Local development database provisioner using PostgreSQL schemas
 */
export class LocalDatabaseProvisioner implements DatabaseProvisioningService {
  constructor(private config: EnvironmentConfig) {}

  getProviderType(): 'local' {
    return 'local';
  }

  async createOrganizationDatabase(organizationId: string): Promise<DatabaseProvisioningResult> {
    const schemaName = this.getSchemaName(organizationId);
    
    try {
      // Create schema-based database isolation for local development
      const Pool = await import('pg').then(m => m.Pool);
      const pool = new Pool({ connectionString: this.config.baseConnectionString });
      
      // Create organization schema
      await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
      
      // Create connection string with schema search path
      const connectionString = `${this.config.baseConnectionString}?options=-c%20search_path=${schemaName}`;
      
      await pool.end();
      
      return {
        organizationId,
        connectionString,
        databaseName: schemaName,
        success: true,
        metadata: {
          provider: 'local',
          schemaName
        }
      };
    } catch (error) {
      return {
        organizationId,
        connectionString: '',
        databaseName: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          provider: 'local',
          schemaName
        }
      };
    }
  }

  async deleteOrganizationDatabase(organizationId: string): Promise<boolean> {
    const schemaName = this.getSchemaName(organizationId);
    
    try {
      const Pool = await import('pg').then(m => m.Pool);
      const pool = new Pool({ connectionString: this.config.baseConnectionString });
      
      // Drop schema and all its contents
      await pool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
      
      await pool.end();
      return true;
    } catch (error) {
      console.error('Failed to delete organization schema:', error);
      return false;
    }
  }

  async getOrganizationConnectionString(organizationId: string): Promise<string> {
    const schemaName = this.getSchemaName(organizationId);
    return `${this.config.baseConnectionString}?options=-c%20search_path=${schemaName}`;
  }

  async testOrganizationConnection(organizationId: string): Promise<boolean> {
    try {
      const connectionString = await this.getOrganizationConnectionString(organizationId);
      const Pool = await import('pg').then(m => m.Pool);
      const pool = new Pool({ connectionString });
      
      await pool.query('SELECT 1');
      await pool.end();
      
      return true;
    } catch (error) {
      console.error('Organization connection test failed:', error);
      return false;
    }
  }

  async deploySchema(organizationId: string): Promise<boolean> {
    try {
      // For local development, we'll run all migrations on the organization schema
      const connectionString = await this.getOrganizationConnectionString(organizationId);
      
      // Note: In a real implementation, this would run MikroORM migrations
      // against the organization's schema connection string
      console.log(`Schema deployment for organization ${organizationId} on schema ${this.getSchemaName(organizationId)}`);
      
      return true;
    } catch (error) {
      console.error('Schema deployment failed:', error);
      return false;
    }
  }

  private getSchemaName(organizationId: string): string {
    const prefix = this.config.localDbSchemaPrefix || 'org_';
    return `${prefix}${organizationId.replace(/-/g, '_')}`;
  }
}

/**
 * Production database provisioner using Neon API
 */
export class NeonDatabaseProvisioner implements DatabaseProvisioningService {
  constructor(private config: EnvironmentConfig) {}

  getProviderType(): 'neon' {
    return 'neon';
  }

  async createOrganizationDatabase(organizationId: string): Promise<DatabaseProvisioningResult> {
    try {
      // Create Neon database branch for organization isolation
      const branchName = `org-${organizationId}`;
      
      // Note: This would use actual Neon API calls in production
      // const response = await this.createNeonBranch(branchName);
      
      // Mock implementation for now
      const branchId = `branch-${organizationId}`;
      const connectionString = `postgresql://user:pass@ep-${branchId}.region.neon.tech/neondb`;
      
      return {
        organizationId,
        connectionString,
        databaseName: branchName,
        success: true,
        metadata: {
          provider: 'neon',
          branchId
        }
      };
    } catch (error) {
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

  async deleteOrganizationDatabase(organizationId: string): Promise<boolean> {
    try {
      // Delete Neon database branch
      // const branchId = await this.getBranchId(organizationId);
      // await this.deleteNeonBranch(branchId);
      
      console.log(`Neon branch deletion for organization ${organizationId}`);
      return true;
    } catch (error) {
      console.error('Failed to delete Neon branch:', error);
      return false;
    }
  }

  async getOrganizationConnectionString(organizationId: string): Promise<string> {
    // In production, this would query Neon API for current connection string
    const branchId = `branch-${organizationId}`;
    return `postgresql://user:pass@ep-${branchId}.region.neon.tech/neondb`;
  }

  async testOrganizationConnection(organizationId: string): Promise<boolean> {
    try {
      const connectionString = await this.getOrganizationConnectionString(organizationId);
      const Pool = await import('pg').then(m => m.Pool);
      const pool = new Pool({ connectionString });
      
      await pool.query('SELECT 1');
      await pool.end();
      
      return true;
    } catch (error) {
      console.error('Neon connection test failed:', error);
      return false;
    }
  }

  async deploySchema(organizationId: string): Promise<boolean> {
    try {
      // Deploy schema to Neon database branch
      const connectionString = await this.getOrganizationConnectionString(organizationId);
      
      console.log(`Neon schema deployment for organization ${organizationId}`);
      
      return true;
    } catch (error) {
      console.error('Neon schema deployment failed:', error);
      return false;
    }
  }

  // Private methods for Neon API integration would go here
  // private async createNeonBranch(branchName: string) { ... }
  // private async deleteNeonBranch(branchId: string) { ... }
  // private async getBranchId(organizationId: string) { ... }
}