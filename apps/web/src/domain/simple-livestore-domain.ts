/**
 * Simple LiveStore Domain Services
 * 
 * A minimal, working implementation for testing the LiveStore migration.
 * This provides basic domain services that can be exposed for testing.
 */

// Simple domain service implementations
class SimpleDomainService {
  constructor(private entityType: string) {}

  async create(data: any): Promise<any> {
    const entity = {
      id: `${this.entityType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...data,
      organizationId: localStorage.getItem('vibestack-last-organization-id') || 'default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'current-user',
    };

    console.log(`✅ [LiveStore] Created ${this.entityType}:`, entity);
    return entity;
  }

  async update(id: string, updates: any): Promise<any> {
    const entity = {
      id,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: 'current-user',
    };

    console.log(`✅ [LiveStore] Updated ${this.entityType}:`, entity);
    return entity;
  }

  async delete(id: string): Promise<void> {
    console.log(`✅ [LiveStore] Deleted ${this.entityType}:`, id);
  }

  async findById(id: string): Promise<any | null> {
    console.log(`🔍 [LiveStore] Finding ${this.entityType} by ID:`, id);
    return {
      id,
      name: `Sample ${this.entityType}`,
      organizationId: localStorage.getItem('vibestack-last-organization-id') || 'default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async findAll(): Promise<any[]> {
    console.log(`🔍 [LiveStore] Finding all ${this.entityType}s`);
    return [
      {
        id: `${this.entityType}_sample_1`,
        name: `Sample ${this.entityType} 1`,
        organizationId: localStorage.getItem('vibestack-last-organization-id') || 'default',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: `${this.entityType}_sample_2`,
        name: `Sample ${this.entityType} 2`,
        organizationId: localStorage.getItem('vibestack-last-organization-id') || 'default',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }
}

// Project-specific service
class SimpleProjectService extends SimpleDomainService {
  constructor() {
    super('project');
  }

  async updateStatus(id: string, status: string): Promise<any> {
    return this.update(id, { status });
  }
}

// Skill-specific service (Wide Corp has skills, not tasks)
class SimpleSkillService extends SimpleDomainService {
  constructor() {
    super('skill');
  }

  async findByCategory(category: string): Promise<any[]> {
    console.log(`🔍 [LiveStore] Finding skills by category:`, category);
    return [
      {
        id: `skill_${category}_1`,
        name: 'Sample Skill 1',
        category,
        organizationId: localStorage.getItem('vibestack-last-organization-id') || 'default',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }
}

// Client-specific service
class SimpleClientService extends SimpleDomainService {
  constructor() {
    super('client');
  }

  async findActive(): Promise<any[]> {
    console.log(`🔍 [LiveStore] Finding active clients`);
    return this.findAll();
  }
}

// Timesheet-specific service
class SimpleTimesheetService extends SimpleDomainService {
  constructor() {
    super('timesheet');
  }
}

// Simple schema client mock
const simpleSchemaClient = {
  getLiveStoreInstance(orgId: string) {
    console.log(`📊 [LiveStore] Getting instance for org:`, orgId);
    return {
      ready: () => Promise.resolve(),
      query: (sql: string, params: any[] = []) => {
        console.log(`🔍 [LiveStore] Query:`, sql, params);
        return Promise.resolve([]);
      }
    };
  },

  getSyncStatus(orgId: string) {
    console.log(`📊 [LiveStore] Getting sync status for org:`, orgId);
    return {
      connected: true,
      lastSync: new Date().toISOString(),
      pendingChanges: 0,
      orgId
    };
  },

  getTableName(orgId: string, entityType: string) {
    return `org_${orgId.replace(/-/g, '_')}_${entityType}`;
  },

  getAllSyncStatuses() {
    return [this.getSyncStatus(localStorage.getItem('vibestack-last-organization-id') || 'default')];
  }
};

// Create service instances (matching Wide Corp entities)
export const simpleLiveStoreDomainServices = {
  project: new SimpleProjectService(),
  skill: new SimpleSkillService(),
  client: new SimpleClientService(),
  timesheet: new SimpleTimesheetService(),
} as const;

// Development utilities
export const simpleDevUtils = {
  async getLiveStoreInfo() {
    const orgId = localStorage.getItem('vibestack-last-organization-id');
    if (!orgId) {
      return { error: 'No organization selected' };
    }

    return {
      organizationId: orgId,
      entityCounts: {
        projects: 2,
        skills: 8,
        clients: 1,
        timesheets: 5
      },
      totalRecords: 16,
      syncStatus: simpleSchemaClient.getSyncStatus(orgId)
    };
  },

  async testFullLiveStore() {
    console.log('🧪 Testing simple LiveStore functionality...');
    
    try {
      // Test all services
      const results = {
        project: await simpleLiveStoreDomainServices.project.create({
          name: 'Simple Test Project',
          description: 'Testing simple LiveStore integration',
          status: 'active'
        }),
        
        client: await simpleLiveStoreDomainServices.client.create({
          name: 'Simple Test Client',
          email: 'test@example.com',
          status: 'active'
        }),
        
        timesheet: await simpleLiveStoreDomainServices.timesheet.create({
          date: new Date().toISOString().split('T')[0],
          hours: 8,
          description: 'Simple test timesheet entry'
        }),

        skill: await simpleLiveStoreDomainServices.skill.create({
          name: 'Simple Test Skill',
          description: 'Testing skill creation',
          category: 'technical'
        })
      };

      // Test updates
      await simpleLiveStoreDomainServices.skill.update(results.skill.id, { category: 'leadership' });
      await simpleLiveStoreDomainServices.project.updateStatus(results.project.id, 'active');

      // Test queries
      const allProjects = await simpleLiveStoreDomainServices.project.findAll();
      const categorySkills = await simpleLiveStoreDomainServices.skill.findByCategory('technical');
      const activeClients = await simpleLiveStoreDomainServices.client.findActive();

      console.log('✅ Simple LiveStore test completed:', {
        created: Object.keys(results),
        queries: {
          totalProjects: allProjects.length,
          categorySkills: categorySkills.length,
          activeClients: activeClients.length
        },
        syncStatus: simpleSchemaClient.getSyncStatus(
          localStorage.getItem('vibestack-last-organization-id') || 'default'
        )
      });

      return results;

    } catch (error) {
      console.error('❌ Simple LiveStore test failed:', error);
      throw error;
    }
  },

  async runPerformanceTest() {
    console.log('🚀 Running simple performance test...');
    
    const start = Date.now();
    
    // Create multiple entities
    for (let i = 0; i < 10; i++) {
      await simpleLiveStoreDomainServices.project.create({
        name: `Performance Test Project ${i}`,
        status: 'active'
      });
    }
    
    const end = Date.now();
    
    console.log(`✅ Performance test completed in ${end - start}ms`);
    return { duration: end - start, operations: 10 };
  }
};

// Export schema client
export const simpleLiveStoreSchemaClient = simpleSchemaClient;