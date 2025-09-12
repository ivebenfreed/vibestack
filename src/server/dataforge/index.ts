/**
 * DataForge - Centralized Entity Management System
 * 
 * DataForge is the single source of truth for all entity operations in VibeStack.
 * It provides a unified interface for creating, managing, and querying entities
 * through standardized archetype patterns.
 * 
 * Core Principles:
 * - All entities must be created through one of 8 archetypes
 * - Organization-level data isolation via PostgreSQL RLS
 * - Zero-latency permission checks via Organization Actor cache
 * - Dynamic schema evolution with debounced migrations
 * - Full sync support with Legend State client
 */

// =============================================================================
// Core Components
// =============================================================================

export { ArchetypeRegistry } from './ArchetypeRegistry';
export type { 
  ArchetypeType, 
  ArchetypeDefinition 
} from './ArchetypeRegistry';

// =============================================================================
// Entity Management
// =============================================================================

// ArchetypeEntityManager removed during cleanup

export { 
  DataForgeEntityManager,
  type DataForgeEntityManagerConfig 
} from './entity-operations/EntityManager';

// =============================================================================
// Field Definitions & Rules
// =============================================================================

export { 
  type FieldDefinition,
  type ValidationRule,
  type FieldType
} from './json-rules-engine';

// =============================================================================
// Schema Management
// =============================================================================

// RuntimeSchemaGenerator removed - using stored truth from entity_schemas table

export { 
  type OrgEntityDefinition,
  type OrgEntitySchema 
} from './org-entity-schema';

// =============================================================================  
// DDL Generation & Services
// =============================================================================

export { DDLGenerator } from './DDLGenerator';
export { ArchetypeService } from './ArchetypeService';
export { BulkOperationsService } from './BulkOperationsService';
export { DependencyManager } from './services/DependencyManager';
export type { 
  DependencyType, 
  DependencyDefinition, 
  DependencyMetadata 
} from './services/DependencyManager';
export { ApprovalManager } from './services/ApprovalManager';
export type { 
  ApprovalStatus, 
  ApprovalRequest, 
  ApprovalResponse 
} from './services/ApprovalManager';

// =============================================================================
// Foundation Entities (Base Archetypes)
// =============================================================================

// Foundation entities removed during cleanup

// Project Archetype
export { Project } from './archetypes/ProjectArchetype';
export type { ProjectFields } from './archetypes/ProjectArchetype';

// Task Archetype  
export { Task } from './archetypes/TaskArchetype';
export type { TaskFields } from './archetypes/TaskArchetype';

// Record Archetype
export { Record } from './archetypes/RecordArchetype';
export type { RecordFields } from './archetypes/RecordArchetype';

// Document Archetype
export { Document } from './archetypes/DocumentArchetype';
export type { DocumentFields } from './archetypes/DocumentArchetype';

// File Archetype
export { File } from './archetypes/FileArchetype';
export type { FileFields } from './archetypes/FileArchetype';

// Activity Archetype
export { Activity } from './archetypes/ActivityArchetype';
export type { ActivityFields } from './archetypes/ActivityArchetype';

// Discussion Archetype
export { Discussion } from './archetypes/DiscussionArchetype';
export type { DiscussionFields } from './archetypes/DiscussionArchetype';

// Collection Archetype
export { Collection } from './archetypes/CollectionArchetype';
export type { CollectionFields } from './archetypes/CollectionArchetype';

// =============================================================================
// DataForge Configuration
// =============================================================================

export interface DataForgeConfig {
  /** Organization ID for data isolation */
  organizationId: string;
  
  /** User ID for permission checks */
  userId: string;
  
  /** Enable debounced migrations (default: true) */
  enableDebouncedMigrations?: boolean;
  
  /** Migration debounce time in ms (default: 30000) */
  migrationDebounceMs?: number;
  
  /** Enable Organization Actor cache (default: true) */
  enableOrgActorCache?: boolean;
  
  /** Cache TTL in ms (default: 300000) */
  cacheTTL?: number;
}

// =============================================================================
// DataForge Service
// =============================================================================

export class DataForgeService {
  private config: DataForgeConfig;
  private entityManager: ArchetypeEntityManager | null = null;
  private migrationService: ArchetypeMigrationService | null = null;
  
  constructor(config: DataForgeConfig) {
    this.config = {
      enableDebouncedMigrations: true,
      migrationDebounceMs: 30000,
      enableOrgActorCache: true,
      cacheTTL: 300000,
      ...config
    };
  }
  
  /**
   * Initialize DataForge services
   */
  async initialize(env: any): Promise<void> {
    // Initialize entity manager
    const { createDatabaseConnection, getKysely } = await import('../lib/database-manager');
    createDatabaseConnection(env);
    const kysely = getKysely();
    
    this.entityManager = new ArchetypeEntityManager({
      kysely,
      organizationId: this.config.organizationId
    });
    
    // Initialize migration service if enabled
    if (this.config.enableDebouncedMigrations) {
      this.migrationService = new ArchetypeMigrationService(kysely, {
        debounceMs: this.config.migrationDebounceMs
      });
    }
  }
  
  /**
   * Get entity manager
   */
  getEntityManager(): ArchetypeEntityManager {
    if (!this.entityManager) {
      throw new Error('DataForge not initialized. Call initialize() first.');
    }
    return this.entityManager;
  }
  
  /**
   * Get migration service
   */
  getMigrationService(): ArchetypeMigrationService | null {
    return this.migrationService;
  }
  
  /**
   * Create entity from archetype
   */
  async createEntity(
    entityName: string,
    archetype: ArchetypeType,
    customFields: FieldDefinition[] = []
  ): Promise<ArchetypeCreateResult> {
    const manager = this.getEntityManager();
    return manager.createEntityFromArchetype({
      entityName,
      archetype,
      customFields,
      orgId: this.config.organizationId,
      tableName: `org_${this.config.organizationId.replace(/-/g, '_')}_${entityName.toLowerCase()}s`
    });
  }
  
  /**
   * Query entity data
   */
  async queryEntity(
    entityName: string,
    options?: {
      limit?: number;
      offset?: number;
      where?: Record<string, any>;
      orderBy?: string;
    }
  ): Promise<ArchetypeQueryResult> {
    const manager = this.getEntityManager();
    return manager.queryEntityData(entityName, options);
  }
  
  /**
   * Delete entity
   */
  async deleteEntity(entityName: string): Promise<{ success: boolean; error?: string }> {
    const manager = this.getEntityManager();
    return manager.deleteEntity(entityName);
  }
  
  /**
   * Get all archetypes
   */
  static getAllArchetypes() {
    return ArchetypeRegistry.getAllArchetypes();
  }
  
  /**
   * Validate archetype
   */
  static validateArchetype(name: string): boolean {
    return ArchetypeRegistry.validateArchetype(name);
  }
  
  /**
   * Shutdown DataForge services
   */
  async shutdown(): Promise<void> {
    // Flush any pending migrations
    if (this.migrationService) {
      await this.migrationService.flushPendingMigrations();
    }
    
    // Clean up resources
    this.entityManager = null;
    this.migrationService = null;
  }
}

// =============================================================================
// Default Export
// =============================================================================

export default DataForgeService;