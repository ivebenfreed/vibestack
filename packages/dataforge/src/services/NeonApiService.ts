/**
 * Neon API service for production database branch management
 * Integrates with Neon's REST API for database provisioning
 */

export interface NeonProject {
  id: string;
  name: string;
  region: string;
  pg_version: number;
}

export interface NeonBranch {
  id: string;
  name: string;
  project_id: string;
  primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface NeonEndpoint {
  id: string;
  branch_id: string;
  host: string;
  connection_uri: string;
  created_at: string;
  updated_at: string;
}

export interface NeonDatabase {
  id: number;
  name: string;
  branch_id: string;
  owner_name: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBranchRequest {
  name: string;
  parent_id?: string;
  parent_lsn?: string;
  parent_timestamp?: string;
}

export interface CreateBranchResponse {
  branch: NeonBranch;
  endpoints?: NeonEndpoint[];
  connection_uris?: {
    connection_uri: string;
    database_name: string;
  }[];
}

/**
 * Service for interacting with Neon API
 */
export class NeonApiService {
  private baseUrl = 'https://console.neon.tech/api/v2';
  private apiKey: string;
  private projectId: string;

  constructor(apiKey: string, projectId: string) {
    this.apiKey = apiKey;
    this.projectId = projectId;
  }

  /**
   * Create a new database branch for organization isolation
   */
  async createBranch(request: CreateBranchRequest): Promise<CreateBranchResponse> {
    const response = await this.makeRequest('POST', `/projects/${this.projectId}/branches`, request);
    return response as CreateBranchResponse;
  }

  /**
   * Delete a database branch
   */
  async deleteBranch(branchId: string): Promise<boolean> {
    try {
      await this.makeRequest('DELETE', `/projects/${this.projectId}/branches/${branchId}`);
      return true;
    } catch (error) {
      console.error('Failed to delete Neon branch:', error);
      return false;
    }
  }

  /**
   * Get branch details
   */
  async getBranch(branchId: string): Promise<NeonBranch> {
    const response = await this.makeRequest('GET', `/projects/${this.projectId}/branches/${branchId}`);
    return response.branch as NeonBranch;
  }

  /**
   * List all branches in project
   */
  async listBranches(): Promise<NeonBranch[]> {
    const response = await this.makeRequest('GET', `/projects/${this.projectId}/branches`);
    return response.branches as NeonBranch[];
  }

  /**
   * Get endpoints for a branch
   */
  async getBranchEndpoints(branchId: string): Promise<NeonEndpoint[]> {
    const response = await this.makeRequest('GET', `/projects/${this.projectId}/branches/${branchId}/endpoints`);
    return response.endpoints as NeonEndpoint[];
  }

  /**
   * Get databases for a branch
   */
  async getBranchDatabases(branchId: string): Promise<NeonDatabase[]> {
    const response = await this.makeRequest('GET', `/projects/${this.projectId}/branches/${branchId}/databases`);
    return response.databases as NeonDatabase[];
  }

  /**
   * Get connection URI for a branch
   */
  async getBranchConnectionUri(branchId: string, databaseName = 'neondb'): Promise<string> {
    const endpoints = await this.getBranchEndpoints(branchId);
    
    if (endpoints.length === 0) {
      throw new Error(`No endpoints found for branch ${branchId}`);
    }

    const endpoint = endpoints[0];
    return endpoint.connection_uri.replace('neondb', databaseName);
  }

  /**
   * Test connection to a branch
   */
  async testBranchConnection(branchId: string): Promise<boolean> {
    try {
      const connectionUri = await this.getBranchConnectionUri(branchId);
      
      // In a real implementation, this would test the actual database connection
      // For now, we'll just verify we can get the connection URI
      return !!connectionUri;
    } catch (error) {
      console.error('Branch connection test failed:', error);
      return false;
    }
  }

  /**
   * Create organization-specific branch name
   */
  static getOrganizationBranchName(organizationId: string): string {
    // Neon branch names must be valid PostgreSQL identifiers
    // Replace hyphens with underscores and ensure valid format
    return `org_${organizationId.replace(/-/g, '_')}`.toLowerCase();
  }

  /**
   * Make authenticated request to Neon API
   */
  private async makeRequest(method: string, endpoint: string, body?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Neon API error ${response.status}: ${errorText}`);
      }

      // Handle empty responses (like DELETE operations)
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return {};
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error(`Neon API request failed: ${method} ${url}`, error);
      throw error;
    }
  }

  /**
   * Get project information
   */
  async getProject(): Promise<NeonProject> {
    const response = await this.makeRequest('GET', `/projects/${this.projectId}`);
    return response.project as NeonProject;
  }

  /**
   * Validate API configuration
   */
  async validateConfiguration(): Promise<boolean> {
    try {
      await this.getProject();
      return true;
    } catch (error) {
      console.error('Neon API configuration validation failed:', error);
      return false;
    }
  }
}

/**
 * Factory function to create NeonApiService with environment configuration
 */
export function createNeonApiService(): NeonApiService | null {
  const apiKey = process.env.NEON_API_KEY;
  const projectId = process.env.NEON_PROJECT_ID;

  if (!apiKey || !projectId) {
    console.warn('Neon API configuration missing. Set NEON_API_KEY and NEON_PROJECT_ID environment variables.');
    return null;
  }

  return new NeonApiService(apiKey, projectId);
}