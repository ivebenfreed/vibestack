/**
 * LiveStore Domain Layer - Complete Replacement for Dexie
 * 
 * This is the new domain layer that uses LiveStore exclusively for all operations.
 * It replaces the previous Dexie-based implementation with event-driven architecture.
 * 
 * Key Benefits:
 * - Native event streaming sync (no manual change tracking)
 * - Multi-tenant organization isolation  
 * - Offline-first with OPFS persistence
 * - No sync loops (LiveStore handles this natively)
 * - Type-safe operations with organization schemas
 */

// Import Simple LiveStore domain services for testing
import {
  simpleLiveStoreDomainServices,
  simpleDevUtils,
  simpleLiveStoreSchemaClient
} from './simple-livestore-domain';

// ============================================================================
// Main Domain Services Export (LiveStore-based)
// ============================================================================

/**
 * Simple LiveStore services for testing migration
 */
export const domainServices = simpleLiveStoreDomainServices;

/**
 * Get domain service by entity type  
 */
export const getDomainService = (entityType: string) => {
  const service = domainServices[entityType as keyof typeof domainServices];
  if (!service) {
    throw new Error(`No domain service found for entity type: ${entityType}`);
  }
  return service;
};

/**
 * Check if entity has domain service
 */
export const hasDomainService = (entityType: string): boolean => {
  return entityType in domainServices;
};

/**
 * Get available entity types
 */
export const getAvailableEntityTypes = (): string[] => {
  return Object.keys(domainServices);
};

// ============================================================================
// Service Classes Export
// ============================================================================

// Export simple services for testing
export { 
  simpleLiveStoreDomainServices,
  simpleDevUtils,
  simpleLiveStoreSchemaClient 
};

// ============================================================================
// Types Export (from LiveStore schemas)
// ============================================================================

// Entity types will come from LiveStore organization schemas
export type Task = {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'completed';
  priority?: 'low' | 'medium' | 'high';
  projectId?: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
  deletedAt?: string;
  completedAt?: string;
};

export type Project = {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'completed' | 'archived';
  priority?: 'low' | 'medium' | 'high';
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
  deletedAt?: string;
};

export type Client = {
  id: string;
  name: string;
  email?: string;
  status: 'active' | 'inactive';
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
  deletedAt?: string;
};

export type Timesheet = {
  id: string;
  date: string;
  hours: number;
  description?: string;
  projectId?: string;
  taskId?: string;
  clientId?: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
  deletedAt?: string;
};

// ============================================================================
// Development & Migration Utilities
// ============================================================================

/**
 * Development utilities (simple implementation for testing)
 */
export const devUtils = simpleDevUtils;

// ============================================================================
// Usage Examples & Documentation
// ============================================================================

/**
 * BASIC USAGE (same interface as before, but LiveStore-powered):
 * 
 * ```typescript
 * import { domainServices } from '@/domain';
 * 
 * // Create operations (triggers LiveStore events & sync automatically)
 * const project = await domainServices.project.create({
 *   name: 'New Project',
 *   status: 'active'
 * });
 * 
 * const task = await domainServices.task.create({
 *   title: 'New Task',
 *   projectId: project.id,
 *   status: 'todo'
 * });
 * 
 * // Updates trigger sync events automatically
 * await domainServices.task.update(task.id, {
 *   status: 'completed'
 * });
 * ```
 * 
 * ADVANCED QUERIES:
 * 
 * ```typescript
 * // Custom SQL queries on LiveStore
 * const recentTasks = await domainServices.task.query(`
 *   SELECT t.*, p.name as project_name 
 *   FROM org_123_tasks t
 *   LEFT JOIN org_123_projects p ON t.project_id = p.id
 *   WHERE t.created_at > ?
 *   ORDER BY t.created_at DESC
 * `, [lastWeek]);
 * ```
 * 
 * SYNC MONITORING:
 * 
 * ```typescript
 * // Check sync status
 * const syncStatus = liveStoreSchemaClient.getSyncStatus(orgId);
 * console.log('Sync status:', syncStatus);
 * 
 * // Get all organization sync statuses
 * const allStatuses = liveStoreSchemaClient.getAllSyncStatuses();
 * ```
 * 
 * TESTING & DEVELOPMENT:
 * 
 * ```typescript
 * // Test operations
 * await devUtils.testFullLiveStore();
 * 
 * // Get database info
 * const info = await devUtils.getLiveStoreInfo();
 * 
 * // Performance testing
 * await devUtils.runPerformanceTest();
 * ```
 */

// ============================================================================
// Global Access for Development
// ============================================================================

if (typeof window !== 'undefined') {
  // Make everything available globally for debugging
  (window as any).liveStoreDomain = {
    services: domainServices,
    devUtils,
    schemaClient: simpleLiveStoreSchemaClient,
    
    // Quick access functions
    async info() {
      return await devUtils.getLiveStoreInfo();
    },
    
    async test() {
      return await devUtils.testFullLiveStore();
    },
    
    syncStatus() {
      const orgId = localStorage.getItem('vibestack-last-organization-id');
      return orgId ? simpleLiveStoreSchemaClient.getSyncStatus(orgId) : null;
    }
  };

  // Also expose the test functions for compatibility
  (window as any).testLiveStoreEventSync = {
    async testLiveStoreEventSync() {
      return await devUtils.testFullLiveStore();
    },
    
    async runAllTests() {
      return await devUtils.testFullLiveStore();
    }
  };
  
  // Make schema client available
  (window as any).liveStoreSchemaClient = simpleLiveStoreSchemaClient;
  
  console.log('🚀 Simple LiveStore Domain Layer loaded! Try:');
  console.log('  - window.liveStoreDomain.info()');
  console.log('  - window.liveStoreDomain.test()');
  console.log('  - window.liveStoreDomain.syncStatus()');
}