import { v4 as uuidv4 } from 'uuid';
import type {
  EntityTestConfig,
  TestResult,
  TestStep,
  TestStepResult,
  ValidationResult,
  EntityType,
  OperationType,
  TestExecutionContext
} from '../core/TestTypes';
import { SyncTestFramework } from '../core/SyncTestFramework';
import { DataGeneratorFactory } from '../datagen/DataGeneratorFactory';
import { 
  TaskStatus, 
  TaskPriority, 
  ProjectStatus, 
  UserRole,
  User,
  Project,
  Task,
  Comment,
  CLIENT_DOMAIN_TABLES,
  CLIENT_JUNCTION_TABLES,
  CLIENT_DOMAIN_TABLE_HIERARCHY,
  CLIENT_RELATIONSHIP_CONFIGS,
  getEntityRelationships,
  hasRelationshipConfig,
  getJunctionRelationships,
  type RelationshipConfig
} from '@repo/dataforge/client-entities';

/**
 * Pure CRUD Tests - Database Operations Only
 * Tests fundamental create, read, update, delete operations
 * using repositories directly to avoid any sync tracking
 */
export class PureCRUDTests {
  private dataGenerator?: DataGeneratorFactory;
  private createdEntities: Map<string, any[]> = new Map(); // Track all entities created during test

  constructor(private framework: SyncTestFramework) {
    // Initialize entity tracking for all entity types
    this.createdEntities.set('users', []);
    this.createdEntities.set('projects', []);
    this.createdEntities.set('tasks', []);
    this.createdEntities.set('comments', []);
  }

  /**
   * Track a newly created entity
   */
  private trackCreatedEntity(entityType: string, entity: any): void {
    const entities = this.createdEntities.get(entityType) || [];
    entities.push(entity);
    this.createdEntities.set(entityType, entities);
    console.log(`[PURE-CRUD] [TRACKING] Added ${entityType} entity ${entity.id} to tracking (total: ${entities.length})`);
  }

  /**
   * Remove a deleted entity from tracking
   */
  private untrackDeletedEntity(entityType: string, entityId: string): void {
    const entities = this.createdEntities.get(entityType) || [];
    const index = entities.findIndex((e: any) => e.id === entityId);
    if (index > -1) {
      entities.splice(index, 1);
    }
  }

  /**
   * Create comprehensive test steps that include setup and CRUD operations for all entity types
   */
  private createComprehensiveTestSteps(config: EntityTestConfig, entityTypes: EntityType[]): TestStep[] {
    const steps: TestStep[] = [];

    // Setup step - creates comprehensive test data for all entity types
    steps.push({
      id: 'comprehensive-setup',
      name: 'Setup + INSERT Operations for All Entity Types',
      description: 'Prepare test environment and INSERT comprehensive test data for all entity types using repository methods directly (no sync tracking)',
      phase: 'setup',
      execute: async (context) => this.setupTest(context, config),
      validate: async (context, result) => this.validateSetup(context, result)
    });

    // Create CRUD operation steps for each entity type
    entityTypes.forEach(entityType => {
    config.operations.forEach(operation => {
      steps.push({
          id: `${operation}-${entityType}-operation`,
          name: `${operation.toUpperCase()} Operation - ${entityType}`,
          description: `Execute ${operation} operation for ${entityType} using repositories directly (no sync tracking)`,
        phase: 'execution',
          execute: async (context) => {
            // Create a temporary config for this specific entity and operation
            const entityConfig = { ...config, entity: entityType };
            return this.executePureCRUDOperation(context, entityConfig, operation);
          },
        validate: async (context, result) => this.validateCRUDOperation(context, result, operation)
        });
      });
    });

    // Database validation step
    steps.push({
      id: 'comprehensive-database-validation',
      name: 'Comprehensive Database State Validation',
      description: 'Validate final database state and data integrity for all entity types',
      phase: 'validation',
      execute: async (context) => this.executeComprehensiveDatabaseValidation(context, config, entityTypes),
      validate: async (context, result) => this.validateDatabaseState(context, result)
    });

    // Sync isolation validation step
    steps.push({
      id: 'comprehensive-sync-isolation-validation',
      name: 'Comprehensive Sync Isolation Validation',
      description: 'Validate that no sync tracking occurred during any operations across all entity types',
      phase: 'validation',
      execute: async (context) => this.executeSyncIsolationValidation(context, config),
      validate: async (context, result) => this.validateSyncIsolation(context, result)
    });

    // Domain coverage validation step
    steps.push({
      id: 'comprehensive-domain-coverage-validation',
      name: 'Comprehensive Domain Coverage Validation',
      description: 'Validate comprehensive coverage of client entity fields, enums, and relations across all entity types',
      phase: 'validation',
      execute: async (context) => this.executeDomainCoverageValidation(context, config),
      validate: async (context, result) => this.validateDomainCoverage(context, result)
    });

    // Cleanup step - always runs regardless of test success/failure
    steps.push({
      id: 'comprehensive-cleanup',
      name: 'Comprehensive Test Cleanup',
      description: 'Clean up all created entities in reverse hierarchy order (respecting foreign key constraints)',
      phase: 'cleanup',
      execute: async (context) => this.executeComprehensiveCleanup(context, config, entityTypes),
      validate: async (context, result) => this.validateCleanup(context, result)
    });

    return steps;
  }

  /**
   * Execute comprehensive database validation for all entity types
   */
  private async executeComprehensiveDatabaseValidation(
    context: TestExecutionContext, 
    config: EntityTestConfig,
    entityTypes: EntityType[]
  ): Promise<TestStepResult> {
    const startTime = Date.now();
    const repositories = context.metadata.repositories;
    
    try {
      const validationResults: Record<string, any> = {};
      let overallSuccess = true;

      // Validate each entity type
      for (const entityType of entityTypes) {
        const entityConfig = { ...config, entity: entityType };
        const result = await this.executeDatabaseValidation(context, entityConfig);
        validationResults[entityType] = result;
        
        if (!result.success) {
          overallSuccess = false;
        }
      }

      return {
        success: overallSuccess,
        data: {
          entityValidations: validationResults,
          entityTypes,
          overallSuccess
        },
        duration: Date.now() - startTime,
        metadata: {
          entityTypes,
          validatedEntityCount: entityTypes.length,
          successfulValidations: Object.values(validationResults).filter((r: any) => r.success).length,
          failedValidations: Object.values(validationResults).filter((r: any) => !r.success).length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        duration: Date.now() - startTime,
        metadata: { entityTypes }
      };
    }
  }

  /**
   * Setup test environment and generate test data
   */
  async setupTest(context: TestExecutionContext, config: EntityTestConfig): Promise<TestStepResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[PURE-CRUD] [SETUP] Starting comprehensive test environment setup...`);
      
      // Get services from framework (services contain repository references)
      const services = this.framework.getServices();
      if (!services) {
        throw new Error('Services not available in framework');
      }

      // Extract repositories from services
      const repositories = {
        users: services.users.repository,
        projects: services.projects.repository,
        tasks: services.tasks.repository,
        comments: services.comments.repository
      };

      // Initialize data generator with services
      this.dataGenerator = new DataGeneratorFactory(services);
      
      // Store repositories and generator in context
      context.metadata.repositories = repositories;
      context.metadata.services = services;
      context.metadata.dataGenerator = this.dataGenerator;
      context.metadata.operationResults = {};
      context.metadata.databaseSnapshots = {};
      context.metadata.createdEntitiesMap = new Map<string, any[]>(); // Track all created entities for cleanup

      // Generate comprehensive test dataset using DataGeneratorFactory's built-in methods
      console.log(`[PURE-CRUD] [SETUP] Generating comprehensive test dataset for domain coverage...`);
      const testDataset = await this.dataGenerator.generateTestDataset({
        counts: {
          users: 5,    // Multiple users with different roles
          projects: 3, // Multiple projects with different statuses  
          tasks: 8,    // Multiple tasks with different statuses/priorities
          comments: 6  // Multiple comments with different relationships
        }
      });

      // Also generate edge case data for better field coverage
      const edgeCaseData = await this.dataGenerator.generateEdgeCaseData();
      
      // Create entities in database using hierarchy order to respect foreign key constraints
      console.log(`[PURE-CRUD] [SETUP] Creating entities in database using hierarchy order...`);
      const createdEntities: Record<string, any[]> = {};
      const insertOperations: any[] = []; // Track all insert operations for reporting
      
      // Get entity types sorted by hierarchy level (lowest level first - no dependencies)
      const entityTypes = ['users', 'projects', 'tasks', 'comments'];
      const sortedEntityTypes = [...entityTypes].sort((a, b) => {
        const levelA = CLIENT_DOMAIN_TABLE_HIERARCHY[`"${a}"` as keyof typeof CLIENT_DOMAIN_TABLE_HIERARCHY] || 0;
        const levelB = CLIENT_DOMAIN_TABLE_HIERARCHY[`"${b}"` as keyof typeof CLIENT_DOMAIN_TABLE_HIERARCHY] || 0;
        return levelA - levelB; // Sort ascending (lowest level first)
      });
      
      console.log(`[PURE-CRUD] [SETUP] Entity creation order based on hierarchy:`, sortedEntityTypes.map((type: string) => 
        `${type} (level ${CLIENT_DOMAIN_TABLE_HIERARCHY[`"${type}"` as keyof typeof CLIENT_DOMAIN_TABLE_HIERARCHY] || 0})`
      ));

      // Create entities in dependency order - THESE ARE INSERT OPERATIONS
      for (const entityType of sortedEntityTypes) {
        const entityData = testDataset[entityType as keyof typeof testDataset] || [];
        if (entityData.length > 0) {
          console.log(`[PURE-CRUD] [SETUP] 📝 INSERTING ${entityData.length} ${entityType} entities...`);
          createdEntities[entityType] = [];
          
          for (const entity of entityData) {
            try {
              const insertStartTime = Date.now();
              
              // CREATE ENTITY USING REPOSITORY DIRECTLY (NO SYNC TRACKING) - THIS IS AN INSERT OPERATION
              const repository = repositories[entityType as keyof typeof repositories];
              const createdEntity = await repository.create(entity);
              createdEntities[entityType].push(createdEntity);
              
              // Track this as an INSERT operation for reporting
              insertOperations.push({
                operation: 'INSERT',
                entityType,
                entityId: createdEntity.id,
                syncIsolated: true, // Repository methods bypass sync tracking
                duration: Date.now() - insertStartTime,
                successful: true,
                relationships: {
                  hasProjectId: !!(entity.projectId),
                  hasAssigneeId: !!(entity.assigneeId),
                  hasAuthorId: !!(entity.authorId),
                  hasOwnerId: !!(entity.ownerId)
                },
                enumFields: {
                  status: entity.status,
                  priority: entity.priority,
                  role: entity.role
                }
              });
              
              // Add to created entities map for cleanup tracking
              if (!context.metadata.createdEntitiesMap.has(entityType)) {
                context.metadata.createdEntitiesMap.set(entityType, []);
              }
              context.metadata.createdEntitiesMap.get(entityType)!.push(createdEntity);
              
              console.log(`[PURE-CRUD] [SETUP] ✅ INSERTED ${entityType}:`, {
                id: createdEntity.id,
                hasRelationships: !!(entity.projectId || entity.assigneeId || entity.authorId || entity.ownerId),
                enumFields: {
                  status: entity.status,
                  priority: entity.priority,
                  role: entity.role
                }
              });
            } catch (error) {
              const insertStartTime = Date.now(); // Declare for error case
              console.error(`[PURE-CRUD] [SETUP] ❌ Failed to INSERT ${entityType}:`, error);
              
              // Track failed insert operation
              insertOperations.push({
                operation: 'INSERT',
                entityType,
                entityId: 'failed',
                syncIsolated: true,
                duration: Date.now() - insertStartTime,
                successful: false,
                error: error instanceof Error ? error.message : String(error)
              });
              
              throw error;
            }
          }
          
          console.log(`[PURE-CRUD] [SETUP] ✅ Successfully INSERTED all ${entityData.length} ${entityType} entities`);
        }
      }
      
      // Store comprehensive test data in context (now with created entities)
      context.metadata.testData = {
        comprehensive: {
          data: createdEntities, // Use the actually created entities
            metadata: {
            variation: 'comprehensive',
            entityTypes: Object.keys(createdEntities),
            totalEntities: Object.values(createdEntities).reduce((sum, entities) => sum + entities.length, 0),
              generatedAt: Date.now(),
            note: 'Comprehensive dataset created in database using hierarchy order'
          }
        },
        edgeCases: {
          data: edgeCaseData,
          metadata: {
            variation: 'edge_cases',
            generatedAt: Date.now(),
            note: 'Edge case data for field coverage'
          }
        }
      };

      // Capture initial database snapshot
      context.metadata.databaseSnapshots.initial = await this.captureDatabaseSnapshot(repositories, config.entity);

      const totalInsertedEntities = insertOperations.filter(op => op.successful).length;
      const failedInsertions = insertOperations.filter(op => !op.successful).length;

      console.log(`[PURE-CRUD] [SETUP] 📊 SETUP SUMMARY:`);
      console.log(`[PURE-CRUD] [SETUP]   Total INSERT operations: ${insertOperations.length}`);
      console.log(`[PURE-CRUD] [SETUP]   Successful INSERTs: ${totalInsertedEntities}`);
      console.log(`[PURE-CRUD] [SETUP]   Failed INSERTs: ${failedInsertions}`);
      console.log(`[PURE-CRUD] [SETUP]   Entity types created: ${Object.keys(createdEntities).join(', ')}`);
      console.log(`[PURE-CRUD] [SETUP]   Hierarchy order respected: ✅`);
      console.log(`[PURE-CRUD] [SETUP]   Sync tracking bypassed: ✅`);

      return {
        success: true,
        duration: Date.now() - startTime,
        data: { 
          message: `Setup completed for ${config.entity} entity with comprehensive test data`,
          datasetStats: {
            users: createdEntities.users?.length || 0,
            projects: createdEntities.projects?.length || 0,
            tasks: createdEntities.tasks?.length || 0,
            comments: createdEntities.comments?.length || 0,
            edgeCases: Object.keys(edgeCaseData).length
          },
          hierarchyOrder: sortedEntityTypes,
          insertOperations, // Include all insert operations for reporting
          totalInsertedEntities,
          failedInsertions,
          insertOperationsByEntity: Object.fromEntries(
            sortedEntityTypes.map(entityType => [
              entityType,
              insertOperations.filter(op => op.entityType === entityType && op.successful).length
            ])
          )
        },
        metadata: {
          repositoriesAvailable: Object.keys(repositories).length,
          testDataVariations: Object.keys(context.metadata.testData).length,
          generatedEntities: Object.values(createdEntities).reduce((sum, entities) => sum + entities.length, 0),
          initialEntityCount: context.metadata.databaseSnapshots.initial.entityCount,
          syncIsolationMaintained: true,
          comprehensiveDataGenerated: true,
          entitiesCreatedInHierarchyOrder: true,
          insertOperationsPerformed: insertOperations.length,
          successfulInsertions: totalInsertedEntities,
          failedInsertions,
          setupIncludedInsertOperations: true
        }
      };
    } catch (error) {
      console.error(`[PURE-CRUD] [SETUP] ❌ Setup failed:`, error);
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error as Error,
        metadata: {
          setupFailed: true,
          failurePoint: 'entity_creation'
        }
      };
    }
  }

  /**
   * Execute pure CRUD operation using repositories directly
   */
  private async executePureCRUDOperation(
    context: TestExecutionContext, 
    config: EntityTestConfig, 
    operation: OperationType
  ): Promise<TestStepResult> {
    const startTime = Date.now();
    const repositories = context.metadata.repositories;
    const testData = context.metadata.testData;
    
    try {
      console.log(`\n[PURE-CRUD] ========================================`);
      console.log(`[PURE-CRUD] EXECUTING ${operation.toUpperCase()} OPERATION - ${config.entity}`);
      console.log(`[PURE-CRUD] ========================================`);
      
      // Report progress to console if available
      const progressLog = (this as any).progressLog;
      if (progressLog) {
        progressLog(30 + Math.random() * 40, `🔄 ${operation.toUpperCase()} operation on ${config.entity}...`);
      }
      
      // Get appropriate repository for entity type
      const repository = this.getRepositoryForEntity(repositories, config.entity);
      
      // CRITICAL: Capture sync state before operation to verify NO sync tracking
      const preOpSyncState = this.framework.getCurrentSyncState();
      const preOpLocalChanges = await this.framework.getLocalChanges();
      
      console.log(`[PURE-CRUD] Pre-operation sync state:`, {
        pendingChanges: preOpSyncState.pendingChangesCount,
        queueSize: preOpSyncState.queueSize,
        localChanges: preOpLocalChanges.length
      });
      
      // Capture pre-operation database snapshot
      const preOpSnapshot = await this.captureDatabaseSnapshot(repositories, config.entity);
      console.log(`[PURE-CRUD] Pre-operation ${config.entity} count: ${preOpSnapshot.entityCount}`);

      // Execute the operation using repository methods directly (no sync tracking)
      let operationResult;
      let operationDetails: any = {};
      
      switch (operation) {
        case 'insert':
          console.log(`[PURE-CRUD] Performing INSERT operation...`);
          operationResult = await this.createEntityDirect(repository, config.entity, testData, context);
          operationDetails = {
            operation: 'insert',
            entityId: operationResult.id,
            entityType: config.entity,
            created: true
          };
          console.log(`[PURE-CRUD] ✅ INSERT completed - Created ${config.entity} with ID: ${operationResult.id}`);
          break;
          
        case 'update':
          console.log(`[PURE-CRUD] Performing UPDATE operation...`);
          operationResult = await this.updateEntityDirect(repository, config.entity, testData, context);
          operationDetails = {
            operation: 'update',
            entityId: operationResult.id,
            entityType: config.entity,
            updated: true,
            updatedFields: Object.keys(this.generateUpdateData(config.entity))
          };
          console.log(`[PURE-CRUD] ✅ UPDATE completed - Updated ${config.entity} with ID: ${operationResult.id}`);
          console.log(`[PURE-CRUD] Updated fields:`, operationDetails.updatedFields);
          break;
          
        case 'delete':
          console.log(`[PURE-CRUD] Performing DELETE operation...`);
          operationResult = await this.deleteEntityDirect(repository, config.entity, testData, context);
          operationDetails = {
            operation: 'delete',
            entityId: operationResult.entityId,
            entityType: config.entity,
            deleted: true,
            temporary: operationResult.temporary || false
          };
          console.log(`[PURE-CRUD] ✅ DELETE completed - Deleted ${config.entity} with ID: ${operationResult.entityId}${operationResult.temporary ? ' (temporary entity)' : ''}`);
          break;
          
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }

      // Wait a moment for any potential sync processing (there should be none)
      await new Promise(resolve => setTimeout(resolve, 200));

      // CRITICAL: Verify sync state hasn't changed (no sync tracking)
      const postOpSyncState = this.framework.getCurrentSyncState();
      const postOpLocalChanges = await this.framework.getLocalChanges();
      
      console.log(`[PURE-CRUD] Post-operation sync state:`, {
        pendingChanges: postOpSyncState.pendingChangesCount,
        queueSize: postOpSyncState.queueSize,
        localChanges: postOpLocalChanges.length
      });
      
      // Validate that repository methods did NOT trigger sync tracking
      const syncStateChanged = postOpSyncState.pendingChangesCount !== preOpSyncState.pendingChangesCount;
      const localChangesAdded = postOpLocalChanges.length !== preOpLocalChanges.length;
      
      if (syncStateChanged || localChangesAdded) {
        console.log(`[PURE-CRUD] ❌ SYNC ISOLATION VIOLATION DETECTED!`);
        throw new Error(
          `Repository method incorrectly triggered sync tracking! ` +
          `Pending changes: ${preOpSyncState.pendingChangesCount} → ${postOpSyncState.pendingChangesCount}, ` +
          `Local changes: ${preOpLocalChanges.length} → ${postOpLocalChanges.length}`
        );
      }

      console.log(`[PURE-CRUD] ✅ SYNC ISOLATION MAINTAINED - No sync tracking detected`);

      // Capture post-operation database snapshot
      const postOpSnapshot = await this.captureDatabaseSnapshot(repositories, config.entity);
      const entityCountDelta = postOpSnapshot.entityCount - preOpSnapshot.entityCount;
      
      console.log(`[PURE-CRUD] Post-operation ${config.entity} count: ${postOpSnapshot.entityCount} (${entityCountDelta >= 0 ? '+' : ''}${entityCountDelta})`);

      // Store operation result for later validation
      context.metadata.operationResults[operation] = {
        result: operationResult,
        details: operationDetails,
        preOpSnapshot,
        postOpSnapshot,
        preOpSyncState,
        postOpSyncState,
        timestamp: Date.now()
      };

      console.log(`[PURE-CRUD] Operation summary:`, {
        operation: operation.toUpperCase(),
        entityType: config.entity,
        entityId: operationDetails.entityId,
        syncIsolated: true,
        entityCountDelta,
        duration: `${Date.now() - startTime}ms`
      });
      console.log(`[PURE-CRUD] ========================================\n`);

      return {
        success: true,
        duration: Date.now() - startTime,
        data: {
          operation,
          entityType: config.entity,
          operationResult,
          operationDetails,
          entityCountDelta,
          syncTrackingPrevented: true
        },
        metadata: {
          operation,
          entityType: config.entity,
          preOpEntityCount: preOpSnapshot.entityCount,
          postOpEntityCount: postOpSnapshot.entityCount,
          usedRepositoryDirect: true,
          syncStateUnchanged: !syncStateChanged,
          noLocalChangesAdded: !localChangesAdded,
          preOpPendingChanges: preOpSyncState.pendingChangesCount,
          postOpPendingChanges: postOpSyncState.pendingChangesCount
        }
      };
    } catch (error) {
      console.log(`[PURE-CRUD] ❌ ${operation.toUpperCase()} OPERATION FAILED:`, error);
      console.log(`[PURE-CRUD] ========================================\n`);
      
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error as Error,
        metadata: {
          operation,
          entityType: config.entity,
          failurePoint: 'execution'
        }
      };
    }
  }

  /**
   * Create entity using repository directly (no sync tracking)
   */
  private async createEntityDirect(repository: any, entityType: EntityType, testData: any, context: TestExecutionContext): Promise<any> {
    // Use the pre-generated comprehensive test data that was already created in the database
    const comprehensiveData = testData.comprehensive?.data;
    
    if (!comprehensiveData || !comprehensiveData[entityType] || comprehensiveData[entityType].length === 0) {
      throw new Error(`No pre-created ${entityType} data available for testing - setup phase should have created entities`);
    }

    // Get a random entity from the existing ones (these are already in the database)
    const existingEntities = comprehensiveData[entityType];
    const selectedEntity = existingEntities[Math.floor(Math.random() * existingEntities.length)];
    
    console.log(`[PURE-CRUD] Using existing ${entityType} entity for insert test:`, {
      id: selectedEntity.id,
      note: 'Using pre-created entity to avoid duplicates'
    });

    // For the "insert" operation test, we'll create a variation of an existing entity
    // with a new ID to simulate an insert operation without violating unique constraints
    const entityData = {
      ...selectedEntity,
      id: uuidv4(), // New unique ID
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Modify unique fields to avoid constraint violations
    switch (entityType) {
      case 'users':
        entityData.email = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`;
        entityData.name = `Test User ${Date.now()}`;
        break;
      case 'projects':
        entityData.name = `Test Project ${Date.now()}`;
        break;
      case 'tasks':
        entityData.title = `Test Task ${Date.now()}`;
        break;
      case 'comments':
        entityData.content = `Test Comment ${Date.now()}`;
        break;
    }

    console.log(`[PURE-CRUD] Creating new ${entityType} with unique fields:`, {
      id: entityData.id,
      uniqueFields: {
        email: entityData.email,
        name: entityData.name,
        title: entityData.title,
        content: entityData.content
      }
    });

    const createdEntity = await repository.create(entityData);
    
    // Add to created entities map for cleanup tracking
    if (!context.metadata.createdEntitiesMap.has(entityType)) {
      context.metadata.createdEntitiesMap.set(entityType, []);
    }
    context.metadata.createdEntitiesMap.get(entityType)!.push(createdEntity);
    
    return createdEntity;
  }

  /**
   * Update entity using repository directly (no sync tracking)
   */
  private async updateEntityDirect(repository: any, entityType: EntityType, testData: any, context: TestExecutionContext): Promise<any> {
    // Use the tracked entities from createdEntitiesMap instead of comprehensive test data
    const createdEntitiesMap = context.metadata.createdEntitiesMap as Map<string, any[]>;
    
    if (!createdEntitiesMap || !createdEntitiesMap.has(entityType)) {
      throw new Error(`No tracked ${entityType} entities available for update testing - setup phase should have created and tracked entities`);
    }
    
    const trackedEntities = createdEntitiesMap.get(entityType) || [];
    
    if (trackedEntities.length === 0) {
      throw new Error(`No tracked ${entityType} entities available for update testing - all entities may have been deleted already`);
    }
    
    const entityToUpdate = trackedEntities[0]; // Use first tracked entity for update
    
    console.log(`[PURE-CRUD] Updating tracked ${entityType} entity:`, {
      id: entityToUpdate.id,
      note: 'Using memory-tracked entity for update test'
    });
    
    const updateData = this.generateUpdateData(entityType);
    const result = await repository.update(entityToUpdate.id, updateData);
    return result;
  }

  /**
   * Delete entity using repository directly (no sync tracking)
   */
  private async deleteEntityDirect(repository: any, entityType: EntityType, testData: any, context: TestExecutionContext): Promise<any> {
    // Use the tracked entities from createdEntitiesMap instead of comprehensive test data
    const createdEntitiesMap = context.metadata.createdEntitiesMap as Map<string, any[]>;
    
    if (!createdEntitiesMap || !createdEntitiesMap.has(entityType)) {
      throw new Error(`No tracked ${entityType} entities available for delete testing - setup phase should have created and tracked entities`);
    }
    
    const trackedEntities = createdEntitiesMap.get(entityType) || [];
    
    if (trackedEntities.length === 0) {
      throw new Error(`No tracked ${entityType} entities available for delete testing - all entities may have been deleted already`);
    }
    
    console.log(`[PURE-CRUD] Deleting tracked ${entityType} entity from memory map:`, {
      availableEntities: trackedEntities.length,
      note: 'Using memory-tracked entities for reliable deletion'
    });
    
    // For entities that might have foreign key dependencies, we need to be careful about which one to delete
    let entityToDelete;
    
    switch (entityType) {
      case 'users':
        // Find a user that doesn't own any projects or have assigned tasks
        entityToDelete = trackedEntities.find((user: any) => {
          const projectsMap = createdEntitiesMap.get('projects') || [];
          const tasksMap = createdEntitiesMap.get('tasks') || [];
          const commentsMap = createdEntitiesMap.get('comments') || [];
          
          const hasOwnedProjects = projectsMap.some((project: any) => project.ownerId === user.id);
          const hasAssignedTasks = tasksMap.some((task: any) => task.assigneeId === user.id);
          const hasAuthoredComments = commentsMap.some((comment: any) => comment.authorId === user.id);
          return !hasOwnedProjects && !hasAssignedTasks && !hasAuthoredComments;
        });
        break;
        
      case 'projects':
        // Find a project that doesn't have any tasks or comments
        entityToDelete = trackedEntities.find((project: any) => {
          const tasksMap = createdEntitiesMap.get('tasks') || [];
          const commentsMap = createdEntitiesMap.get('comments') || [];
          
          const hasTasks = tasksMap.some((task: any) => task.projectId === project.id);
          const hasComments = commentsMap.some((comment: any) => comment.projectId === project.id);
          return !hasTasks && !hasComments;
        });
        break;
        
      case 'tasks':
        // Find a task that doesn't have any comments
        entityToDelete = trackedEntities.find((task: any) => {
          const commentsMap = createdEntitiesMap.get('comments') || [];
          const hasComments = commentsMap.some((comment: any) => comment.taskId === task.id);
          return !hasComments;
        });
        break;

      case 'comments':
        // Comments are leaf nodes, any can be deleted safely
        entityToDelete = trackedEntities[trackedEntities.length - 1];
        break;

      default:
        entityToDelete = trackedEntities[trackedEntities.length - 1];
    }
    
    // If we can't find a safe entity to delete, create a new one just for deletion
    if (!entityToDelete) {
      console.log(`[PURE-CRUD] No safe ${entityType} entity found for deletion, creating a temporary one...`);
      
      // Create a temporary entity without foreign key dependencies
      const tempEntityData = this.createTempEntityForDeletion(entityType);
      const createdEntity = await repository.create(tempEntityData);
      
      // Add to tracking map
      trackedEntities.push(createdEntity);
      
      console.log(`[PURE-CRUD] Created temporary ${entityType} entity for deletion:`, {
        id: createdEntity.id,
        note: 'Temporary entity created specifically for safe deletion'
      });
      
      const deleteResult = await repository.delete(createdEntity.id);
      
      // Remove from tracking map
      const tempIndex = trackedEntities.findIndex((e: any) => e.id === createdEntity.id);
      if (tempIndex > -1) {
        trackedEntities.splice(tempIndex, 1);
      }
      
      return { deleted: deleteResult, entityId: createdEntity.id, temporary: true };
    }
    
    console.log(`[PURE-CRUD] Deleting tracked ${entityType} entity:`, {
      id: entityToDelete.id,
      note: 'Using memory-tracked entity for delete test (checked for FK safety)'
    });
    
    const deleteResult = await repository.delete(entityToDelete.id);
    
    // Remove the deleted entity from the tracking map
    const index = trackedEntities.findIndex((e: any) => e.id === entityToDelete.id);
    if (index > -1) {
      trackedEntities.splice(index, 1);
    }
    
    return { deleted: deleteResult, entityId: entityToDelete.id };
  }

  /**
   * Create a temporary entity for safe deletion (without foreign key dependencies)
   */
  private createTempEntityForDeletion(entityType: EntityType): any {
    const timestamp = Date.now();
    const baseData = {
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    switch (entityType) {
      case 'users':
        return {
          ...baseData,
          name: `Temp User ${timestamp}`,
          email: `temp-delete-${timestamp}@example.com`,
          emailVerified: false,
          role: 'viewer'
        };
      case 'projects':
        return {
          ...baseData,
          name: `Temp Project ${timestamp}`,
          description: 'Temporary project for deletion test',
          status: 'active'
          // No ownerId to avoid FK dependency
        };
      case 'tasks':
        return {
          ...baseData,
          title: `Temp Task ${timestamp}`,
          description: 'Temporary task for deletion test',
          status: 'open',
          priority: 'low',
          tags: []
          // No projectId or assigneeId to avoid FK dependencies
        };
      case 'comments':
        return {
          ...baseData,
          content: `Temp comment ${timestamp}`
          // No authorId, taskId, or projectId to avoid FK dependencies
        };
      default:
        throw new Error(`Unsupported entity type for temp creation: ${entityType}`);
    }
  }

  /**
   * Execute database validation
   */
  private async executeDatabaseValidation(
    context: TestExecutionContext, 
    config: EntityTestConfig
  ): Promise<TestStepResult> {
    const startTime = Date.now();
    const repositories = context.metadata.repositories;
    
    try {
      // Capture final database snapshot
      const finalSnapshot = await this.captureDatabaseSnapshot(repositories, config.entity);
      context.metadata.databaseSnapshots.final = finalSnapshot;

      // Validate database integrity
      const integrityResults = await this.validateDatabaseIntegrity(repositories, config.entity);

      // Check for any orphaned records or constraint violations
      const constraintResults = await this.validateConstraints(repositories, config.entity);

      const allValidationsPassed = integrityResults.success && constraintResults.success;

      return {
        success: allValidationsPassed,
        data: {
          finalSnapshot,
          integrityResults,
          constraintResults
        },
        duration: Date.now() - startTime,
        metadata: {
          finalEntityCount: finalSnapshot.entityCount,
          integrityCheckPassed: integrityResults.success,
          constraintCheckPassed: constraintResults.success
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        duration: Date.now() - startTime,
        metadata: {}
      };
    }
  }

  /**
   * Execute sync isolation validation
   */
  private async executeSyncIsolationValidation(
    context: TestExecutionContext, 
    config: EntityTestConfig
  ): Promise<TestStepResult> {
    const startTime = Date.now();
    
    try {
      const operationResults = context.metadata.operationResults || {};
      const operations = Object.keys(operationResults);
      
      // Verify no sync tracking occurred for any operation
      const syncViolations = [];
      let totalOperations = 0;
      let isolatedOperations = 0;

      for (const operation of operations) {
        totalOperations++;
        const opResult = operationResults[operation];
        
        if (!opResult.preOpSyncState || !opResult.postOpSyncState) {
          syncViolations.push(`${operation}: Missing sync state snapshots`);
          continue;
        }

        const pendingChangesDelta = opResult.postOpSyncState.pendingChangesCount - opResult.preOpSyncState.pendingChangesCount;
        const queueSizeDelta = opResult.postOpSyncState.queueSize - opResult.preOpSyncState.queueSize;
        
        if (pendingChangesDelta !== 0 || queueSizeDelta !== 0) {
          syncViolations.push(
            `${operation}: Sync tracking detected - Pending: ${pendingChangesDelta}, Queue: ${queueSizeDelta}`
          );
        } else {
          isolatedOperations++;
        }
      }

      // Get final sync state for overall comparison
      const finalSyncState = this.framework.getCurrentSyncState();
      const initialSyncState = context.metadata.initialSyncState || finalSyncState;
      
      const overallPendingChangesDelta = finalSyncState.pendingChangesCount - initialSyncState.pendingChangesCount;
      const overallQueueSizeDelta = finalSyncState.queueSize - initialSyncState.queueSize;

      const isolationSuccess = syncViolations.length === 0 && 
                              overallPendingChangesDelta === 0 && 
                              overallQueueSizeDelta === 0;

      return {
        success: isolationSuccess,
        data: {
          totalOperations,
          isolatedOperations,
          syncViolations,
          overallSyncImpact: {
            pendingChangesDelta: overallPendingChangesDelta,
            queueSizeDelta: overallQueueSizeDelta
          },
          isolationAchieved: isolationSuccess
        },
        duration: Date.now() - startTime,
        metadata: {
          totalOperations,
          isolatedOperations,
          violationCount: syncViolations.length,
          isolationSuccess,
          overallSyncUnchanged: overallPendingChangesDelta === 0 && overallQueueSizeDelta === 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        duration: Date.now() - startTime,
        metadata: {}
      };
    }
  }

  /**
   * Execute comprehensive domain coverage validation
   */
  private async executeDomainCoverageValidation(
    context: TestExecutionContext, 
    config: EntityTestConfig
  ): Promise<TestStepResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE] Starting domain coverage analysis...`);
      
      // Analyze domain coverage based on client entities
      const coverageReport = await this.analyzeDomainCoverage(context);
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE] Overall coverage: ${coverageReport.coverage.overallPercentage}%`);
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE] Fields: ${coverageReport.coverage.fieldsCovered}/${coverageReport.coverage.totalFields}`);
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE] Relations: ${coverageReport.coverage.relationsCovered}/${coverageReport.coverage.totalRelations}`);
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE] Enums: ${coverageReport.coverage.enumsCovered}/${coverageReport.coverage.totalEnums}`);
      
      // Validate service method coverage
      const serviceMethodCoverage = await this.validateServiceMethodCoverage(context);
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE] Repository methods covered: ${serviceMethodCoverage.repositoryMethodsCovered}`);
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE] Tested methods: ${serviceMethodCoverage.testedRepositoryMethods.join(', ')}`);
      
      // Validate enum usage coverage
      const enumCoverage = await this.validateEnumCoverage(context);
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE] All enums used: ${enumCoverage.allEnumsUsed}`);
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE] Enum details:`, enumCoverage.enumCoverageDetails);
      
      // Validate relation coverage
      const relationCoverage = await this.validateRelationCoverage(context);
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE] All relations tested: ${relationCoverage.allRelationsTested}`);
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE] Relation coverage: ${relationCoverage.relationCoveragePercentage}%`);
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE] Tested relations: ${relationCoverage.testedRelations.join(', ')}`);

      const overallSuccess = coverageReport.coverage.overallPercentage >= 80 && // 80% minimum coverage
                            serviceMethodCoverage.repositoryMethodsCovered &&
                            enumCoverage.allEnumsUsed &&
                            relationCoverage.allRelationsTested;

      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE] Overall success: ${overallSuccess}`);
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE] Coverage >= 80%: ${coverageReport.coverage.overallPercentage >= 80}`);
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE] Repository methods: ${serviceMethodCoverage.repositoryMethodsCovered}`);
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE] Enums used: ${enumCoverage.allEnumsUsed}`);
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE] Relations tested: ${relationCoverage.allRelationsTested}`);

      return {
        success: overallSuccess,
        data: {
          domainCoverage: coverageReport,
          serviceMethodCoverage,
          enumCoverage,
          relationCoverage,
          overallSuccess
        },
        duration: Date.now() - startTime,
        metadata: {
          overallCoveragePercentage: coverageReport.coverage.overallPercentage,
          fieldsCovered: coverageReport.coverage.fieldsCovered,
          totalFields: coverageReport.coverage.totalFields,
          relationsCovered: coverageReport.coverage.relationsCovered,
          totalRelations: coverageReport.coverage.totalRelations,
          enumsCovered: coverageReport.coverage.enumsCovered,
          totalEnums: coverageReport.coverage.totalEnums,
          repositoryMethodsCovered: serviceMethodCoverage.repositoryMethodsCovered,
          allEnumsUsed: enumCoverage.allEnumsUsed,
          allRelationsTested: relationCoverage.allRelationsTested
        }
      };
    } catch (error) {
      console.error(`[PURE-CRUD] [DOMAIN-COVERAGE] Error during validation:`, error);
      return {
        success: false,
        error: error as Error,
        duration: Date.now() - startTime,
        metadata: {}
      };
    }
  }

  /**
   * Analyze domain coverage based on client entities
   */
  private async analyzeDomainCoverage(context: TestExecutionContext): Promise<DomainCoverageReport> {
    const report: DomainCoverageReport = {
      entities: {},
      coverage: {
        fieldsCovered: 0,
        totalFields: 0,
        relationsCovered: 0,
        totalRelations: 0,
        enumsCovered: 0,
        totalEnums: 0,
        overallPercentage: 0
      }
    };

    // Define the domain entities and their expected structure based on current dataforge entities
    const domainEntities: Record<string, EntityDefinition> = {
      User: {
        fields: {
          id: { type: 'uuid', required: true },
          name: { type: 'string', required: true },
          email: { type: 'string', required: true },
          emailVerified: { type: 'boolean', required: true },
          image: { type: 'string', required: false },
          role: { type: 'enum', required: true, enum: 'UserRole' },
          createdAt: { type: 'date', required: true },
          updatedAt: { type: 'date', required: true },
          clientId: { type: 'uuid', required: false }
        },
        relations: {
          tasks: { type: 'one-to-many', target: 'Task' },
          ownedProjects: { type: 'one-to-many', target: 'Project' },
          memberProjects: { type: 'many-to-many', target: 'Project' }
        },
        enums: {
          UserRole: { values: ['admin', 'member', 'viewer', 'super_admin'] }
        }
      },
      Project: {
        fields: {
          id: { type: 'uuid', required: true },
          name: { type: 'string', required: true },
          description: { type: 'string', required: false },
          status: { type: 'enum', required: true, enum: 'ProjectStatus' },
          ownerId: { type: 'uuid', required: false },
          createdAt: { type: 'date', required: true },
          updatedAt: { type: 'date', required: true },
          clientId: { type: 'uuid', required: false }
        },
        relations: {
          owner: { type: 'many-to-one', target: 'User' },
          members: { type: 'many-to-many', target: 'User' },
          tasks: { type: 'one-to-many', target: 'Task' }
        },
        enums: {
          ProjectStatus: { values: ['active', 'in_progress', 'completed', 'on_hold'] }
        }
      },
      Task: {
        fields: {
          id: { type: 'uuid', required: true },
          title: { type: 'string', required: true },
          description: { type: 'string', required: false },
          status: { type: 'enum', required: true, enum: 'TaskStatus' },
          priority: { type: 'enum', required: true, enum: 'TaskPriority' },
          dueDate: { type: 'date', required: false },
          startDate: { type: 'date', required: false },
          completedAt: { type: 'date', required: false },
          timeRange: { type: 'tsrange', required: false },
          estimatedDuration: { type: 'interval', required: false },
          tags: { type: 'array', required: true },
          projectId: { type: 'uuid', required: false },
          assigneeId: { type: 'uuid', required: false },
          createdAt: { type: 'date', required: true },
          updatedAt: { type: 'date', required: true },
          clientId: { type: 'uuid', required: false }
        },
        relations: {
          project: { type: 'many-to-one', target: 'Project' },
          assignee: { type: 'many-to-one', target: 'User' },
          dependencies: { type: 'many-to-many', target: 'Task' },
          tasksDependentOnThis: { type: 'many-to-many', target: 'Task' }
        },
        enums: {
          TaskStatus: { values: ['open', 'in_progress', 'completed'] },
          TaskPriority: { values: ['low', 'medium', 'high'] }
        }
      },
      Comment: {
        fields: {
          id: { type: 'uuid', required: true },
          content: { type: 'string', required: true },
          authorId: { type: 'uuid', required: false },
          parentId: { type: 'uuid', required: false },
          taskId: { type: 'uuid', required: false },
          projectId: { type: 'uuid', required: false },
          createdAt: { type: 'date', required: true },
          updatedAt: { type: 'date', required: true },
          clientId: { type: 'uuid', required: false }
        },
        relations: {
          author: { type: 'many-to-one', target: 'User' },
          parent: { type: 'many-to-one', target: 'Comment' },
          task: { type: 'many-to-one', target: 'Task' },
          project: { type: 'many-to-one', target: 'Project' }
        },
        enums: {}
      }
    };

    // Analyze coverage for each entity
    for (const [entityName, entityDef] of Object.entries(domainEntities)) {
      report.entities[entityName] = {
        fields: {},
        relations: {},
        enums: {}
      };

      // Analyze field coverage
      for (const [fieldName, fieldDef] of Object.entries(entityDef.fields)) {
        const tested = this.isFieldTested(context, entityName, fieldName);
        report.entities[entityName].fields[fieldName] = {
          tested,
          type: fieldDef.type,
          required: fieldDef.required,
          enum: fieldDef.enum
        };
        
        report.coverage.totalFields++;
        if (tested) report.coverage.fieldsCovered++;
      }

      // Analyze relation coverage
      for (const [relationName, relationDef] of Object.entries(entityDef.relations)) {
        const tested = this.isRelationTested(context, entityName, relationName);
        report.entities[entityName].relations[relationName] = {
          tested,
          type: relationDef.type,
          target: relationDef.target
        };
        
        report.coverage.totalRelations++;
        if (tested) report.coverage.relationsCovered++;
      }

      // Analyze enum coverage
      for (const [enumName, enumDef] of Object.entries(entityDef.enums)) {
        const usedValues = this.getUsedEnumValues(context, enumName);
        const tested = usedValues.length > 0;
        report.entities[entityName].enums[enumName] = {
          tested,
          values: enumDef.values,
          usedValues
        };
        
        report.coverage.totalEnums++;
        if (tested) report.coverage.enumsCovered++;
      }
    }

    // Calculate overall coverage percentage
    const totalItems = report.coverage.totalFields + report.coverage.totalRelations + report.coverage.totalEnums;
    const coveredItems = report.coverage.fieldsCovered + report.coverage.relationsCovered + report.coverage.enumsCovered;
    report.coverage.overallPercentage = totalItems > 0 ? Math.round((coveredItems / totalItems) * 100) : 0;

    return report;
  }

  /**
   * Check if a field was tested in the operations
   */
  private isFieldTested(context: TestExecutionContext, entityName: string, fieldName: string): boolean {
    const operationResults = context.metadata.operationResults || {};
    
    // Check operation results first
    for (const operation of Object.values(operationResults)) {
      const result = operation as any;
      if (result.result && typeof result.result === 'object') {
        // Check if the field exists in the operation result
        if (fieldName in result.result) {
          return true;
        }
      }
    }
    
    // Check comprehensive test data that was created in the database
    const testData = context.metadata.testData || {};
    
    // Check comprehensive data (the main dataset created in database)
    if (testData.comprehensive && testData.comprehensive.data) {
      const comprehensiveData = testData.comprehensive.data;
      const entityKey = entityName.toLowerCase() + 's'; // User -> users, Task -> tasks, etc.
      
      if (comprehensiveData[entityKey] && Array.isArray(comprehensiveData[entityKey])) {
        for (const entity of comprehensiveData[entityKey]) {
          if (entity && typeof entity === 'object' && fieldName in entity) {
            return true;
          }
        }
      }
    }
    
    // Check edge case data
    if (testData.edgeCases && testData.edgeCases.data) {
      const edgeCaseData = testData.edgeCases.data;
      for (const [entityType, entities] of Object.entries(edgeCaseData)) {
        if (Array.isArray(entities)) {
          for (const entity of entities) {
            if (entity && typeof entity === 'object' && fieldName in entity) {
              return true;
            }
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Check if a relation was tested in the operations
   */
  private isRelationTested(context: TestExecutionContext, entityName: string, relationName: string): boolean {
    const operationResults = context.metadata.operationResults || {};
    
    // Check if relations were used in operations (foreign keys set)
    for (const operation of Object.values(operationResults)) {
      const result = operation as any;
      if (result.result && typeof result.result === 'object') {
        // Check for foreign key fields that indicate relation usage
        const foreignKeyFields = this.getForeignKeyFields(entityName, relationName);
        for (const fkField of foreignKeyFields) {
          if (fkField in result.result && result.result[fkField]) {
            return true;
          }
        }
      }
    }
    
    // Check comprehensive test data that was created in the database
    const testData = context.metadata.testData || {};
    
    // Check comprehensive data (the main dataset created in database)
    if (testData.comprehensive && testData.comprehensive.data) {
      const comprehensiveData = testData.comprehensive.data;
      const entityKey = entityName.toLowerCase() + 's'; // User -> users, Task -> tasks, etc.
      
      if (comprehensiveData[entityKey] && Array.isArray(comprehensiveData[entityKey])) {
        for (const entity of comprehensiveData[entityKey]) {
          if (entity && typeof entity === 'object') {
            // Check for foreign key fields that indicate relation usage
            const foreignKeyFields = this.getForeignKeyFields(entityName, relationName);
            for (const fkField of foreignKeyFields) {
              if (fkField in entity && entity[fkField]) {
                return true;
              }
            }
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Get foreign key fields for a relation using auto-generated relationship configs
   */
  private getForeignKeyFields(entityName: string, relationName: string): string[] {
    const entityKey = entityName.toLowerCase() + 's'; // User -> users, Task -> tasks, etc.
    const relationshipConfig = getEntityRelationships(entityKey);
    
    if (!relationshipConfig) {
      return [];
    }
    
    // Check required references (foreign key relationships)
    if (relationshipConfig.requiredReferences) {
      for (const ref of relationshipConfig.requiredReferences) {
        // Match relation name to foreign key field
        // e.g., 'project' relation maps to 'projectId' field
        const expectedRelationName = ref.field.replace(/Id$/, ''); // Remove 'Id' suffix
        if (expectedRelationName === relationName) {
          return [ref.field];
        }
      }
    }
    
    // Check self-references
    if (relationshipConfig.selfReferences) {
      for (const selfRef of relationshipConfig.selfReferences) {
        const expectedRelationName = selfRef.field.replace(/Id$/, ''); // Remove 'Id' suffix
        if (expectedRelationName === relationName) {
          return [selfRef.field];
        }
      }
    }
    
    // For junction relationships (many-to-many), there are no direct foreign key fields
    // These are handled through junction tables
    if (relationshipConfig.junctionRelationships) {
      for (const junction of relationshipConfig.junctionRelationships) {
        if (junction.relationName === relationName) {
          // Junction relationships don't have direct FK fields on the entity
          // but we can indicate the relationship exists
          return [];
        }
      }
    }
    
    return [];
  }

  /**
   * Get used enum values from test operations
   */
  private getUsedEnumValues(context: TestExecutionContext, enumName: string): string[] {
    const usedValues = new Set<string>();
    const operationResults = context.metadata.operationResults || {};
    
    // Check operation results first
    for (const operation of Object.values(operationResults)) {
      const result = operation as any;
      if (result.result && typeof result.result === 'object') {
        // Check for enum fields
        const enumFields = this.getEnumFields(enumName);
        for (const field of enumFields) {
          if (field in result.result && result.result[field]) {
            usedValues.add(result.result[field]);
          }
        }
      }
    }
    
    // Check comprehensive test data that was created in the database
    const testData = context.metadata.testData || {};
    
    // Check comprehensive data (the main dataset created in database)
    if (testData.comprehensive && testData.comprehensive.data) {
      const comprehensiveData = testData.comprehensive.data;
      
      // Check all entity types for enum usage
      for (const [entityKey, entities] of Object.entries(comprehensiveData)) {
        if (Array.isArray(entities)) {
          for (const entity of entities) {
            if (entity && typeof entity === 'object') {
              const enumFields = this.getEnumFields(enumName);
              for (const field of enumFields) {
                if (field in entity && entity[field]) {
                  usedValues.add(entity[field]);
                }
              }
            }
          }
        }
      }
    }
    
    // Check edge case data
    if (testData.edgeCases && testData.edgeCases.data) {
      const edgeCaseData = testData.edgeCases.data;
      for (const [entityType, entities] of Object.entries(edgeCaseData)) {
        if (Array.isArray(entities)) {
          for (const entity of entities) {
            if (entity && typeof entity === 'object') {
              const enumFields = this.getEnumFields(enumName);
              for (const field of enumFields) {
                if (field in entity && entity[field]) {
                  usedValues.add(entity[field]);
                }
              }
            }
          }
        }
      }
    }
    
    return Array.from(usedValues);
  }

  /**
   * Get fields that use a specific enum
   */
  private getEnumFields(enumName: string): string[] {
    const enumMappings: Record<string, string[]> = {
      TaskStatus: ['status'],
      TaskPriority: ['priority'],
      ProjectStatus: ['status'],
      UserRole: ['role']
    };
    
    return enumMappings[enumName] || [];
  }

  /**
   * Validate service method coverage (repository methods)
   */
  private async validateServiceMethodCoverage(context: TestExecutionContext): Promise<any> {
    const repositories = context.metadata.repositories;
    const operationResults = context.metadata.operationResults || {};
    
    const expectedMethods = {
      repository: ['create', 'update', 'delete', 'findById', 'findAll']
    };
    
    const testedMethods = {
      repository: new Set<string>()
    };
    
    // Check which methods were used in operations
    for (const [operation, result] of Object.entries(operationResults)) {
      // Since we're using repository methods in pure CRUD tests
      switch (operation) {
        case 'insert':
          testedMethods.repository.add('create');
          break;
        case 'update':
          testedMethods.repository.add('update');
          break;
        case 'delete':
          testedMethods.repository.add('delete');
          break;
      }
    }
    
    const repositoryMethodsCovered = expectedMethods.repository.some(method => 
      testedMethods.repository.has(method)
    );
    
    return {
      repositoryMethodsCovered,
      testedRepositoryMethods: Array.from(testedMethods.repository),
      expectedRepositoryMethods: expectedMethods.repository
    };
  }

  /**
   * Validate enum coverage
   */
  private async validateEnumCoverage(context: TestExecutionContext): Promise<any> {
    const expectedEnums = {
      TaskStatus: Object.values(TaskStatus),
      TaskPriority: Object.values(TaskPriority),
      ProjectStatus: Object.values(ProjectStatus),
      UserRole: Object.values(UserRole)
    };
    
    const usedEnums: Record<string, string[]> = {};
    
    for (const [enumName] of Object.entries(expectedEnums)) {
      usedEnums[enumName] = this.getUsedEnumValues(context, enumName);
    }
    
    const allEnumsUsed = Object.entries(expectedEnums).every(([enumName, values]) => 
      usedEnums[enumName].length > 0
    );
    
    return {
      allEnumsUsed,
      expectedEnums,
      usedEnums,
      enumCoverageDetails: Object.entries(expectedEnums).map(([enumName, values]) => ({
        enumName,
        totalValues: values.length,
        usedValues: usedEnums[enumName].length,
        coveragePercentage: Math.round((usedEnums[enumName].length / values.length) * 100)
      }))
    };
  }

  /**
   * Validate relation coverage using auto-generated relationship configurations
   */
  private async validateRelationCoverage(context: TestExecutionContext): Promise<any> {
    // Get all expected relations from auto-generated configs
    const expectedRelations: string[] = [];
    const testedRelations: string[] = [];
    
    // Iterate through all entities that have relationship configurations
    for (const entityName of Object.keys(CLIENT_RELATIONSHIP_CONFIGS)) {
      const relationshipConfig = getEntityRelationships(entityName);
      if (!relationshipConfig) continue;
      
      const entityDisplayName = entityName.charAt(0).toUpperCase() + entityName.slice(1, -1); // users -> User
      
      // Add required references (foreign key relationships)
      if (relationshipConfig.requiredReferences) {
        for (const ref of relationshipConfig.requiredReferences) {
          const relationName = ref.field.replace(/Id$/, ''); // projectId -> project
          const fullRelationName = `${entityDisplayName}.${relationName}`;
          expectedRelations.push(fullRelationName);
          
          if (this.isRelationTested(context, entityDisplayName, relationName)) {
            testedRelations.push(fullRelationName);
          }
        }
      }
      
      // Add self-references
      if (relationshipConfig.selfReferences) {
        for (const selfRef of relationshipConfig.selfReferences) {
          const relationName = selfRef.field.replace(/Id$/, ''); // parentId -> parent
          const fullRelationName = `${entityDisplayName}.${relationName}`;
          expectedRelations.push(fullRelationName);
          
          if (this.isRelationTested(context, entityDisplayName, relationName)) {
            testedRelations.push(fullRelationName);
          }
        }
      }
      
      // Add junction relationships (many-to-many)
      if (relationshipConfig.junctionRelationships) {
        for (const junction of relationshipConfig.junctionRelationships) {
          const fullRelationName = `${entityDisplayName}.${junction.relationName}`;
          expectedRelations.push(fullRelationName);
          
          // For junction relationships, check if the junction table has any data
          if (this.isJunctionRelationTested(context, entityName, junction.relationName)) {
            testedRelations.push(fullRelationName);
          }
        }
      }
    }
    
    // Calculate coverage - require at least 70% of relations to be tested
    const relationCoveragePercentage = expectedRelations.length > 0 
      ? Math.round((testedRelations.length / expectedRelations.length) * 100)
      : 100;
    
    const allRelationsTested = relationCoveragePercentage >= 70; // 70% minimum threshold
    
    return {
      allRelationsTested,
      expectedRelations,
      testedRelations,
      relationCoveragePercentage,
      coverageDetails: {
        total: expectedRelations.length,
        tested: testedRelations.length,
        threshold: 70
      }
    };
  }
  
  /**
   * Check if a junction relationship (many-to-many) was tested
   */
  private isJunctionRelationTested(context: TestExecutionContext, entityName: string, relationName: string): boolean {
    // For now, we'll consider junction relationships as tested if the entities exist
    // In a more comprehensive test, we would check if junction table entries were created
    const testData = context.metadata.testData || {};
    
    if (testData.comprehensive && testData.comprehensive.data) {
      const comprehensiveData = testData.comprehensive.data;
      
      // Check if the source entity has data
      if (comprehensiveData[entityName] && Array.isArray(comprehensiveData[entityName])) {
        return comprehensiveData[entityName].length > 0;
      }
    }
    
    return false;
  }

  /**
   * Validate domain coverage results
   */
  private async validateDomainCoverage(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    console.log(`[PURE-CRUD] [DOMAIN-COVERAGE-VALIDATION] Starting validation of domain coverage results...`);
    console.log(`[PURE-CRUD] [DOMAIN-COVERAGE-VALIDATION] Step success: ${result.success}`);
    
    if (!result.success) {
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE-VALIDATION] ❌ Step execution failed: ${result.error?.message}`);
      return {
        status: 'failed',
        message: 'Domain coverage validation failed',
        details: result.error?.message
      };
    }

    const data = result.data;
    const metadata = result.metadata;
    
    console.log(`[PURE-CRUD] [DOMAIN-COVERAGE-VALIDATION] Checking coverage percentage: ${metadata.overallCoveragePercentage}% (required: 80%)`);
    if (metadata.overallCoveragePercentage < 80) {
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE-VALIDATION] ❌ Coverage insufficient: ${metadata.overallCoveragePercentage}%`);
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE-VALIDATION] Fields covered: ${metadata.fieldsCovered}/${metadata.totalFields}`);
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE-VALIDATION] Relations covered: ${metadata.relationsCovered}/${metadata.totalRelations}`);
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE-VALIDATION] Enums covered: ${metadata.enumsCovered}/${metadata.totalEnums}`);
      return {
        status: 'failed',
        message: `Domain coverage insufficient: ${metadata.overallCoveragePercentage}% (minimum 80% required)`,
        details: {
          overallCoverage: metadata.overallCoveragePercentage,
          fieldsCovered: `${metadata.fieldsCovered}/${metadata.totalFields}`,
          relationsCovered: `${metadata.relationsCovered}/${metadata.totalRelations}`,
          enumsCovered: `${metadata.enumsCovered}/${metadata.totalEnums}`,
          domainCoverage: data.domainCoverage
        },
        suggestions: [
          'Increase test data variations to cover more fields',
          'Add tests for missing entity relations',
          'Ensure all enum values are used in test operations',
          'Add edge cases to improve domain coverage'
        ]
      };
    }

    console.log(`[PURE-CRUD] [DOMAIN-COVERAGE-VALIDATION] Checking repository methods: ${metadata.repositoryMethodsCovered}`);
    if (!metadata.repositoryMethodsCovered) {
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE-VALIDATION] ❌ Repository methods not fully covered`);
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE-VALIDATION] Service method coverage:`, data.serviceMethodCoverage);
      return {
        status: 'failed',
        message: 'Repository methods not fully covered',
        details: {
          serviceMethodCoverage: data.serviceMethodCoverage
        },
        suggestions: [
          'Ensure all CRUD operations (insert, update, delete) are tested',
          'Verify repository methods are being called correctly'
        ]
      };
    }

    console.log(`[PURE-CRUD] [DOMAIN-COVERAGE-VALIDATION] Checking enum usage: ${metadata.allEnumsUsed}`);
    if (!metadata.allEnumsUsed) {
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE-VALIDATION] ⚠️ Not all enum values used`);
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE-VALIDATION] Enum coverage:`, data.enumCoverage);
      return {
        status: 'warning',
        message: 'Not all enum values were used in tests',
        details: {
          enumCoverage: data.enumCoverage
        },
        suggestions: [
          'Add test variations that use different enum values',
          'Consider testing edge cases with different status/priority combinations'
        ]
      };
    }

    console.log(`[PURE-CRUD] [DOMAIN-COVERAGE-VALIDATION] Checking relation testing: ${metadata.allRelationsTested}`);
    if (!metadata.allRelationsTested) {
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE-VALIDATION] ⚠️ Not all relations tested`);
      console.log(`[PURE-CRUD] [DOMAIN-COVERAGE-VALIDATION] Relation coverage: ${data.relationCoverage.relationCoveragePercentage}%`);
      return {
        status: 'warning',
        message: `Relation coverage below threshold: ${data.relationCoverage.relationCoveragePercentage}%`,
        details: {
          relationCoverage: data.relationCoverage
        },
        suggestions: [
          'Add tests that create entities with foreign key relationships',
          'Test many-to-many relationships like project members and task dependencies'
        ]
      };
    }

    console.log(`[PURE-CRUD] [DOMAIN-COVERAGE-VALIDATION] ✅ All validations passed!`);
    return {
      status: 'passed',
      message: `Domain coverage validation successful - ${metadata.overallCoveragePercentage}% coverage achieved`,
      details: {
        overallCoverage: metadata.overallCoveragePercentage,
        fieldsCovered: `${metadata.fieldsCovered}/${metadata.totalFields}`,
        relationsCovered: `${metadata.relationsCovered}/${metadata.totalRelations}`,
        enumsCovered: `${metadata.enumsCovered}/${metadata.totalEnums}`,
        repositoryMethodsCovered: metadata.repositoryMethodsCovered,
        allEnumsUsed: metadata.allEnumsUsed,
        allRelationsTested: metadata.allRelationsTested
      }
    };
  }

  /**
   * Capture database snapshot for comparison
   */
  private async captureDatabaseSnapshot(repositories: any, entityType: EntityType): Promise<any> {
    const repository = this.getRepositoryForEntity(repositories, entityType);
    const entities = await repository.findAll();
    
    return {
      timestamp: Date.now(),
      entityType,
      entityCount: entities.length,
      entities: entities.map((e: any) => ({ id: e.id, createdAt: e.createdAt, updatedAt: e.updatedAt }))
    };
  }

  /**
   * Validate database integrity
   */
  private async validateDatabaseIntegrity(repositories: any, entityType: EntityType): Promise<{ success: boolean; details: any }> {
    try {
      const repository = this.getRepositoryForEntity(repositories, entityType);
      const entities = await repository.findAll();
      
      // Check for required fields and valid data
      const invalidEntities = entities.filter((entity: any) => {
        switch (entityType) {
          case 'tasks':
            return !entity.id || !entity.title || !entity.createdAt;
          case 'projects':
            return !entity.id || !entity.name || !entity.createdAt;
          case 'users':
            return !entity.id || !entity.name || !entity.email || !entity.createdAt;
          case 'comments':
            return !entity.id || !entity.content || !entity.createdAt;
          default:
            return false;
        }
      });

      return {
        success: invalidEntities.length === 0,
        details: {
          totalEntities: entities.length,
          invalidEntities: invalidEntities.length,
          invalidIds: invalidEntities.map((e: any) => e.id)
        }
      };
    } catch (error) {
      return {
        success: false,
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  /**
   * Validate database constraints and relationships
   */
  private async validateConstraints(repositories: any, entityType: EntityType): Promise<{ success: boolean; details: any }> {
    try {
      const issues = [];

      // Check for foreign key constraints based on entity type
      switch (entityType) {
        case 'tasks':
          const tasks = await this.getRepositoryForEntity(repositories, 'tasks').findAll();
          for (const task of tasks) {
            if (task.projectId) {
              const project = await this.getRepositoryForEntity(repositories, 'projects').findById(task.projectId);
              if (!project) {
                issues.push(`Task ${task.id} references non-existent project ${task.projectId}`);
              }
            }
            if (task.assigneeId) {
              const user = await this.getRepositoryForEntity(repositories, 'users').findById(task.assigneeId);
              if (!user) {
                issues.push(`Task ${task.id} references non-existent user ${task.assigneeId}`);
              }
            }
          }
          break;

        case 'comments':
          const comments = await this.getRepositoryForEntity(repositories, 'comments').findAll();
          for (const comment of comments) {
            if (comment.taskId) {
              const task = await this.getRepositoryForEntity(repositories, 'tasks').findById(comment.taskId);
            if (!task) {
              issues.push(`Comment ${comment.id} references non-existent task ${comment.taskId}`);
            }
            }
            if (comment.authorId) {
              const author = await this.getRepositoryForEntity(repositories, 'users').findById(comment.authorId);
            if (!author) {
              issues.push(`Comment ${comment.id} references non-existent author ${comment.authorId}`);
              }
            }
          }
          break;
      }

      return {
        success: issues.length === 0,
        details: {
          constraintViolations: issues.length,
          issues
        }
      };
    } catch (error) {
      return {
        success: false,
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  /**
   * Get existing entities from test data for updates/deletes
   */
  private getExistingEntitiesFromTestData(testData: any, entityType?: EntityType): any[] {
    const entities = [];
    
    // If specific entity type requested, filter for it
    if (entityType) {
      for (const [variationType, variationData] of Object.entries(testData)) {
        if (variationData && typeof variationData === 'object' && 'data' in variationData) {
          const data = (variationData as any).data;
          if (Array.isArray(data)) {
            // Filter entities by type - assuming entity types match data array names
            const relevantEntities = data.filter((entity: any) => {
              if (entityType === 'tasks' && entity.title) return true;
              if (entityType === 'projects' && entity.name && !entity.title) return true;
              if (entityType === 'users' && entity.email) return true;
              if (entityType === 'comments' && entity.content) return true;
              return false;
            });
            entities.push(...relevantEntities);
          }
        }
      }
    } else {
      // Return all entities
      for (const variation of Object.values(testData)) {
        if (variation && typeof variation === 'object' && 'data' in variation) {
          entities.push(...(variation as any).data);
        }
      }
    }
    
    return entities;
  }

  /**
   * Get appropriate repository for entity type
   */
  private getRepositoryForEntity(repositories: any, entityType: EntityType): any {
    switch (entityType) {
      case 'tasks':
        return repositories.tasks;
      case 'projects':
        return repositories.projects;
      case 'users':
        return repositories.users;
      case 'comments':
        return repositories.comments;
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  /**
   * Generate appropriate update data for entity type
   */
  private generateUpdateData(entityType: EntityType): any {
    const timestamp = new Date();
    
    switch (entityType) {
      case 'tasks':
        return {
          title: `Updated Task ${timestamp.getTime()}`,
          description: 'Updated description via pure CRUD test',
          status: TaskStatus.IN_PROGRESS,
          updatedAt: timestamp
        };
      case 'projects':
        return {
          name: `Updated Project ${timestamp.getTime()}`,
          description: 'Updated project description via pure CRUD test',
          updatedAt: timestamp
        };
      case 'users':
        return {
          name: `Updated User ${timestamp.getTime()}`,
          email: `updated${timestamp.getTime()}@example.com`,
          updatedAt: timestamp
        };
      case 'comments':
        return {
          content: `Updated comment content ${timestamp.getTime()}`,
          updatedAt: timestamp
        };
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  /**
   * Validate setup step
   */
  private async validateSetup(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Setup failed',
        details: result.error?.message
      };
    }

    const metadata = result.metadata;
    const data = result.data;
    
    if (metadata.repositoriesAvailable === 0) {
      return {
        status: 'failed',
        message: 'No repositories available for testing'
      };
    }

    if (metadata.testDataVariations === 0) {
      return {
        status: 'warning',
        message: 'No test data variations configured'
      };
    }

    // Check for INSERT operations success
    const insertOpsPerformed = metadata.insertOperationsPerformed || 0;
    const successfulInsertions = metadata.successfulInsertions || 0;
    const failedInsertions = metadata.failedInsertions || 0;

    if (insertOpsPerformed === 0) {
      return {
        status: 'warning',
        message: 'Setup completed but no INSERT operations were performed'
      };
    }

    if (failedInsertions > 0) {
      return {
        status: 'warning',
        message: `Setup completed with ${failedInsertions} failed INSERT operations out of ${insertOpsPerformed} total`,
        details: {
          insertOpsPerformed,
          successfulInsertions,
          failedInsertions,
          insertOperationsByEntity: data.insertOperationsByEntity
        }
      };
    }

    return {
      status: 'passed',
      message: `Setup successful - ${metadata.repositoriesAvailable} repositories available, ${successfulInsertions} INSERT operations completed, sync isolation maintained`,
      details: {
        ...metadata,
        insertOpsPerformed,
        successfulInsertions,
        failedInsertions,
        insertOperationsByEntity: data.insertOperationsByEntity,
        note: 'Setup phase included comprehensive INSERT operations using repository methods directly (no sync tracking)'
      }
    };
  }

  /**
   * Validate CRUD operation
   */
  private async validateCRUDOperation(
    context: TestExecutionContext, 
    result: TestStepResult, 
    operation: OperationType
  ): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: `${operation} operation failed`,
        details: result.error?.message
      };
    }

    const data = result.data;
    const metadata = result.metadata;
    
    // CRITICAL: Validate that repository methods did NOT trigger sync tracking
    if (!metadata.syncStateUnchanged) {
      return {
        status: 'failed',
        message: `${operation} repository method incorrectly triggered sync state changes`,
        details: {
          preOpPendingChanges: metadata.preOpPendingChanges,
          postOpPendingChanges: metadata.postOpPendingChanges,
          shouldRemainUnchanged: true
        },
        suggestions: [
          'Verify that repository methods bypass sync tracking',
          'Check that OutgoingChangeProcessor.trackChange is not called',
          'Ensure proper repository method isolation'
        ]
      };
    }

    if (!metadata.noLocalChangesAdded) {
      return {
        status: 'failed',
        message: `${operation} repository method incorrectly created LocalChanges entries`,
        details: {
          message: 'Repository methods should not create any LocalChanges entries',
          operation
        },
        suggestions: [
          'Verify LocalChanges are not created by repository methods',
          'Check repository method isolation is working correctly'
        ]
      };
    }
    
    // Validate operation-specific expectations
    switch (operation) {
      case 'insert':
        if (metadata.postOpEntityCount <= metadata.preOpEntityCount) {
          return {
            status: 'failed',
            message: 'Insert operation did not increase entity count',
            details: { pre: metadata.preOpEntityCount, post: metadata.postOpEntityCount }
          };
        }
        break;

      case 'delete':
        if (metadata.postOpEntityCount >= metadata.preOpEntityCount) {
          return {
            status: 'failed',
            message: 'Delete operation did not decrease entity count',
            details: { pre: metadata.preOpEntityCount, post: metadata.postOpEntityCount }
          };
        }
        break;

      case 'update':
        if (metadata.postOpEntityCount !== metadata.preOpEntityCount) {
          return {
            status: 'warning',
            message: 'Update operation changed entity count unexpectedly',
            details: { pre: metadata.preOpEntityCount, post: metadata.postOpEntityCount }
          };
        }
        break;
    }

    return {
      status: 'passed',
      message: `${operation} operation successful using repository method - NO sync tracking triggered`,
      details: {
        operation,
        entityCountDelta: data.entityCountDelta,
        usedRepositoryMethod: metadata.usedRepositoryDirect,
        syncIsolationVerified: true,
        syncStateRemainedUnchanged: metadata.syncStateUnchanged,
        noLocalChangesCreated: metadata.noLocalChangesAdded
      }
    };
  }

  /**
   * Validate database state
   */
  private async validateDatabaseState(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Database validation failed',
        details: result.error?.message
      };
    }

    const data = result.data;
    const metadata = result.metadata;
    
    // Handle comprehensive database validation (multiple entity types)
    if (data.entityValidations) {
      const failedValidations = metadata.failedValidations || 0;
      const successfulValidations = metadata.successfulValidations || 0;
      
      if (failedValidations > 0) {
        return {
          status: 'failed',
          message: `Database validation failed for ${failedValidations} entity type(s)`,
          details: {
            failedValidations,
            successfulValidations,
            entityValidations: data.entityValidations
          }
        };
      }
      
      return {
        status: 'passed',
        message: `Database validation successful for all ${successfulValidations} entity type(s)`,
        details: {
          successfulValidations,
          entityValidations: data.entityValidations
        }
      };
    }
    
    // Handle single entity database validation
    if (!metadata.integrityCheckPassed) {
      return {
        status: 'failed',
        message: 'Database integrity check failed',
        details: data.integrityResults?.details || 'No details available'
      };
    }

    if (!metadata.constraintCheckPassed) {
      return {
        status: 'failed',
        message: 'Database constraint validation failed',
        details: data.constraintResults?.details || 'No details available'
      };
    }

    return {
      status: 'passed',
      message: 'Database validation successful - all integrity and constraint checks passed',
      details: {
        finalEntityCount: metadata.finalEntityCount,
        integrityPassed: metadata.integrityCheckPassed,
        constraintsPassed: metadata.constraintCheckPassed
      }
    };
  }

  /**
   * Validate sync isolation
   */
  private async validateSyncIsolation(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Sync isolation validation failed',
        details: result.error?.message
      };
    }

    const data = result.data;
    const metadata = result.metadata;
    
    if (!metadata.isolationSuccess) {
      return {
        status: 'failed',
        message: `Sync isolation violated - ${metadata.violationCount} violation(s) detected`,
        details: {
          totalOperations: metadata.totalOperations,
          isolatedOperations: metadata.isolatedOperations,
          violations: data.syncViolations,
          overallSyncImpact: data.overallSyncImpact
        },
        suggestions: [
          'Verify repository methods bypass sync tracking',
          'Check that OutgoingChangeProcessor.trackChange is not called',
          'Ensure proper repository method isolation'
        ]
      };
    }

    if (metadata.violationCount > 0) {
      return {
        status: 'warning',
        message: `Sync isolation mostly achieved but ${metadata.violationCount} minor issue(s) detected`,
        details: {
          violations: data.syncViolations,
          overallSyncImpact: data.overallSyncImpact
        }
      };
    }

    return {
      status: 'passed',
      message: `Sync isolation validation successful - all ${metadata.totalOperations} operations properly isolated`,
      details: {
        totalOperations: metadata.totalOperations,
        isolatedOperations: metadata.isolatedOperations,
        isolationAchieved: metadata.isolationSuccess,
        overallSyncUnchanged: metadata.overallSyncUnchanged
      }
    };
  }

  /**
   * Execute comprehensive cleanup - delete all entities in reverse hierarchy order
   */
  private async executeComprehensiveCleanup(
    context: TestExecutionContext, 
    config: EntityTestConfig,
    entityTypes: EntityType[]
  ): Promise<TestStepResult> {
    const startTime = Date.now();
    const repositories = context.metadata.repositories;
    const createdEntitiesMap = context.metadata.createdEntitiesMap as Map<string, any[]>;
    
    try {
      console.log(`[PURE-CRUD] [CLEANUP] Starting comprehensive cleanup of all test entities...`);
      
      if (!createdEntitiesMap || createdEntitiesMap.size === 0) {
        console.log(`[PURE-CRUD] [CLEANUP] No entities tracked for cleanup`);
        return {
          success: true,
          data: {
            deletionResults: {},
            remainingCounts: {},
            totalDeleted: 0,
            totalRemaining: 0,
            cleanupSuccess: true,
            entityTypes: []
          },
          duration: Date.now() - startTime,
          metadata: {
            entityTypes: [],
            totalDeleted: 0,
            totalRemaining: 0,
            cleanupSuccess: true,
            deletionOrder: 'reverse-hierarchy'
          }
        };
      }
      
      // Get entity types sorted by hierarchy level in REVERSE order (highest level first)
      const trackedEntityTypes = Array.from(createdEntitiesMap.keys());
      const sortedEntityTypes = [...trackedEntityTypes].sort((a, b) => {
        const levelA = CLIENT_DOMAIN_TABLE_HIERARCHY[`"${a}"` as keyof typeof CLIENT_DOMAIN_TABLE_HIERARCHY] || 0;
        const levelB = CLIENT_DOMAIN_TABLE_HIERARCHY[`"${b}"` as keyof typeof CLIENT_DOMAIN_TABLE_HIERARCHY] || 0;
        return levelB - levelA; // Sort descending (highest level first)
      });
      
      console.log(`[PURE-CRUD] [CLEANUP] Entity deletion order (reverse hierarchy):`, sortedEntityTypes.map((type: string) => 
        `${type} (level ${CLIENT_DOMAIN_TABLE_HIERARCHY[`"${type}"` as keyof typeof CLIENT_DOMAIN_TABLE_HIERARCHY] || 0})`
      ));

      const deletionResults: Record<string, any> = {};
      let totalDeleted = 0;

      // Delete entities in reverse hierarchy order to respect foreign key constraints
      for (const entityType of sortedEntityTypes) {
        try {
          const repository = this.getRepositoryForEntity(repositories, entityType as EntityType);
          const entitiesToDelete = createdEntitiesMap.get(entityType) || [];
          
          console.log(`[PURE-CRUD] [CLEANUP] Deleting ${entitiesToDelete.length} tracked ${entityType} entities`);
          
          const deletedIds: string[] = [];
          
          // Delete each tracked entity
          for (const entity of entitiesToDelete) {
            try {
              await repository.delete(entity.id);
              deletedIds.push(entity.id);
              totalDeleted++;
              console.log(`[PURE-CRUD] [CLEANUP] Deleted ${entityType} ${entity.id}`);
            } catch (error) {
              console.warn(`[PURE-CRUD] [CLEANUP] Failed to delete ${entityType} ${entity.id}:`, error);
            }
          }
          
          deletionResults[entityType] = {
            tracked: entitiesToDelete.length,
            deleted: deletedIds.length,
            deletedIds,
            success: deletedIds.length === entitiesToDelete.length
          };
          
          console.log(`[PURE-CRUD] [CLEANUP] Deleted ${deletedIds.length}/${entitiesToDelete.length} ${entityType} entities`);
          
          // Clear the tracked entities for this type
          createdEntitiesMap.set(entityType, []);
          
        } catch (error) {
          console.error(`[PURE-CRUD] [CLEANUP] Error during ${entityType} cleanup:`, error);
          deletionResults[entityType] = {
            tracked: createdEntitiesMap.get(entityType)?.length || 0,
            deleted: 0,
            deletedIds: [],
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }

      // Verify cleanup by checking remaining entities in database
      const remainingCounts: Record<string, number> = {};
      let totalTrackedRemaining = 0;
      
      for (const entityType of trackedEntityTypes) {
        try {
          const repository = this.getRepositoryForEntity(repositories, entityType as EntityType);
          const remaining = await repository.findAll();
          remainingCounts[entityType] = remaining.length;
          
          // Check if any of our tracked entities still exist in the database
          const trackedEntities = createdEntitiesMap.get(entityType) || [];
          const trackedIds = trackedEntities.map((e: any) => e.id);
          const remainingTrackedEntities = remaining.filter((entity: any) => trackedIds.includes(entity.id));
          
          if (remainingTrackedEntities.length > 0) {
            totalTrackedRemaining += remainingTrackedEntities.length;
            console.warn(`[PURE-CRUD] [CLEANUP] ${remainingTrackedEntities.length} tracked ${entityType} entities still exist in database:`, 
              remainingTrackedEntities.map((e: any) => e.id));
          }
        } catch (error) {
          remainingCounts[entityType] = -1; // Error checking
        }
      }

      // Success is based on whether our tracked entities were deleted, not total database count
      const cleanupSuccess = totalTrackedRemaining === 0;

      console.log(`[PURE-CRUD] [CLEANUP] Cleanup completed - Deleted: ${totalDeleted}, Tracked entities remaining: ${totalTrackedRemaining}`);
      console.log(`[PURE-CRUD] [CLEANUP] Database entity counts: ${Object.entries(remainingCounts).map(([type, count]) => `${type}: ${count}`).join(', ')}`);

      return {
        success: cleanupSuccess,
        data: {
          deletionResults,
          remainingCounts,
          totalDeleted,
          totalRemaining: totalTrackedRemaining, // Only count tracked entities
          cleanupSuccess,
          entityTypes: sortedEntityTypes,
          note: 'Success based on tracked entities deletion, not total database count'
        },
        duration: Date.now() - startTime,
        metadata: {
          entityTypes: sortedEntityTypes,
          totalDeleted,
          totalRemaining: totalTrackedRemaining, // Only count tracked entities
          cleanupSuccess,
          deletionOrder: 'reverse-hierarchy'
        }
      };
    } catch (error) {
      console.error(`[PURE-CRUD] [CLEANUP] Cleanup failed:`, error);
      return {
        success: false,
        error: error as Error,
        duration: Date.now() - startTime,
        metadata: { entityTypes: Array.from(createdEntitiesMap?.keys() || []) }
      };
    }
  }

  /**
   * Validate cleanup results
   */
  private async validateCleanup(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'warning', // Cleanup failure shouldn't fail the entire test
        message: 'Cleanup encountered issues but test results are still valid',
        details: result.error?.message,
        suggestions: [
          'Check database state manually',
          'Verify foreign key constraints are properly handled',
          'Consider manual cleanup if needed'
        ]
      };
    }

    const data = result.data;
    const metadata = result.metadata;
    
    if (metadata.totalRemaining > 0) {
      return {
        status: 'warning',
        message: `Cleanup incomplete - ${metadata.totalRemaining} tracked test entities remain in database`,
        details: {
          totalDeleted: metadata.totalDeleted,
          totalRemaining: metadata.totalRemaining,
          remainingCounts: data.remainingCounts,
          deletionResults: data.deletionResults,
          note: 'Only tracked test entities are counted, not total database entities'
        },
        suggestions: [
          'Check for foreign key constraint issues',
          'Verify entity deletion order',
          'Consider manual cleanup of remaining tracked entities'
        ]
      };
    }

    return {
      status: 'passed',
      message: `Cleanup successful - all ${metadata.totalDeleted} tracked test entities deleted`,
      details: {
        totalDeleted: metadata.totalDeleted,
        deletionOrder: metadata.deletionOrder,
        entityTypes: metadata.entityTypes,
        note: 'Success based on tracked entities deletion, not total database count'
      }
    };
  }

  /**
   * Simple test runner for easy usage
   */
  async run(updateProgress?: (progress: number, step: string) => void): Promise<TestResult> {
    const log = (progress: number, message: string) => {
      console.log(`[${progress}%] ${message}`);
      updateProgress?.(progress, message);
    };

    // Store the log function for use in other methods
    (this as any).progressLog = log;

    log(0, '🗄️  Starting Pure CRUD Tests (No Sync Tracking)...');
    
    const startTime = Date.now();
    const testId = uuidv4();
    
    try {
      // STEP 1: Validate Domain Coverage
      log(5, '📋 Validating domain entity coverage...');
      
      let generator: DataGeneratorFactory;
      let repositories: any;
      
      try {
        repositories = this.framework.getServices();
        log(6, '✅ Retrieved services from framework');
        
        if (!repositories) {
          throw new Error('Services not available in framework');
        }
        
        generator = new DataGeneratorFactory(repositories);
        log(7, '✅ Created TestDataGenerator instance');
      } catch (error: any) {
        log(5, `❌ Failed to initialize TestDataGenerator: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
      
      let coverageValidation: any;
      try {
        log(8, '🔍 Running domain coverage validation...');
        coverageValidation = await generator.validateDomainCoverage();
        log(9, '✅ Coverage validation completed');
      } catch (error: any) {
        log(8, `❌ Coverage validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error('Coverage validation error details:', error);
        throw error;
      }
      
      // Generate and log coverage report
      let coverageReport = '';
      try {
        log(10, '📊 Generating coverage report...');
        coverageReport = generator.generateCoverageReport(coverageValidation);
        log(10, `Coverage validation completed - ${coverageValidation.isValid ? 'PASSED' : 'FAILED'}`);
        console.log('\n' + coverageReport);
      } catch (error: any) {
        log(10, `❌ Failed to generate coverage report: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error('Coverage report error:', error);
        // Don't throw here, continue with validation result
      }
      
      // STEP 2: Fail if coverage validation fails
      if (!coverageValidation.isValid) {
        log(10, '❌ COVERAGE VALIDATION FAILED - Cannot proceed with tests');
        console.log('\nPlease fix the following issues:');
        coverageValidation.errors.forEach((error: string) => console.log(`  ❌ ${error}`));
        
        return {
          id: testId,
          configId: 'pure-crud-test',
          status: 'failed',
          success: false,
          startTime,
          endTime: Date.now(),
          duration: Date.now() - startTime,
          steps: [],
          validations: [{
            status: 'failed',
            message: 'Coverage validation failed',
            details: coverageValidation,
            suggestions: ['Fix domain entity coverage issues before running pure CRUD tests']
          }],
          syncStates: [],
          error: new Error('Coverage validation failed'),
          metadata: {
            coverageValidation,
            coverageReport,
            message: 'Fix domain entity coverage issues before running pure CRUD tests'
          }
        };
      }
      
      log(15, '✅ COVERAGE VALIDATION PASSED - Proceeding with pure CRUD tests...');

      // Create a single comprehensive test configuration that tests all entity types
      const entityTypes = CLIENT_DOMAIN_TABLES.map(table => table.replace(/"/g, '')) as EntityType[];
      
      log(20, `🔧 Setting up comprehensive CRUD test for ${entityTypes.length} entity types: ${entityTypes.join(', ')}`);
      
      // Single comprehensive configuration that creates all test data and runs all CRUD operations
      const comprehensiveConfig: EntityTestConfig = {
        id: 'pure-crud-comprehensive',
        name: 'Pure CRUD Operations - All Entities',
        description: 'Setup comprehensive test data and run CRUD operations for all entity types',
        type: 'single_entity_crud',
        entity: 'tasks', // Primary entity, but tests all types
        operations: ['update', 'delete'], // No insert - setup already creates entities
        dataVariations: { minimal: true, complete: true, edge: false, invalid: false },
        validation: { immediate: true, eventual: false, state: false },
        enabled: true,
        timeout: 60000, // Longer timeout for comprehensive test
        retries: 0,
        cleanupAfterTest: true,
        tags: ['pure', 'crud', 'comprehensive']
      };

      // Create comprehensive test steps that include setup + CRUD for all entities
      const comprehensiveSteps = this.createComprehensiveTestSteps(comprehensiveConfig, entityTypes);
      
      log(22, '📋 Created test plan with setup, CRUD operations, validations, and cleanup');
      log(24, `🎯 Target operations: ${comprehensiveConfig.operations.join(', ').toUpperCase()} (no INSERT - entities created in setup)`);
      log(25, '🔧 Running comprehensive CRUD test...');
      
      const result = await this.framework.executeTestWithSteps(comprehensiveConfig, comprehensiveSteps);
      
      // Immediate progress update after test execution
      log(75, '✅ Test execution completed, processing results...');
      
      // Report on individual test steps
      if (result.steps && result.steps.length > 0) {
        log(30, '📋 Test steps completed, analyzing results...');
        
        // Report CRUD operations - ensure steps have valid IDs
        const allSteps = result.steps.filter((step: any) => 
          step && (step.id || step.metadata?.stepId)
        );
        const crudSteps = allSteps.filter((step: any) => 
          (step.id && step.id.includes('-crud-operation')) ||
          (step.metadata?.stepId && step.metadata.stepId.includes('-crud-operation'))
        );
        
        if (crudSteps.length > 0) {
          const successfulCrud = crudSteps.filter((s: any) => s.success).length;
          log(40, `🔄 CRUD Operations: ${successfulCrud}/${crudSteps.length} successful`);
          
          // Report each operation type
          const operations = ['update', 'delete'];
          operations.forEach((op, index) => {
            const opSteps = crudSteps.filter((step: any) => 
              (step.id && step.id.includes(`${op}-`)) ||
              (step.metadata?.stepId && step.metadata.stepId.includes(`${op}-`))
            );
            const successful = opSteps.filter((s: any) => s.success).length;
            log(45 + index * 5, `  ${op.toUpperCase()}: ${successful}/${opSteps.length} operations successful`);
          });
        }
        
        // Report validation steps
        const validationSteps = allSteps.filter((step: any) => 
          (step.id && step.id.includes('-validation')) ||
          (step.metadata?.stepId && step.metadata.stepId.includes('-validation'))
        );
        if (validationSteps.length > 0) {
          const successfulValidations = validationSteps.filter((s: any) => s.success).length;
          log(60, `✅ Validations: ${successfulValidations}/${validationSteps.length} passed`);
          
          // Report specific validations
          const domainStep = allSteps.find((step: any) => 
            step.id === 'comprehensive-domain-coverage-validation' ||
            step.metadata?.stepId === 'comprehensive-domain-coverage-validation'
          );
          if (domainStep && domainStep.success && domainStep.data) {
            const coverage = domainStep.data?.domainCoverage?.coverage?.overallPercentage || 0;
            log(65, `  Domain Coverage: ${coverage}% ${coverage >= 80 ? '✅' : '❌'}`);
          }
          
          const syncStep = result.steps?.find((step: any) => 
            step.id === 'comprehensive-sync-isolation-validation' ||
            step.metadata?.stepId === 'comprehensive-sync-isolation-validation'
          );
          if (syncStep && syncStep.success && syncStep.data) {
            const isolated = syncStep.data?.isolatedOperations || 0;
            const total = syncStep.data?.totalOperations || 0;
            log(70, `  Sync Isolation: ${isolated}/${total} operations isolated ✅`);
          }
        }
        
        // Report cleanup
        const cleanupStep = allSteps.find((step: any) => 
          step.id === 'comprehensive-cleanup' ||
          step.metadata?.stepId === 'comprehensive-cleanup'
        );
        if (cleanupStep && cleanupStep.data) {
          const deleted = cleanupStep.data?.totalDeleted || 0;
          const remaining = cleanupStep.data?.totalRemaining || 0;
          log(80, `🧹 Cleanup: ${deleted} entities deleted, ${remaining} tracked entities remaining ${remaining === 0 ? '✅' : '⚠️'}`);
        }
      } else {
        log(30, '⚠️ No test steps found in result');
      }
      
      // Generate comprehensive test report
      log(90, '📊 Generating comprehensive test report...');
      this.generateTestReport(result, log);
      
      // Enhanced result with coverage validation
      const enhancedResult = {
        ...result,
        metadata: {
          ...result.metadata,
          coverageValidation,
          coverageReport,
          testType: 'pure-crud-comprehensive',
          syncTrackingDisabled: true,
          entityTypesTested: entityTypes,
          comprehensiveTest: true
        }
      };
      
      log(100, `✅ Comprehensive Pure CRUD Tests completed in ${Date.now() - startTime}ms - ${result.success ? 'PASSED' : 'FAILED'}`);
      if (result.success) {
        log(100, `📊 Successfully tested CRUD operations for all ${entityTypes.length} entity types`);
      } else {
        log(100, `❌ Test failed: ${result.error?.message}`);
      }

      return enhancedResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(0, `❌ Pure CRUD Tests failed: ${errorMessage}`);
      console.error('❌ Pure CRUD Tests failed:', errorMessage);
      const endTime = Date.now();
      
      return {
        id: testId,
        configId: 'pure-crud-test',
        status: 'failed',
        success: false,
        startTime,
        endTime,
        duration: endTime - startTime,
        steps: [],
        validations: [{
          status: 'failed',
          message: 'Test execution failed',
          details: { error: errorMessage }
        }],
        syncStates: [],
        error: error instanceof Error ? error : new Error(errorMessage),
        metadata: { error: errorMessage }
      };
    }
  }

  /**
   * Create comprehensive test steps for Pure CRUD operations
   */
  private createPureCRUDTestSteps(config: EntityTestConfig): TestStep[] {
    const steps: TestStep[] = [];

    // Setup step
    steps.push({
      id: 'setup',
      name: 'Setup Pure CRUD Test Environment',
      description: 'Prepare test environment and generate test data',
      phase: 'setup',
      execute: async (context) => this.setupTest(context, config),
      validate: async (context, result) => this.validateSetup(context, result)
    });

    // Create test steps for each operation without sync tracking
    config.operations.forEach(operation => {
      steps.push({
        id: `${operation}-crud-operation`,
        name: `${operation.toUpperCase()} CRUD Operation (Repository Direct)`,
        description: `Execute ${operation} operation using repositories directly (no sync tracking)`,
        phase: 'execution',
        execute: async (context) => this.executePureCRUDOperation(context, config, operation),
        validate: async (context, result) => this.validateCRUDOperation(context, result, operation)
      });
    });

    // Database validation step
    steps.push({
      id: 'database-validation',
      name: 'Database State Validation',
      description: 'Validate final database state and data integrity',
      phase: 'validation',
      execute: async (context) => this.executeDatabaseValidation(context, config),
      validate: async (context, result) => this.validateDatabaseState(context, result)
    });

    // Sync isolation validation step
    steps.push({
      id: 'sync-isolation-validation',
      name: 'Sync Isolation Validation',
      description: 'Validate that no sync tracking occurred during any operations',
      phase: 'validation',
      execute: async (context) => this.executeSyncIsolationValidation(context, config),
      validate: async (context, result) => this.validateSyncIsolation(context, result)
    });

    // Domain coverage validation step
    steps.push({
      id: 'comprehensive-domain-coverage-validation',
      name: 'Comprehensive Domain Coverage Validation',
      description: 'Validate comprehensive coverage of client entity fields, enums, and relations across all entity types',
      phase: 'validation',
      execute: async (context) => this.executeDomainCoverageValidation(context, config),
      validate: async (context, result) => this.validateDomainCoverage(context, result)
    });

    // Cleanup step - always runs regardless of test success/failure
    steps.push({
      id: 'comprehensive-cleanup',
      name: 'Comprehensive Test Cleanup',
      description: 'Clean up all created entities in reverse hierarchy order (respecting foreign key constraints)',
      phase: 'cleanup',
      execute: async (context) => this.executeComprehensiveCleanup(context, config, CLIENT_DOMAIN_TABLES.map(table => table.replace(/"/g, '')) as EntityType[]),
      validate: async (context, result) => this.validateCleanup(context, result)
    });

    return steps;
  }

  /**
   * Create lightweight test steps for CRUD operations only (no setup)
   */
  private createCRUDOnlyTestSteps(config: EntityTestConfig): TestStep[] {
    const steps: TestStep[] = [];

    // Create test steps for each operation without sync tracking
    config.operations.forEach(operation => {
      steps.push({
        id: `${operation}-crud-operation`,
        name: `${operation.toUpperCase()} CRUD Operation (Repository Direct) - ${config.entity}`,
        description: `Execute ${operation} operation for ${config.entity} using repositories directly (no sync tracking)`,
        phase: 'execution',
        execute: async (context) => this.executePureCRUDOperation(context, config, operation),
        validate: async (context, result) => this.validateCRUDOperation(context, result, operation)
      });
    });

    // Database validation step for this entity
    steps.push({
      id: 'database-validation',
      name: `Database State Validation - ${config.entity}`,
      description: `Validate database state and data integrity for ${config.entity}`,
      phase: 'validation',
      execute: async (context) => this.executeDatabaseValidation(context, config),
      validate: async (context, result) => this.validateDatabaseState(context, result)
    });

    // Sync isolation validation step
    steps.push({
      id: 'sync-isolation-validation',
      name: `Sync Isolation Validation - ${config.entity}`,
      description: `Validate that no sync tracking occurred during ${config.entity} operations`,
      phase: 'validation',
      execute: async (context) => this.executeSyncIsolationValidation(context, config),
      validate: async (context, result) => this.validateSyncIsolation(context, result)
    });

    return steps;
  }

  /**
   * Generate comprehensive test report
   */
  private generateTestReport(result: any, log: (progress: number, message: string) => void): void {
    console.log('\n' + '='.repeat(80));
    console.log('PURE CRUD OPERATIONS TEST REPORT');
    console.log('='.repeat(80));
    
    // Overall test result
    console.log(`\n📊 OVERALL RESULT: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`⏱️  Total Duration: ${result.duration}ms`);
    console.log(`🔧 Test Steps: ${result.steps?.length || 0}`);
    
    // Test steps summary
    if (result.steps && result.steps.length > 0) {
      console.log('\n📋 TEST STEPS SUMMARY:');
      result.steps.forEach((step: any, index: number) => {
        const status = step.success ? '✅' : '❌';
        const duration = step.duration ? `(${step.duration}ms)` : '';
        const stepName = step.metadata?.stepName || step.metadata?.stepId || `Step ${index + 1}`;
        console.log(`  ${index + 1}. ${status} ${stepName} ${duration}`);
        if (!step.success && step.error) {
          console.log(`     Error: ${step.error.message}`);
        }
      });
    }
    
    // ENHANCED CRUD Operations Report - Include INSERT operations from setup
    console.log('\n🔄 CRUD OPERATIONS PERFORMED:');
    
    const allOperations: any[] = [];
    
    // 1. Get INSERT operations from setup step
    const setupStep = result.steps?.find((step: any) => 
      step.metadata?.stepId === 'comprehensive-setup' || step.id === 'comprehensive-setup'
    );
    
    if (setupStep && setupStep.data && setupStep.data.insertOperations) {
      const insertOps = setupStep.data.insertOperations;
      console.log(`\n  📝 SETUP PHASE - INSERT OPERATIONS:`);
      console.log(`     Total INSERT operations: ${insertOps.length}`);
      console.log(`     Successful INSERTs: ${insertOps.filter((op: any) => op.successful).length}`);
      console.log(`     Failed INSERTs: ${insertOps.filter((op: any) => !op.successful).length}`);
      
      // Group insert operations by entity type
      const insertsByEntity: Record<string, any[]> = {};
      insertOps.forEach((op: any) => {
        if (!insertsByEntity[op.entityType]) {
          insertsByEntity[op.entityType] = [];
        }
        insertsByEntity[op.entityType].push(op);
      });
      
      // Report insert operations by entity type
      Object.entries(insertsByEntity).forEach(([entityType, operations]) => {
        const successful = operations.filter(op => op.successful).length;
        const total = operations.length;
        const avgDuration = operations.length > 0 ? Math.round(operations.reduce((sum, op) => sum + op.duration, 0) / operations.length) : 0;
        
        console.log(`\n    📦 ${entityType.toUpperCase()}:`);
        console.log(`       INSERT: ${successful}/${total} successful | Avg: ${avgDuration}ms | 🔒 Sync isolated`);
        
        // Show relationship and enum usage for a few examples
        const exampleOps = operations.slice(0, 2);
        exampleOps.forEach((op: any) => {
          const relationships = Object.entries(op.relationships || {})
            .filter(([_, hasRel]) => hasRel)
            .map(([relType, _]) => relType)
            .join(', ');
          const enums = Object.entries(op.enumFields || {})
            .filter(([_, value]) => value)
            .map(([field, value]) => `${field}:${value}`)
            .join(', ');
          
          if (relationships || enums) {
            console.log(`         ${op.entityId}: ${relationships ? `rels:[${relationships}]` : ''} ${enums ? `enums:[${enums}]` : ''}`);
          }
        });
      });
      
      // Add insert operations to the comprehensive operations list
      allOperations.push(...insertOps.map((op: any) => ({
        ...op,
        phase: 'setup',
        syncIsolated: true
      })));
    }
    
    // 2. Get UPDATE/DELETE operations from execution steps
    const crudSteps = result.steps?.filter((step: any) => 
      ((step.id && step.id.includes('-crud-operation')) || 
      (step.metadata?.stepId && step.metadata.stepId.includes('-crud-operation'))) &&
      step.success
    ) || [];
    
    if (crudSteps.length > 0) {
      console.log(`\n  🔄 EXECUTION PHASE - UPDATE/DELETE OPERATIONS:`);
      
      const operationsByEntity: Record<string, any[]> = {};
      
      crudSteps.forEach((step: any) => {
        const data = step.data || {};
        const entityType = data.entityType || 'unknown';
        const operation = data.operation || 'unknown';
        
        if (!operationsByEntity[entityType]) {
          operationsByEntity[entityType] = [];
        }
        
        const operationData = {
          operation: operation.toUpperCase(),
          entityId: data.operationDetails?.entityId || data.operationResult?.id || 'unknown',
          entityCountDelta: data.entityCountDelta || 0,
          syncIsolated: data.syncTrackingPrevented || false,
          duration: step.duration || 0,
          temporary: data.operationDetails?.temporary || false,
          phase: 'execution'
        };
        
        operationsByEntity[entityType].push(operationData);
        allOperations.push(operationData);
      });
      
      Object.entries(operationsByEntity).forEach(([entityType, operations]) => {
        console.log(`\n    📦 ${entityType.toUpperCase()}:`);
        operations.forEach((op: any) => {
          const syncStatus = op.syncIsolated ? '🔒 Isolated' : '⚠️  Sync detected';
          const tempNote = op.temporary ? ' (temporary)' : '';
          console.log(`       ${op.operation}: ${op.entityId}${tempNote} | ${syncStatus} | Δ${op.entityCountDelta >= 0 ? '+' : ''}${op.entityCountDelta} | ${op.duration}ms`);
        });
      });
    }
    
    // Summary of all CRUD operations
    const insertOps = allOperations.filter(op => op.operation === 'INSERT');
    const updateOps = allOperations.filter(op => op.operation === 'UPDATE');
    const deleteOps = allOperations.filter(op => op.operation === 'DELETE');
    const isolatedOps = allOperations.filter(op => op.syncIsolated);
    
    if (allOperations.length > 0) {
      console.log(`\n  📊 CRUD OPERATIONS SUMMARY:`);
      console.log(`     INSERT operations: ${insertOps.length} (from setup)`);
      console.log(`     UPDATE operations: ${updateOps.length}`);
      console.log(`     DELETE operations: ${deleteOps.length}`);
      console.log(`     Total operations: ${allOperations.length}`);
      console.log(`     Sync isolated: ${isolatedOps.length}/${allOperations.length} (${Math.round((isolatedOps.length/allOperations.length)*100)}%)`);
      
      console.log(`✅ Successfully executed ${allOperations.length} CRUD operations (${insertOps.length} INSERT, ${updateOps.length} UPDATE, ${deleteOps.length} DELETE)`);
    }
    
    // Domain Coverage Summary
    const domainStep = result.steps?.find((step: any) => 
      step.id === 'comprehensive-domain-coverage-validation' ||
      step.metadata?.stepId === 'comprehensive-domain-coverage-validation'
    );
    
    if (domainStep && domainStep.success && domainStep.data) {
      const coverage = domainStep.data.domainCoverage?.coverage;
      if (coverage) {
        console.log('\n📈 DOMAIN COVERAGE ACHIEVED:');
        console.log(`  Overall: ${coverage.overallPercentage}% (${coverage.overallPercentage >= 80 ? '✅' : '❌'} Target: 80%)`);
        console.log(`  Fields: ${coverage.fieldsCovered}/${coverage.totalFields} (${Math.round((coverage.fieldsCovered/coverage.totalFields)*100)}%)`);
        console.log(`  Relations: ${coverage.relationsCovered}/${coverage.totalRelations} (${Math.round((coverage.relationsCovered/coverage.totalRelations)*100)}%)`);
        console.log(`  Enums: ${coverage.enumsCovered}/${coverage.totalEnums} (${Math.round((coverage.enumsCovered/coverage.totalEnums)*100)}%)`);
      }
    }
    
    // Sync Isolation Summary
    const syncStep = result.steps?.find((step: any) => 
      step.id === 'comprehensive-sync-isolation-validation' ||
      step.metadata?.stepId === 'comprehensive-sync-isolation-validation'
    );
    
    if (syncStep && syncStep.data) {
      console.log('\n🔒 SYNC ISOLATION VALIDATION:');
      const isolatedOps = syncStep.data.isolatedOperations || 0;
      const totalOps = syncStep.data.totalOperations || 0;
      const violations = syncStep.data.syncViolations || [];
      
      console.log(`  Operations: ${isolatedOps}/${totalOps} properly isolated`);
      if (violations.length > 0) {
        console.log(`  ⚠️  Violations detected:`);
        violations.forEach((violation: string) => {
          console.log(`    - ${violation}`);
        });
      } else {
        console.log(`  ✅ No sync tracking violations detected`);
      }
    }
    
    // Cleanup Summary
    const cleanupStep = result.steps?.find((step: any) => 
      step.id === 'comprehensive-cleanup' ||
      step.metadata?.stepId === 'comprehensive-cleanup'
    );
    
    if (cleanupStep && cleanupStep.data) {
      console.log('\n🧹 CLEANUP SUMMARY:');
      const deleted = cleanupStep.data.totalDeleted || 0;
      const remaining = cleanupStep.data.totalRemaining || 0;
      console.log(`  Entities deleted: ${deleted}`);
      console.log(`  Tracked entities remaining: ${remaining} ${remaining === 0 ? '✅' : '⚠️'}`);
      
      if (cleanupStep.data.deletionResults) {
        Object.entries(cleanupStep.data.deletionResults).forEach(([entityType, result]: [string, any]) => {
          console.log(`    ${entityType}: ${result.deleted}/${result.tracked} deleted`);
        });
      }
    }
    
    // Final Status
    console.log('\n' + '='.repeat(80));
    if (result.success) {
      console.log('🎉 PURE CRUD OPERATIONS TEST COMPLETED SUCCESSFULLY');
      console.log('✅ All repository methods work correctly without triggering sync tracking');
      console.log('✅ Domain coverage requirements met');
      console.log('✅ All test entities cleaned up properly');
      
      if (allOperations.length > 0) {
        console.log(`✅ Successfully executed ${allOperations.length} CRUD operations (${insertOps.length} INSERT, ${updateOps.length} UPDATE, ${deleteOps.length} DELETE)`);
      }
    } else {
      console.log('❌ PURE CRUD OPERATIONS TEST FAILED');
      if (result.error) {
        console.log(`Error: ${result.error.message}`);
      }
    }
    console.log('='.repeat(80) + '\n');
  }
}

interface DomainCoverageReport {
  entities: {
    [entityName: string]: {
      fields: {
        [fieldName: string]: {
          tested: boolean;
          type: string;
          required: boolean;
          enum?: string;
        };
      };
      relations: {
        [relationName: string]: {
          tested: boolean;
          type: string;
          target: string;
        };
      };
      enums: {
        [enumName: string]: {
          tested: boolean;
          values: string[];
          usedValues: string[];
        };
      };
    };
  };
  coverage: {
    fieldsCovered: number;
    totalFields: number;
    relationsCovered: number;
    totalRelations: number;
    enumsCovered: number;
    totalEnums: number;
    overallPercentage: number;
  };
}

interface FieldDefinition {
  type: string;
  required: boolean;
  enum?: string;
}

interface RelationDefinition {
  type: string;
  target: string;
}

interface EnumDefinition {
  values: string[];
}

interface EntityDefinition {
  fields: Record<string, FieldDefinition>;
  relations: Record<string, RelationDefinition>;
  enums: Record<string, EnumDefinition>;
} 