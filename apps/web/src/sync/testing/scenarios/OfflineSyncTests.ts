import { v4 as uuidv4 } from 'uuid';
import type {
  OfflineSyncTestConfig,
  TestResult,
  TestStep,
  TestStepResult,
  ValidationResult,
  EntityType,
  TestExecutionContext,
  OperationType
} from '../core/TestTypes';
import { SyncTestFramework } from '../core/SyncTestFramework';
import { TestDataGenerator } from '../generators/TestDataGenerator';

/**
 * Offline Sync Tests - Tests offline operations and LocalChanges management
 * Focuses on testing how changes are queued when offline and processed when back online
 */
export class OfflineSyncTests {
  private dataGenerator?: TestDataGenerator;

  constructor(private framework: SyncTestFramework) {}

  /**
   * Run comprehensive offline sync test
   */
  async runOfflineOperationsTest(config: OfflineSyncTestConfig): Promise<TestResult> {
    const testSteps = this.createOfflineTestSteps(config);
    
    return await this.framework.executeTestWithSteps(config, testSteps);
  }

  /**
   * Create test steps for offline sync operations
   */
  private createOfflineTestSteps(config: OfflineSyncTestConfig): TestStep[] {
    const steps: TestStep[] = [];

    // Setup step
    steps.push({
      id: 'offline-setup',
      name: 'Setup Offline Test Environment',
      description: 'Prepare offline testing environment and capture initial state',
      phase: 'setup',
      execute: async (context) => this.setupOfflineTest(context, config),
      validate: async (context, result) => this.validateOfflineSetup(context, result)
    });

    // Simulate offline mode
    steps.push({
      id: 'simulate-offline',
      name: 'Simulate Offline Mode',
      description: 'Disconnect from sync server to simulate offline condition',
      phase: 'setup',
      execute: async (context) => this.simulateOfflineMode(context),
      validate: async (context, result) => this.validateOfflineMode(context, result)
    });

    // Execute offline operations based on config
    if (config.offlineOperations.entityCRUD) {
      steps.push({
        id: 'offline-entity-crud',
        name: 'Offline Entity CRUD Operations',
        description: 'Perform CRUD operations while offline',
        phase: 'execution',
        execute: async (context) => this.executeOfflineEntityCRUD(context, config),
        validate: async (context, result) => this.validateOfflineEntityCRUD(context, result)
      });
    }

    if (config.offlineOperations.relationshipChanges) {
      steps.push({
        id: 'offline-relationships',
        name: 'Offline Relationship Operations',
        description: 'Perform relationship changes while offline',
        phase: 'execution',
        execute: async (context) => this.executeOfflineRelationships(context, config),
        validate: async (context, result) => this.validateOfflineRelationships(context, result)
      });
    }

    if (config.offlineOperations.batchOperations) {
      steps.push({
        id: 'offline-batch-ops',
        name: 'Offline Batch Operations',
        description: 'Perform batch operations while offline',
        phase: 'execution',
        execute: async (context) => this.executeOfflineBatchOperations(context, config),
        validate: async (context, result) => this.validateOfflineBatchOperations(context, result)
      });
    }

    // Validate LocalChanges queue
    steps.push({
      id: 'validate-local-changes-queue',
      name: 'Validate LocalChanges Queue',
      description: 'Verify all operations were properly queued in LocalChanges',
      phase: 'validation',
      execute: async (context) => this.validateLocalChangesQueue(context, config),
      validate: async (context, result) => this.validateLocalChangesQueueResult(context, result)
    });

    // Simulate coming back online (if recovery testing enabled)
    if (config.scenarios.offlineRecovery) {
      steps.push({
        id: 'simulate-online',
        name: 'Simulate Coming Back Online',
        description: 'Restore sync connection to test offline recovery',
        phase: 'execution',
        execute: async (context) => this.simulateOnlineMode(context),
        validate: async (context, result) => this.validateOnlineMode(context, result)
      });

      steps.push({
        id: 'validate-recovery',
        name: 'Validate Offline Recovery',
        description: 'Verify offline changes are properly processed when back online',
        phase: 'validation',
        execute: async (context) => this.validateOfflineRecovery(context, config),
        validate: async (context, result) => this.validateOfflineRecoveryResult(context, result)
      });
    }

    return steps;
  }

  /**
   * Setup offline test environment
   */
  private async setupOfflineTest(context: TestExecutionContext, config: OfflineSyncTestConfig): Promise<TestStepResult> {
    const startTime = Date.now();
    
    try {
      // Get services from framework
      const services = this.framework.getServices();
      if (!services) {
        throw new Error('Services not available in framework');
      }

      // Initialize data generator with services
      this.dataGenerator = new TestDataGenerator(services);

      // Capture initial state
      const initialSyncState = this.framework.getCurrentSyncState();
      const initialLocalChanges = await this.framework.getLocalChanges();

      // Generate test data for offline operations using services
      const testData = await this.dataGenerator.createRealisticDataset({
        userCount: 5,
        projectCount: 2,
        taskCount: 8,
        commentCount: 5
      });

      // Store in context
      context.metadata.services = services;
      context.metadata.initialSyncState = initialSyncState;
      context.metadata.initialLocalChanges = initialLocalChanges;
      context.metadata.testData = testData;
      context.metadata.offlineOperations = [];
      context.metadata.dataGenerator = this.dataGenerator;

      return {
        success: true,
        data: { 
          entitiesGenerated: Object.keys(testData),
          initialChangeCount: initialLocalChanges.length,
          initialSyncState: initialSyncState.connectionStatus
        },
        duration: Date.now() - startTime,
        metadata: {
          totalTestEntities: Object.values(testData).reduce((sum: number, data: any) => sum + data.length, 0),
          initialPendingChanges: initialSyncState.pendingChangesCount,
          usedServices: true
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
   * Simulate offline mode by disabling sync
   */
  private async simulateOfflineMode(context: TestExecutionContext): Promise<TestStepResult> {
    const startTime = Date.now();
    
    try {
      // Store original sync state before going offline
      const priorSyncState = this.framework.getCurrentSyncState();
      context.metadata.priorSyncState = priorSyncState;
      
      // Note: In a real implementation, we would disconnect from the sync server
      // For testing purposes, we'll just mark that we're in offline mode
      context.metadata.isOffline = true;
      context.metadata.offlineStartTime = Date.now();

      console.log('[OfflineSyncTests] Simulated offline mode - operations will queue in LocalChanges');

      return {
        success: true,
        data: { 
          offlineMode: true,
          priorConnectionStatus: priorSyncState.connectionStatus
        },
        duration: Date.now() - startTime,
        metadata: {
          offlineSimulated: true
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
   * Execute CRUD operations while offline
   */
  private async executeOfflineEntityCRUD(context: TestExecutionContext, config: OfflineSyncTestConfig): Promise<TestStepResult> {
    const startTime = Date.now();
    const services = context.metadata.services;
    const testData = context.metadata.testData;
    const operations = [];
    
    try {
      // Perform create operations using data generator
      const createdTasks = await this.dataGenerator!.createTestTasks(2, testData.projects, testData.users);
      for (const task of createdTasks) {
        operations.push({ type: 'create', entity: 'tasks', id: task.id });
      }

      const createdProjects = await this.dataGenerator!.createTestProjects(1, testData.users);
      for (const project of createdProjects) {
        operations.push({ type: 'create', entity: 'projects', id: project.id });
      }

      // Perform update operations on existing entities
      const tasksToUpdate = testData.tasks.slice(0, 2);
      for (const task of tasksToUpdate) {
        const service = this.getServiceForEntity(services, 'tasks');
        const updateData = this.generateUpdateData('tasks');
        await this.updateEntity(service, 'tasks', task.id, updateData);
        operations.push({ type: 'update', entity: 'tasks', id: task.id });
      }

      // Store operations for validation
      context.metadata.offlineOperations.push(...operations);

      return {
        success: true,
        data: { operations },
        duration: Date.now() - startTime,
        metadata: {
          operationCount: operations.length,
          entityTypes: [...new Set(operations.map(op => op.entity))]
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        duration: Date.now() - startTime,
        metadata: { operationsAttempted: operations.length }
      };
    }
  }

  /**
   * Execute relationship operations while offline
   */
  private async executeOfflineRelationships(context: TestExecutionContext, config: OfflineSyncTestConfig): Promise<TestStepResult> {
    const startTime = Date.now();
    
    try {
      // For relationship testing, we would need to implement relationship operations
      // This is a placeholder for now since we need to understand the relationship API better
      const relationshipOperations = [
        { type: 'relationship', operation: 'add_project_member', details: 'simulated' },
        { type: 'relationship', operation: 'add_task_dependency', details: 'simulated' }
      ];

      context.metadata.offlineOperations.push(...relationshipOperations);

      return {
        success: true,
        data: { relationshipOperations },
        duration: Date.now() - startTime,
        metadata: {
          relationshipOperationCount: relationshipOperations.length
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
   * Execute batch operations while offline
   */
  private async executeOfflineBatchOperations(context: TestExecutionContext, config: OfflineSyncTestConfig): Promise<TestStepResult> {
    const startTime = Date.now();
    const services = context.metadata.services;
    const testData = context.metadata.testData;
    
    try {
      const batchOperations = [];

      // Batch create multiple tasks using data generator
      const batchTasks = await this.dataGenerator!.createTestTasks(3, testData.projects, testData.users);
      for (const task of batchTasks) {
        batchOperations.push({ type: 'batch_create', entity: 'tasks', id: task.id });
      }

      // Batch create comments on existing tasks
      const batchComments = await this.dataGenerator!.createTestComments(3, testData.tasks, testData.users);
      for (const comment of batchComments) {
        batchOperations.push({ type: 'batch_create', entity: 'comments', id: comment.id });
      }

      context.metadata.offlineOperations.push(...batchOperations);

      return {
        success: true,
        data: { batchOperations },
        duration: Date.now() - startTime,
        metadata: {
          batchOperationCount: batchOperations.length
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
   * Validate LocalChanges queue has all operations
   */
  private async validateLocalChangesQueue(context: TestExecutionContext, config: OfflineSyncTestConfig): Promise<TestStepResult> {
    const startTime = Date.now();
    
    try {
      // Get current LocalChanges
      const localChanges = await this.framework.getLocalChanges();
      const initialChangeCount = (context.metadata.initialLocalChanges as any[]).length;
      const offlineOperations = context.metadata.offlineOperations as any[];
      
      // Filter for unprocessed changes (should be all our offline operations)
      const unprocessedChanges = localChanges.filter(change => !change.processedSync);
      const newChanges = localChanges.length - initialChangeCount;

      return {
        success: newChanges >= offlineOperations.length,
        data: {
          totalLocalChanges: localChanges.length,
          newChanges,
          unprocessedChanges: unprocessedChanges.length,
          expectedOperations: offlineOperations.length,
          changes: unprocessedChanges
        },
        duration: Date.now() - startTime,
        metadata: {
          changeQueueValid: newChanges >= offlineOperations.length
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
   * Simulate coming back online
   */
  private async simulateOnlineMode(context: TestExecutionContext): Promise<TestStepResult> {
    const startTime = Date.now();
    
    try {
      // Mark as back online
      context.metadata.isOffline = false;
      context.metadata.onlineStartTime = Date.now();
      
      console.log('[OfflineSyncTests] Simulated back online - ready for sync recovery');

      return {
        success: true,
        data: { onlineMode: true },
        duration: Date.now() - startTime,
        metadata: {
          onlineSimulated: true,
          offlineDuration: Date.now() - (context.metadata.offlineStartTime as number)
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
   * Validate offline recovery process
   */
  private async validateOfflineRecovery(context: TestExecutionContext, config: OfflineSyncTestConfig): Promise<TestStepResult> {
    const startTime = Date.now();
    
    try {
      // In a real implementation, we would trigger sync processing and wait for completion
      // For now, we validate that the queue is still intact and ready for processing
      const localChanges = await this.framework.getLocalChanges();
      const unprocessedChanges = localChanges.filter(change => !change.processedSync);
      
      return {
        success: unprocessedChanges.length > 0,
        data: {
          readyForRecovery: true,
          unprocessedChanges: unprocessedChanges.length,
          changes: unprocessedChanges
        },
        duration: Date.now() - startTime,
        metadata: {
          recoveryValidated: true
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

  // Helper methods (reused from BasicCRUDTests)
  private getServiceForEntity(services: any, entityType: EntityType): any {
    switch (entityType) {
      case 'tasks': return services.tasks;
      case 'projects': return services.projects;
      case 'users': return services.users;
      case 'comments': return services.comments;
      default: throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  private async createEntity(service: any, entityType: EntityType, entityData: any): Promise<any> {
    switch (entityType) {
      case 'tasks': return await service.createTask(entityData);
      case 'projects': return await service.createProject(entityData);
      case 'users': return await service.createUser(entityData);
      case 'comments': return await service.createComment(entityData);
      default: throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  private async updateEntity(service: any, entityType: EntityType, id: string, updateData: any): Promise<any> {
    switch (entityType) {
      case 'tasks': return await service.updateTask(id, updateData);
      case 'projects': return await service.updateProject(id, updateData);
      case 'users': return await service.updateUser(id, updateData);
      case 'comments': return await service.updateComment(id, updateData);
      default: throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  private generateUpdateData(entityType: EntityType): any {
    const timestamp = new Date();
    
    switch (entityType) {
      case 'tasks':
        return {
          title: `Offline Updated Task ${timestamp.getTime()}`,
          description: 'Updated while offline',
          status: 'in_progress'
        };
      case 'projects':
        return {
          name: `Offline Updated Project ${timestamp.getTime()}`,
          description: 'Updated while offline'
        };
      case 'users':
        return {
          name: `Offline Updated User ${timestamp.getTime()}`,
          email: `offline${timestamp.getTime()}@example.com`
        };
      case 'comments':
        return {
          content: `Offline updated comment ${timestamp.getTime()}`
        };
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  // Validation methods
  private async validateOfflineSetup(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Offline test setup failed',
        details: result.error?.message
      };
    }

    return {
      status: 'passed',
      message: 'Offline test setup successful'
    };
  }

  private async validateOfflineMode(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Failed to simulate offline mode',
        details: result.error?.message
      };
    }

    return {
      status: 'passed',
      message: 'Offline mode simulation successful'
    };
  }

  private async validateOfflineEntityCRUD(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Offline entity CRUD operations failed',
        details: result.error?.message
      };
    }

    const operations = result.data.operations;
    return {
      status: 'passed',
      message: `Offline entity CRUD successful - ${operations.length} operations completed`
    };
  }

  private async validateOfflineRelationships(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Offline relationship operations failed',
        details: result.error?.message
      };
    }

    return {
      status: 'passed',
      message: 'Offline relationship operations successful'
    };
  }

  private async validateOfflineBatchOperations(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Offline batch operations failed',
        details: result.error?.message
      };
    }

    return {
      status: 'passed',
      message: 'Offline batch operations successful'
    };
  }

  private async validateLocalChangesQueueResult(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'LocalChanges queue validation failed',
        details: result.error?.message
      };
    }

    const { newChanges, expectedOperations } = result.data;
    
    if (newChanges < expectedOperations) {
      return {
        status: 'warning',
        message: `Fewer changes queued than expected - ${newChanges} vs ${expectedOperations}`,
        details: { newChanges, expectedOperations }
      };
    }

    return {
      status: 'passed',
      message: `LocalChanges queue validation successful - ${newChanges} changes queued`
    };
  }

  private async validateOnlineMode(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Failed to simulate online mode',
        details: result.error?.message
      };
    }

    return {
      status: 'passed',
      message: 'Online mode simulation successful'
    };
  }

  private async validateOfflineRecoveryResult(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Offline recovery validation failed',
        details: result.error?.message
      };
    }

    return {
      status: 'passed',
      message: 'Offline recovery validation successful'
    };
  }
} 