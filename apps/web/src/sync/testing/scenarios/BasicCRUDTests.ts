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
import { TestDataGenerator } from '../generators/TestDataGenerator';
import { ValidationEngine } from '../core/ValidationEngine';
import { TaskStatus, TaskPriority } from '@repo/dataforge/client-entities';

/**
 * Basic CRUD Tests - Enhanced for proper sync validation
 * Tests fundamental create, read, update, delete operations
 * with immediate sync response validation for each operation
 */
export class BasicCRUDTests {
  private dataGenerator?: TestDataGenerator;
  private validationEngine: ValidationEngine;

  constructor(private framework: SyncTestFramework) {
    this.validationEngine = new ValidationEngine(framework);
  }

  /**
   * Run comprehensive entity CRUD test with proper sync validation
   */
  async runEntityCRUDTest(config: EntityTestConfig): Promise<TestResult> {
    const testSteps = this.createEnhancedTestSteps(config);
    
    return await this.framework.executeTestWithSteps(config, testSteps);
  }

  /**
   * Create enhanced test steps with per-operation sync validation
   */
  private createEnhancedTestSteps(config: EntityTestConfig): TestStep[] {
    const steps: TestStep[] = [];

    // Setup step
    steps.push({
      id: 'setup',
      name: 'Setup Test Environment',
      description: 'Prepare test environment and generate test data',
      phase: 'setup',
      execute: async (context) => this.setupTest(context, config),
      validate: async (context, result) => this.validationEngine.validateTestStep(
        config, context, result, 'setup'
      )
    });

    // Create test steps for each operation with immediate sync validation
    config.operations.forEach(operation => {
      steps.push({
        id: `${operation}-operation`,
        name: `${operation.toUpperCase()} Operation with Sync Validation`,
        description: `Execute ${operation} operation and validate immediate sync response`,
        phase: 'execution',
        execute: async (context) => this.executeOperationWithSyncMonitoring(context, config, operation),
        validate: async (context, result) => this.validationEngine.validateTestStep(
          config, context, result, `${operation}-operation`
        )
      });
    });

    // Comprehensive sync validation step
    steps.push({
      id: 'comprehensive-sync-validation',
      name: 'Comprehensive Sync Validation',
      description: 'Validate overall sync state and change consistency',
      phase: 'validation',
      execute: async (context) => this.executeComprehensiveSyncValidation(context, config),
      validate: async (context, result) => this.validateComprehensiveSyncResult(context, result)
    });

    return steps;
  }

  /**
   * Setup test environment and generate test data
   */
  async setupTest(context: TestExecutionContext, config: EntityTestConfig): Promise<TestStepResult> {
    const startTime = Date.now();
    
    try {
      // Get services from framework
      const services = this.framework.getServices();
      if (!services) {
        throw new Error('Services not available in framework');
      }

      // Initialize data generator with services
      this.dataGenerator = new TestDataGenerator(services);
      
      // Store services and generator in context
      context.metadata.services = services;
      context.metadata.dataGenerator = this.dataGenerator;

      // Generate test data using services for each variation
      const testData: Record<string, any> = {};
      
      for (const [variation, enabled] of Object.entries(config.dataVariations)) {
        if ((enabled as boolean)) {
          switch (variation) {
            case 'minimal':
              testData.minimal = await this.dataGenerator.createTestData(config.entity, 1, { variation: 'minimal' });
              break;
            case 'complete':
              testData.complete = await this.dataGenerator.createTestData(config.entity, 3, { variation: 'complete' });
              break;
            case 'edge':
              testData.edge = await this.dataGenerator.createTestData(config.entity, 1, { variation: 'basic' });
              break;
            case 'invalid':
              // For invalid, we'll create valid data and modify it later if needed
              testData.invalid = await this.dataGenerator.createTestData(config.entity, 1, { variation: 'minimal' });
              break;
          }
        }
      }

      // Store test data in context metadata
      context.metadata.testData = testData;

      return {
        success: true,
        duration: Date.now() - startTime,
        data: { message: `Setup completed for ${config.entity} entity` },
        metadata: {
          servicesAvailable: Object.keys(services).length,
          testDataVariations: Object.keys(testData).length,
          generatedEntities: Object.values(testData).reduce((sum, data: any) => 
            sum + (data ? data.length : 0), 0)
        }
      };
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error as Error,
        metadata: {}
      };
    }
  }

  /**
   * Execute operation with comprehensive sync monitoring
   */
  private async executeOperationWithSyncMonitoring(
    context: TestExecutionContext, 
    config: EntityTestConfig, 
    operation: OperationType
  ): Promise<TestStepResult> {
    const startTime = Date.now();
    const services = context.metadata.services;
    const testData = context.metadata.testData;
    
    try {
      // Get appropriate service for entity type
      const service = this.getServiceForEntity(services, config.entity);
      
      // Capture pre-operation sync state
      const preOpSyncState = this.framework.getCurrentSyncState();
      const preOpLocalChanges = await this.framework.getLocalChanges();

      // Execute the operation
      let operationResult;
      switch (operation) {
        case 'insert':
          operationResult = await this.createEntity(service, config.entity, testData, context);
          break;
        case 'update':
          operationResult = await this.updateEntity(service, config.entity, testData, context);
          break;
        case 'delete':
          operationResult = await this.deleteEntity(service, config.entity, testData, context);
          break;
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }

      // Capture post-operation sync state
      const postOpSyncState = this.framework.getCurrentSyncState();
      const postOpLocalChanges = await this.framework.getLocalChanges();

      // Verify sync state delta
      const syncStateDelta = this.framework.captureSyncStateDelta(preOpSyncState, postOpSyncState);
      const newChangesCount = postOpLocalChanges.length - preOpLocalChanges.length;
      
      if (newChangesCount <= 0) {
        throw new Error(`Expected new local changes after ${operation} operation, but got ${newChangesCount}`);
      }

      // Store operation result for later validation
      context.metadata.operationResults = context.metadata.operationResults || {};
      context.metadata.operationResults[operation] = {
        result: operationResult,
        preOpSyncState,
        postOpSyncState,
        syncStateDelta,
        newChangesCount,
        timestamp: Date.now()
      };

      return {
        success: true,
        duration: Date.now() - startTime,
        data: {
          operation,
          entityType: config.entity,
          operationResult,
          newChangesCount,
          syncStateChanged: true
        },
        metadata: {
          operation,
          entityType: config.entity,
          newChangesDetected: newChangesCount,
          syncStateValidated: true,
          preOpChangeCount: preOpLocalChanges.length,
          postOpChangeCount: postOpLocalChanges.length
        }
      };
    } catch (error) {
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
   * Perform a single operation (create, update, or delete)
   */
  private async performSingleOperation(
    service: any,
    entityType: EntityType,
    operation: OperationType,
    testData: any,
    context: TestExecutionContext
  ): Promise<any> {
    switch (operation) {
      case 'insert':
        return await this.createEntity(service, entityType, testData, context);

      case 'update':
        return await this.updateEntity(service, entityType, testData, context);

      case 'delete':
        return await this.deleteEntity(service, entityType, testData, context);

      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }

  /**
   * Create entity using proper service methods via TestDataGenerator
   */
  private async createEntity(service: any, entityType: EntityType, testData: any, context: TestExecutionContext): Promise<any> {
    // Use the TestDataGenerator to create entities with proper relationships
    if (!this.dataGenerator) {
      throw new Error('TestDataGenerator not initialized');
    }

    switch (entityType) {
      case 'tasks':
        // Get existing projects or create one
        const existingProjects = this.getExistingEntitiesFromTestData(testData, 'projects');
        let projects = existingProjects;
        
        if (projects.length === 0) {
          // Create a project using the generator
          projects = await this.dataGenerator.createTestProjects(1);
        }
        
        // Get existing users for assignment
        const existingUsers = this.getExistingEntitiesFromTestData(testData, 'users');
        let assignees = existingUsers;
        
        if (assignees.length === 0) {
          assignees = await this.dataGenerator.createTestUsers(1);
        }
        
        // Create task using generator with proper relationships
        const tasks = await this.dataGenerator.createTestTasks(1, projects, assignees);
        return tasks[0];

      case 'projects':
        // Get existing users for ownership
        const existingOwnersForProject = this.getExistingEntitiesFromTestData(testData, 'users');
        let owners = existingOwnersForProject;
        
        if (owners.length === 0) {
          owners = await this.dataGenerator.createTestUsers(1);
        }
        
        // Create project using generator with proper ownership
        const projectsCreated = await this.dataGenerator.createTestProjects(1, owners);
        return projectsCreated[0];

      case 'users':
        // Create user using generator
        const users = await this.dataGenerator.createTestUsers(1);
        return users[0];

      case 'comments':
        // Get existing tasks for commenting
        const existingTasksForComment = this.getExistingEntitiesFromTestData(testData, 'tasks');
        let tasksForComment = existingTasksForComment;
        
        if (tasksForComment.length === 0) {
          const createdTask = await this.createEntity(service, 'tasks', testData, context);
          tasksForComment = [createdTask];
        }
        
        // Get existing users for authorship
        const existingAuthors = this.getExistingEntitiesFromTestData(testData, 'users');
        let authors = existingAuthors;
        
        if (authors.length === 0) {
          authors = await this.dataGenerator.createTestUsers(1);
        }
        
        // Create comment using generator with proper relationships
        const comments = await this.dataGenerator.createTestComments(1, tasksForComment, authors);
        return comments[0];

      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  /**
   * Update entity using proper service methods
   */
  private async updateEntity(service: any, entityType: EntityType, testData: any, context: TestExecutionContext): Promise<any> {
    // Get existing entities from test data for updates
    const existingEntities = this.getExistingEntitiesFromTestData(testData, entityType);
    if (existingEntities.length === 0) {
      // Create entity first if none exist
      const created = await this.createEntity(service, entityType, testData, context);
      const updateData = this.generateUpdateData(entityType);
      const result = await this.performUpdate(service, entityType, created.id, updateData);
      return result;
    }
    
    const entityToUpdate = existingEntities[0];
    const updateData = this.generateUpdateData(entityType);
    const result = await this.performUpdate(service, entityType, entityToUpdate.id, updateData);
    return result;
  }

  /**
   * Delete entity using proper service methods
   */
  private async deleteEntity(service: any, entityType: EntityType, testData: any, context: TestExecutionContext): Promise<any> {
    // Get existing entities from test data for deletion
    const entitiesForDeletion = this.getExistingEntitiesFromTestData(testData, entityType);
    if (entitiesForDeletion.length === 0) {
      // Create entity first if none exist
      const created = await this.createEntity(service, entityType, testData, context);
      const deleteResult = await this.performDelete(service, entityType, created.id);
      return { deleted: deleteResult, entityId: created.id };
    }
    
    const entityToDelete = entitiesForDeletion[entitiesForDeletion.length - 1]; // Take last entity
    const deleteResult = await this.performDelete(service, entityType, entityToDelete.id);
    return { deleted: deleteResult, entityId: entityToDelete.id };
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
   * Perform update using appropriate service method
   */
  private async performUpdate(service: any, entityType: EntityType, id: string, updateData: any): Promise<any> {
    switch (entityType) {
      case 'tasks':
        return await service.updateTask(id, updateData);
      case 'projects':
        return await service.updateProject(id, updateData);
      case 'users':
        return await service.updateUser(id, updateData);
      case 'comments':
        return await service.updateComment(id, updateData);
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  /**
   * Perform delete using appropriate service method
   */
  private async performDelete(service: any, entityType: EntityType, id: string): Promise<boolean> {
    switch (entityType) {
      case 'tasks':
        return await service.deleteTask(id);
      case 'projects':
        return await service.deleteProject(id);
      case 'users':
        return await service.deleteUser(id);
      case 'comments':
        return await service.deleteComment(id);
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  /**
   * Execute comprehensive sync validation using existing validators
   */
  private async executeComprehensiveSyncValidation(
    context: TestExecutionContext, 
    config: EntityTestConfig
  ): Promise<TestStepResult> {
    const startTime = Date.now();
    
    try {
      // Run comprehensive validation using ValidationEngine
      const validationResults = await this.validationEngine.runComprehensiveValidation(context, config);
      
      // Analyze results
      const failedValidations = validationResults.filter(v => v.status === 'failed');
      const warningValidations = validationResults.filter(v => v.status === 'warning');
      const passedValidations = validationResults.filter(v => v.status === 'passed');

      const success = failedValidations.length === 0;

      return {
        success,
        data: {
          validationResults,
          summary: {
            total: validationResults.length,
            passed: passedValidations.length,
            warnings: warningValidations.length,
            failed: failedValidations.length
          }
        },
        duration: Date.now() - startTime,
        metadata: {
          comprehensiveValidation: true,
          success,
          failedValidations: failedValidations.length,
          warningValidations: warningValidations.length
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
   * Get appropriate service for entity type
   */
  private getServiceForEntity(services: any, entityType: EntityType): any {
    switch (entityType) {
      case 'tasks':
        return services.tasks;
      case 'projects':
        return services.projects;
      case 'users':
        return services.users;
      case 'comments':
        return services.comments;
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  /**
   * Get table name for entity type
   */
  private getTableNameForEntity(entityType: EntityType): string {
    switch (entityType) {
      case 'tasks':
        return 'tasks';
      case 'projects':
        return 'projects';
      case 'users':
        return 'users';
      case 'comments':
        return 'comments';
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
          description: 'Updated description',
          status: TaskStatus.IN_PROGRESS
        };
      case 'projects':
        return {
          name: `Updated Project ${timestamp.getTime()}`,
          description: 'Updated project description'
        };
      case 'users':
        return {
          name: `Updated User ${timestamp.getTime()}`,
          email: `updated${timestamp.getTime()}@example.com`
        };
      case 'comments':
        return {
          content: `Updated comment content ${timestamp.getTime()}`
        };
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  /**
   * Validate comprehensive sync result
   */
  private async validateComprehensiveSyncResult(
    context: TestExecutionContext, 
    result: TestStepResult
  ): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Comprehensive sync validation failed',
        details: result.error?.message
      };
    }

    const summary = result.data.summary;
    
    if (summary.failed > 0) {
      return {
        status: 'failed',
        message: `Comprehensive validation failed: ${summary.failed} validation(s) failed`,
        details: summary
      };
    }

    if (summary.warnings > 0) {
      return {
        status: 'warning',
        message: `Comprehensive validation passed with ${summary.warnings} warning(s)`,
        details: summary
      };
    }

    return {
      status: 'passed',
      message: `Comprehensive sync validation successful - all ${summary.total} validations passed`,
      details: summary
    };
  }

  async run(updateProgress?: (progress: number, step: string) => void): Promise<TestResult> {
    const log = (progress: number, message: string) => {
      console.log(`[${progress}%] ${message}`);
      updateProgress?.(progress, message);
    };

    log(0, '🚀 Starting Basic CRUD Tests with comprehensive domain coverage validation...');
    
    const startTime = Date.now();
    const testId = uuidv4();
    
    try {
      // STEP 1: Validate Domain Coverage
      log(5, '📋 Validating domain entity coverage...');
      
      let generator: TestDataGenerator;
      let services: any;
      
      try {
        services = this.framework.getServices();
        log(6, '✅ Retrieved services from framework');
        
        if (!services) {
          throw new Error('Services not available in framework');
        }
        
        generator = new TestDataGenerator(services);
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
          configId: 'basic-crud-coverage',
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
            suggestions: ['Fix domain entity coverage issues before running CRUD tests']
          }],
          syncStates: [],
          error: new Error('Coverage validation failed'),
          metadata: {
            coverageValidation,
            coverageReport,
            message: 'Fix domain entity coverage issues before running CRUD tests'
          }
        };
      }
      
      log(15, '✅ COVERAGE VALIDATION PASSED - Proceeding with CRUD tests...');
      
      // STEP 3: Create comprehensive test dataset using validated generator
      log(20, '📊 Creating comprehensive test dataset...');
      const testSuiteResults = await generator.runDomainTestSuiteWithValidation({
        entities: ['users', 'projects', 'tasks', 'comments'],
        counts: { users: 5, projects: 3, tasks: 8, comments: 12 },
        includeJoinTables: true,
        includeEdgeCases: false,
        skipValidation: true // Already validated in step 1
      });

      if (!testSuiteResults.dataset) {
        throw new Error('Failed to generate test dataset');
      }

      const { dataset, joinTables, statistics } = testSuiteResults;
      
      log(30, `✅ Generated test data: ${dataset.users?.length || 0} users, ${dataset.projects?.length || 0} projects, ${dataset.tasks?.length || 0} tasks, ${dataset.comments?.length || 0} comments`);
      console.log(`   Join Tables: ${Object.keys(joinTables || {}).length}`);

      // STEP 4: Enhanced CRUD test steps with comprehensive sync monitoring
      log(35, '🔄 Setting up CRUD operations with sync validation...');
      
      const crudSteps = this.createEnhancedTestSteps({
        id: 'crud-test',
        name: 'CRUD Operations',
        description: 'Test CRUD operations with generated data',
        type: 'single_entity_crud',
        entity: 'tasks',
        operations: ['insert', 'update', 'delete'],
        dataVariations: { minimal: true, complete: true, edge: false, invalid: false },
        validation: { immediate: true, eventual: true, state: true },
        enabled: true,
        timeout: 30000,
        retries: 0,
        cleanupAfterTest: true,
        tags: ['basic', 'crud']
      });
      
      // Create test context
      const context: TestExecutionContext = {
        config: {
          id: 'crud-test',
          name: 'CRUD Operations',
          description: 'Test CRUD operations with generated data',
          type: 'single_entity_crud',
          entity: 'tasks',
          operations: ['insert', 'update', 'delete'],
          dataVariations: { minimal: true, complete: true, edge: false, invalid: false },
          validation: { immediate: true, eventual: true, state: true },
          enabled: true,
          timeout: 30000,
          retries: 0,
          cleanupAfterTest: true,
          tags: ['basic', 'crud']
        },
        startTime,
        currentPhase: 'execution',
        status: 'running',
        progress: 50,
        metadata: { dataset, joinTables, statistics }
      };

      // Execute test steps with granular progress reporting
      const stepResults: TestStepResult[] = [];
      const baseProgress = 40;
      const stepProgressRange = 50; // 40-90% for steps
      
      for (let i = 0; i < crudSteps.length; i++) {
        const step = crudSteps[i];
        const stepProgress = baseProgress + Math.round((i / crudSteps.length) * stepProgressRange);
        
        log(stepProgress, `🔧 ${step.description}`);
        
        // Provide detailed sub-step logging for each operation
        if (step.id.includes('insert')) {
          log(stepProgress + 2, `🏗️ Creating new ${(context.config as EntityTestConfig).entity} entity with relationships...`);
        } else if (step.id.includes('update')) {
          log(stepProgress + 2, `✏️ Updating existing ${(context.config as EntityTestConfig).entity} entity with new data...`);
        } else if (step.id.includes('delete')) {
          log(stepProgress + 2, `🗑️ Deleting ${(context.config as EntityTestConfig).entity} entity and validating cleanup...`);
        } else if (step.id === 'setup') {
          log(stepProgress + 2, `🔧 Setting up test environment and generating test data...`);
        } else if (step.id === 'comprehensive-sync-validation') {
          log(stepProgress + 2, `🔍 Running comprehensive sync validation across all operations...`);
        }
        
        const stepResult = await step.execute(context);
        stepResults.push(stepResult);
        
        if (stepResult.success) {
          const successProgress = stepProgress + Math.round(stepProgressRange / crudSteps.length / 2);
          if (step.id.includes('insert')) {
            log(successProgress, `✅ CREATE operation completed - Entity created and sync validated`);
          } else if (step.id.includes('update')) {
            log(successProgress, `✅ UPDATE operation completed - Entity updated and sync validated`);
          } else if (step.id.includes('delete')) {
            log(successProgress, `✅ DELETE operation completed - Entity deleted and sync validated`);
          } else if (step.id === 'setup') {
            log(successProgress, `✅ Test setup completed - Environment ready with generated data`);
          } else if (step.id === 'comprehensive-sync-validation') {
            log(successProgress, `✅ Comprehensive sync validation completed successfully`);
          } else {
            log(successProgress, `✅ ${step.name} completed successfully`);
          }
        } else {
          log(stepProgress, `❌ ${step.name} failed: ${stepResult.error?.message || 'Unknown error'}`);
          throw stepResult.error || new Error(`Step ${step.name} failed`);
        }
      }

      // STEP 5: Comprehensive sync validation across all operations
      log(90, '✅ Performing comprehensive sync validation...');
      const validationResult = await this.validateComprehensiveSyncResult(context, {
        success: true,
        duration: Date.now() - startTime,
        metadata: { dataset, joinTables, statistics }
      });

      const endTime = Date.now();
      log(100, `🎉 Basic CRUD Tests completed successfully in ${endTime - startTime}ms`);

      return {
        id: testId,
        configId: 'basic-crud-coverage',
        status: validationResult.status,
        success: validationResult.status === 'passed',
        startTime,
        endTime,
        duration: endTime - startTime,
        steps: stepResults,
        validations: [validationResult],
        syncStates: [this.framework.getCurrentSyncState()],
        metadata: {
          coverageValidation,
          testDataStatistics: statistics,
          joinTableOperations: joinTables,
          syncValidation: validationResult,
          operations: crudSteps.length
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(0, `❌ Basic CRUD Tests failed: ${errorMessage}`);
      console.error('❌ Basic CRUD Tests failed:', errorMessage);
      const endTime = Date.now();
      
      return {
        id: testId,
        configId: 'basic-crud-coverage',
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
} 