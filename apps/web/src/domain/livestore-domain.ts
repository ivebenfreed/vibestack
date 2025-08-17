/**
 * LiveStore Domain Layer - Complete Replacement for Dexie
 * 
 * This provides a clean, service-based architecture using LiveStore exclusively.
 * Replaces the Dexie-based domain services with LiveStore event-driven operations.
 * 
 * Key features:
 * - Native LiveStore event-sourcing operations
 * - Automatic sync via native event streaming 
 * - Type-safe operations using organization schemas
 * - Multi-tenant organization isolation
 * - No Dexie dependencies
 */

import { liveStoreSchemaClient, type LiveStoreInstance } from '../lib/livestore-schema-client';

// LiveStore event types for domain operations
interface DomainEvent {
  type: string;
  data: any;
  timestamp?: string;
}

/**
 * Base LiveStore Domain Service
 * 
 * Provides common patterns for LiveStore operations
 */
export abstract class BaseLiveStoreDomainService<TEntity = any> {
  protected abstract entityName: string;
  protected abstract entityTypePlural: string;

  /**
   * Get current organization's LiveStore instance
   */
  protected async getLiveStoreInstance(): Promise<LiveStoreInstance> {
    const orgId = this.getCurrentOrgId();
    const instance = liveStoreSchemaClient.getLiveStoreInstance(orgId);
    
    if (!instance) {
      throw new Error(`LiveStore not initialized for organization: ${orgId}`);
    }
    
    return instance;
  }

  /**
   * Get current organization ID
   */
  protected getCurrentOrgId(): string {
    // TODO: Get from your organization context
    const orgId = localStorage.getItem('vibestack-last-organization-id');
    if (!orgId) {
      throw new Error('No organization selected');
    }
    return orgId;
  }

  /**
   * Get organization-scoped table name
   */
  protected getTableName(): string {
    const orgId = this.getCurrentOrgId();
    return liveStoreSchemaClient.getTableName(orgId, this.entityTypePlural);
  }

  /**
   * Create entity with LiveStore event
   */
  async create(data: Partial<TEntity>): Promise<TEntity> {
    const liveStore = await this.getLiveStoreInstance();
    
    // Generate ID and add metadata
    const entity = {
      id: this.generateId(),
      ...data,
      organizationId: this.getCurrentOrgId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: this.getCurrentUserId(),
    } as TEntity;

    // Commit LiveStore event (this triggers sync automatically)
    await liveStore.store.commit(
      this.createEntityEvent('Created', entity)
    );

    console.log(`✅ Created ${this.entityName}:`, entity);
    return entity;
  }

  /**
   * Update entity with LiveStore event
   */
  async update(id: string, updates: Partial<TEntity>): Promise<TEntity> {
    const liveStore = await this.getLiveStoreInstance();
    
    // Get current entity
    const current = await this.findById(id);
    if (!current) {
      throw new Error(`${this.entityName} not found: ${id}`);
    }

    // Create updated entity
    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: this.getCurrentUserId(),
    } as TEntity;

    // Commit LiveStore event
    await liveStore.store.commit(
      this.createEntityEvent('Updated', updated)
    );

    console.log(`✅ Updated ${this.entityName}:`, updated);
    return updated;
  }

  /**
   * Delete entity with LiveStore event
   */
  async delete(id: string): Promise<void> {
    const liveStore = await this.getLiveStoreInstance();
    
    // Verify entity exists
    const entity = await this.findById(id);
    if (!entity) {
      throw new Error(`${this.entityName} not found: ${id}`);
    }

    // Commit delete event
    await liveStore.store.commit(
      this.createEntityEvent('Deleted', { id })
    );

    console.log(`✅ Deleted ${this.entityName}:`, id);
  }

  /**
   * Find entity by ID
   */
  async findById(id: string): Promise<TEntity | null> {
    const liveStore = await this.getLiveStoreInstance();
    const tableName = this.getTableName();
    
    const results = await liveStore.query(`
      SELECT * FROM ${tableName} 
      WHERE id = ? AND deleted_at IS NULL
    `, [id]);

    return results[0] || null;
  }

  /**
   * Find all entities
   */
  async findAll(): Promise<TEntity[]> {
    const liveStore = await this.getLiveStoreInstance();
    const tableName = this.getTableName();
    
    return await liveStore.query(`
      SELECT * FROM ${tableName} 
      WHERE deleted_at IS NULL 
      ORDER BY created_at DESC
    `);
  }

  /**
   * Find entities with custom query
   */
  async query(sql: string, params: any[] = []): Promise<TEntity[]> {
    const liveStore = await this.getLiveStoreInstance();
    return await liveStore.query(sql, params);
  }

  /**
   * Batch create entities
   */
  async batchCreate(entities: Partial<TEntity>[]): Promise<TEntity[]> {
    const liveStore = await this.getLiveStoreInstance();
    
    const events = entities.map(data => {
      const entity = {
        id: this.generateId(),
        ...data,
        organizationId: this.getCurrentOrgId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: this.getCurrentUserId(),
      } as TEntity;

      return this.createEntityEvent('Created', entity);
    });

    // Commit all events in a single transaction
    await liveStore.store.commit(...events);

    console.log(`✅ Batch created ${entities.length} ${this.entityTypePlural}`);
    return entities as TEntity[];
  }

  // Protected helper methods

  /**
   * Create LiveStore event for entity operation
   */
  protected createEntityEvent(operation: string, data: any): DomainEvent {
    return {
      type: `${this.entityName}${operation}`,
      data,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate unique ID
   */
  protected generateId(): string {
    // Use nanoid or similar
    return `${this.entityName.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get current user ID
   */
  protected getCurrentUserId(): string {
    // TODO: Get from your auth context
    return 'current-user-id';
  }
}

/**
 * Project Domain Service - LiveStore Implementation
 */
export class LiveStoreProjectDomainService extends BaseLiveStoreDomainService {
  protected entityName = 'Project';
  protected entityTypePlural = 'projects';

  /**
   * Find projects by status
   */
  async findByStatus(status: string) {
    const tableName = this.getTableName();
    return await this.query(`
      SELECT * FROM ${tableName} 
      WHERE status = ? AND deleted_at IS NULL
    `, [status]);
  }

  /**
   * Update project status
   */
  async updateStatus(id: string, status: string) {
    return await this.update(id, { status });
  }
}

/**
 * Task Domain Service - LiveStore Implementation  
 */
export class LiveStoreTaskDomainService extends BaseLiveStoreDomainService {
  protected entityName = 'Task';
  protected entityTypePlural = 'tasks';

  /**
   * Find tasks by project
   */
  async findByProject(projectId: string) {
    const tableName = this.getTableName();
    return await this.query(`
      SELECT * FROM ${tableName} 
      WHERE project_id = ? AND deleted_at IS NULL
    `, [projectId]);
  }

  /**
   * Complete task
   */
  async complete(id: string) {
    return await this.update(id, { 
      status: 'completed',
      completedAt: new Date().toISOString()
    });
  }
}

/**
 * Client Domain Service - LiveStore Implementation
 */
export class LiveStoreClientDomainService extends BaseLiveStoreDomainService {
  protected entityName = 'Client';
  protected entityTypePlural = 'clients';

  /**
   * Find active clients
   */
  async findActive() {
    const tableName = this.getTableName();
    return await this.query(`
      SELECT * FROM ${tableName} 
      WHERE status = 'active' AND deleted_at IS NULL
    `);
  }
}

/**
 * Timesheet Domain Service - LiveStore Implementation
 */
export class LiveStoreTimesheetDomainService extends BaseLiveStoreDomainService {
  protected entityName = 'Timesheet';
  protected entityTypePlural = 'timesheets';

  /**
   * Find timesheets by date range
   */
  async findByDateRange(startDate: string, endDate: string) {
    const tableName = this.getTableName();
    return await this.query(`
      SELECT * FROM ${tableName} 
      WHERE date >= ? AND date <= ? AND deleted_at IS NULL
      ORDER BY date DESC
    `, [startDate, endDate]);
  }
}

// ============================================================================
// Domain Service Instances - LiveStore Version
// ============================================================================

/**
 * Singleton instances of LiveStore domain services
 */
export const liveStoreDomainServices = {
  project: new LiveStoreProjectDomainService(),
  task: new LiveStoreTaskDomainService(),
  client: new LiveStoreClientDomainService(),
  timesheet: new LiveStoreTimesheetDomainService(),
} as const;

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Get a LiveStore domain service by entity type
 */
export function getLiveStoreDomainService(entityType: string) {
  const service = liveStoreDomainServices[entityType as keyof typeof liveStoreDomainServices];
  if (!service) {
    throw new Error(`No LiveStore domain service found for entity type: ${entityType}`);
  }
  return service;
}

/**
 * Check if entity has LiveStore domain service
 */
export function hasLiveStoreDomainService(entityType: string): boolean {
  return entityType in liveStoreDomainServices;
}

/**
 * Get all available LiveStore entity types
 */
export function getLiveStoreEntityTypes(): string[] {
  return Object.keys(liveStoreDomainServices);
}

// ============================================================================
// Migration Utilities
// ============================================================================

/**
 * Migration utilities for switching from Dexie to LiveStore
 */
export const liveStoreMigrationUtils = {
  /**
   * Test LiveStore operations
   */
  async testOperations() {
    console.log('🧪 Testing LiveStore domain operations...');
    
    try {
      // Test project creation
      const project = await liveStoreDomainServices.project.create({
        name: 'Test LiveStore Project',
        description: 'Testing LiveStore event-driven operations',
        status: 'active'
      });

      // Test task creation
      const task = await liveStoreDomainServices.task.create({
        title: 'Test LiveStore Task',
        description: 'Testing task operations',
        projectId: project.id,
        status: 'todo'
      });

      // Test update
      await liveStoreDomainServices.task.update(task.id, {
        status: 'in_progress'
      });

      // Test query
      const allProjects = await liveStoreDomainServices.project.findAll();
      
      console.log('✅ LiveStore operations test completed:', {
        projectsCreated: 1,
        tasksCreated: 1,
        totalProjects: allProjects.length
      });

    } catch (error) {
      console.error('❌ LiveStore operations test failed:', error);
      throw error;
    }
  },

  /**
   * Get sync status for current organization
   */
  getSyncStatus() {
    try {
      const orgId = localStorage.getItem('vibestack-last-organization-id');
      if (!orgId) return { error: 'No organization selected' };
      
      return liveStoreSchemaClient.getSyncStatus(orgId);
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  /**
   * Get all organization sync statuses
   */
  getAllSyncStatuses() {
    return liveStoreSchemaClient.getAllSyncStatuses();
  }
};

// ============================================================================
// Development Utilities
// ============================================================================

/**
 * Development utilities for LiveStore
 */
export const liveStoreDevUtils = {
  /**
   * Clear LiveStore data (for testing)
   */
  async clearAllData() {
    const liveStore = await liveStoreDomainServices.project.getLiveStoreInstance();
    const orgId = liveStoreDomainServices.project.getCurrentOrgId();
    
    const tables = ['projects', 'tasks', 'clients', 'timesheets'];
    
    for (const table of tables) {
      const tableName = liveStoreSchemaClient.getTableName(orgId, table);
      await liveStore.query(`DELETE FROM ${tableName}`);
    }
    
    console.log('✅ All LiveStore data cleared');
  },

  /**
   * Seed test data with LiveStore
   */
  async seedTestData() {
    // Create test projects
    const project1 = await liveStoreDomainServices.project.create({
      name: 'LiveStore Test Project 1',
      description: 'Testing LiveStore event-driven operations',
      status: 'active',
      priority: 'high'
    });

    const project2 = await liveStoreDomainServices.project.create({
      name: 'LiveStore Test Project 2',
      description: 'Another LiveStore test project',
      status: 'active',
      priority: 'medium'
    });

    // Create test tasks
    const tasks = [
      { title: 'LiveStore Task 1', description: 'First LiveStore task', projectId: project1.id, status: 'todo' },
      { title: 'LiveStore Task 2', description: 'Second LiveStore task', projectId: project1.id, status: 'in_progress' },
      { title: 'LiveStore Task 3', description: 'Third LiveStore task', projectId: project2.id, status: 'completed' },
    ];

    for (const task of tasks) {
      await liveStoreDomainServices.task.create(task);
    }

    console.log('✅ LiveStore test data seeded:', { projects: 2, tasks: 3 });
  },

  /**
   * Performance test for LiveStore
   */
  async runPerformanceTest() {
    console.log('⚡ Running LiveStore performance test...');
    
    const bulkTasks = Array.from({ length: 100 }, (_, i) => ({
      title: `LiveStore Benchmark Task ${i + 1}`,
      description: 'Generated for LiveStore performance testing',
      status: 'todo'
    }));

    const start = performance.now();
    await liveStoreDomainServices.task.batchCreate(bulkTasks);
    const end = performance.now();

    const queryStart = performance.now();
    const allTasks = await liveStoreDomainServices.task.findAll();
    const queryEnd = performance.now();

    console.log('📊 LiveStore performance results:', {
      batchCreate: `${(end - start).toFixed(2)}ms for 100 tasks`,
      perTask: `${((end - start) / 100).toFixed(3)}ms per task`,
      queryTime: `${(queryEnd - queryStart).toFixed(2)}ms for findAll`,
      totalTasks: allTasks.length
    });
  }
};

// Make utilities available globally for testing
if (typeof window !== 'undefined') {
  (window as any).liveStoreDomain = {
    services: liveStoreDomainServices,
    migration: liveStoreMigrationUtils,
    dev: liveStoreDevUtils
  };
}

// ============================================================================
// Export Types
// ============================================================================

export type {
  DomainEvent
};

export {
  BaseLiveStoreDomainService,
  LiveStoreProjectDomainService,
  LiveStoreTaskDomainService,
  LiveStoreClientDomainService,
  LiveStoreTimesheetDomainService
};