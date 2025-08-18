/**
 * LiveStore Dynamic Domain Layer - Greenfield Implementation
 * 
 * Schema-aware domain services that adapt to organization-specific entity definitions.
 * Built for greenfield applications with dynamic, multi-tenant schemas.
 * 
 * Key Benefits:
 * - Dynamic schema validation and field mapping
 * - Multi-tenant organization isolation  
 * - Real-time schema adaptation (no restart needed)
 * - Type-safe operations with organization schemas
 * - Native LiveStore event streaming sync
 */

import {
  dynamicLiveStoreDomainService,
  createDynamicEntityService,
  type DynamicEntity,
  type DynamicEntityData,
  type MutationResult
} from './dynamic-livestore-domain';

// Simple mock for development/testing
import { simpleDevUtils, simpleLiveStoreSchemaClient } from './simple-livestore-domain';

// ============================================================================
// Main Domain Services Export (LiveStore-based)
// ============================================================================

/**
 * Dynamic Domain Services - Greenfield Implementation
 * 
 * Schema-aware services that adapt to organization entity definitions.
 * This is the primary interface for all domain operations.
 */
export class DomainServices {
  /**
   * Create a dynamic entity service for a specific organization and entity type
   */
  createEntityService(orgId: string, entityName: string) {
    return createDynamicEntityService(orgId, entityName);
  }

  /**
   * Get current organization ID from context
   */
  getCurrentOrgId(): string | null {
    return localStorage.getItem('vibestack-last-organization-id');
  }

  /**
   * Create entity service for current organization
   */
  forCurrentOrg(entityName: string) {
    const orgId = this.getCurrentOrgId();
    if (!orgId) {
      throw new Error('No organization selected. Please select an organization first.');
    }
    return this.createEntityService(orgId, entityName);
  }

  /**
   * Convenience methods for common entity types (using current organization)
   * These adapt to whatever entity schemas the current organization has defined
   */
  get project() {
    return this.forCurrentOrg('SoftwareProject');
  }

  get task() {
    return this.forCurrentOrg('DevelopmentTask');
  }

  get client() {
    return this.forCurrentOrg('BusinessClient');
  }

  get timesheet() {
    return this.forCurrentOrg('TimeEntry');
  }

  get skill() {
    return this.forCurrentOrg('TechnicalSkill');
  }

  /**
   * Access the underlying dynamic service for advanced operations
   */
  get core() {
    return dynamicLiveStoreDomainService;
  }
}

/**
 * Main domain services instance - schema-aware and dynamic
 */
export const domainServices = new DomainServices();

/**
 * Get domain service for entity type in current organization
 */
export const getDomainService = (entityType: string) => {
  return domainServices.forCurrentOrg(entityType);
};

/**
 * Create domain service for specific organization and entity
 */
export const createDomainService = (orgId: string, entityType: string) => {
  return domainServices.createEntityService(orgId, entityType);
};

// ============================================================================
// Service Classes Export
// ============================================================================

// Export core dynamic services
export {
  dynamicLiveStoreDomainService,
  createDynamicEntityService
};

// Export types
export type {
  DynamicEntity,
  DynamicEntityData,
  MutationResult
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
 * BASIC USAGE - Dynamic Schema-Aware Services:
 * 
 * ```typescript
 * import { domainServices } from '@/domain';
 * 
 * // Create operations that adapt to organization schemas
 * const project = await domainServices.project.create({
 *   name: 'New Project',
 *   repositoryUrl: 'https://github.com/example/repo', // Custom field from org schema
 *   techStack: ['React', 'TypeScript'], // Another custom field  
 *   budget: 50000,
 *   status: 'active'
 * });
 * 
 * const skill = await domainServices.skill.create({
 *   name: 'TypeScript',
 *   category: 'technical',
 *   level: 'expert'
 * });
 * ```
 * 
 * CUSTOM ENTITY TYPES:
 * 
 * ```typescript
 * // Create service for any entity type defined in organization schema
 * const customEntityService = domainServices.forCurrentOrg('CustomEntity');
 * const entity = await customEntityService.create({
 *   customField1: 'value',
 *   customField2: 123
 * });
 * 
 * // Advanced: Create service for specific organization and entity
 * const service = domainServices.createEntityService('org-123', 'SoftwareProject');
 * ```
 * 
 * VALIDATION & ERROR HANDLING:
 * 
 * ```typescript
 * // Validation happens automatically based on organization schema
 * const result = await domainServices.project.create({
 *   name: 'Test Project',
 *   invalidField: 'will be filtered out',
 *   requiredField: 'validates against schema'
 * });
 * 
 * if (!result.success) {
 *   console.log('Validation errors:', result.validationErrors);
 *   console.log('Error:', result.error);
 * }
 * ```
 * 
 * QUERIES & UPDATES:
 * 
 * ```typescript
 * // Find operations
 * const projects = await domainServices.project.findAll();
 * const project = await domainServices.project.findById('project-123');
 * 
 * // Custom queries with filters
 * const activeProjects = await domainServices.project.find({ status: 'active' });
 * 
 * // Updates
 * const updated = await domainServices.project.update('project-123', {
 *   status: 'completed',
 *   completedAt: new Date().toISOString()
 * });
 * ```
 */

// ============================================================================
// Global Access for Development
// ============================================================================

if (typeof window !== 'undefined') {
  // Make dynamic domain services available globally for debugging
  (window as any).liveStoreDomain = {
    services: domainServices,
    schemaClient: simpleLiveStoreSchemaClient,
    
    // Quick access functions
    async info() {
      return await simpleDevUtils.getLiveStoreInfo();
    },
    
    async test() {
      const orgId = localStorage.getItem('vibestack-last-organization-id');
      if (!orgId) {
        return { error: 'No organization selected' };
      }
      
      console.log('🧪 Testing dynamic domain services...');
      
      try {
        // Test dynamic project creation
        const projectResult = await domainServices.project.create({
          name: 'Dynamic Test Project',
          description: 'Testing dynamic schema-aware operations',
          status: 'active'
        });
        
        if (!projectResult.success) {
          throw new Error(projectResult.error || 'Project creation failed');
        }
        
        console.log('✅ Dynamic project created:', projectResult.data?.id);
        
        // Test dynamic skill creation
        const skillResult = await domainServices.skill.create({
          name: 'Dynamic Schema Testing',
          category: 'technical',
          level: 'expert'
        });
        
        if (!skillResult.success) {
          throw new Error(skillResult.error || 'Skill creation failed');
        }
        
        console.log('✅ Dynamic skill created:', skillResult.data?.id);
        
        return {
          success: true,
          project: projectResult.data,
          skill: skillResult.data
        };
        
      } catch (error) {
        console.error('❌ Dynamic test failed:', error);
        return {
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    },
    
    syncStatus() {
      const orgId = localStorage.getItem('vibestack-last-organization-id');
      return orgId ? simpleLiveStoreSchemaClient.getSyncStatus(orgId) : null;
    }
  };

  // Make schema client available
  (window as any).liveStoreSchemaClient = simpleLiveStoreSchemaClient;
  
  console.log('🚀 LiveStore Dynamic Domain Layer loaded! Try:');
  console.log('  - window.liveStoreDomain.info() - Get LiveStore info');
  console.log('  - window.liveStoreDomain.test() - Test dynamic services');
  console.log('  - window.liveStoreDomain.services.project.create(...) - Create with org schema');
  console.log('  - window.liveStoreDomain.syncStatus() - Check sync status');
}