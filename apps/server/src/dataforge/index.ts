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

export { 
  ArchetypeEntityManager,
  type ArchetypeEntityData,
  type ArchetypeCreateResult,
  type ArchetypeQueryResult
} from './entity-operations/ArchetypeEntityManager';

export { 
  EntityManager,
  type EntityManagerConfig 
} from './entity-operations/entity-manager';

// =============================================================================
// Field Definitions & Rules
// =============================================================================

export { 
  type FieldDefinition,
  type ValidationRule,
  type FieldType
} from './rules/json-rules-engine';

// =============================================================================
// Schema Management
// =============================================================================

export { 
  RuntimeSchemaGenerator 
} from './kysely-generator/runtime-schema-generator';

export { 
  type OrgEntityDefinition,
  type OrgEntitySchema 
} from './json-schema/org-entity-schema';

// =============================================================================
// Migration Services
// =============================================================================

export { 
  ArchetypeMigrationService 
} from './migration/archetype-migration-service';

export { 
  DebouncedMigrationService 
} from './migration/debounced-migration-service';

// =============================================================================
// Foundation Entities (Base Archetypes)
// =============================================================================

export { FoundationEntityRegistry } from './entities/foundation';

// Project Archetype
export { Project } from './entities/foundation/archetypes/ProjectArchetype';
export type { ProjectFields } from './entities/foundation/archetypes/ProjectArchetype';

// Task Archetype
export { Task } from './entities/foundation/archetypes/TaskArchetype';
export type { TaskFields } from './entities/foundation/archetypes/TaskArchetype';

// Record Archetype
export { Record } from './entities/foundation/archetypes/RecordArchetype';
export type { RecordFields } from './entities/foundation/archetypes/RecordArchetype';

// Document Archetype
export { Document } from './entities/foundation/archetypes/DocumentArchetype';
export type { DocumentFields } from './entities/foundation/archetypes/DocumentArchetype';

// File Archetype
export { File } from './entities/foundation/archetypes/FileArchetype';
export type { FileFields } from './entities/foundation/archetypes/FileArchetype';

// Activity Archetype
export { Activity } from './entities/foundation/archetypes/ActivityArchetype';
export type { ActivityFields } from './entities/foundation/archetypes/ActivityArchetype';

// Discussion Archetype
export { Discussion } from './entities/foundation/archetypes/DiscussionArchetype';
export type { DiscussionFields } from './entities/foundation/archetypes/DiscussionArchetype';

// Collection Archetype
export { Collection } from './entities/foundation/archetypes/CollectionArchetype';
export type { CollectionFields } from './entities/foundation/archetypes/CollectionArchetype';

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
    const { getKysely } = await import('../lib/kysely');
    const kysely = getKysely(env);
    
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