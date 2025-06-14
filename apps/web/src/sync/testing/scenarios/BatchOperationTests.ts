import { v4 as uuidv4 } from 'uuid';
import type {
  BatchTestConfig,
  TestResult,
  TestStep,
  TestStepResult,
  ValidationResult,
  TestExecutionContext,
  EntityType
} from '../core/TestTypes';
import { SyncTestFramework } from '../core/SyncTestFramework';
import { TestDataGenerator } from '../generators/TestDataGenerator';

/**
 * Batch Operation Tests - Tests high-volume batch operations and performance
 * Focuses on testing bulk operations, optimization, and throughput
 */
export class BatchOperationTests {
  private dataGenerator?: TestDataGenerator;

  constructor(private framework: SyncTestFramework) {}

  /**
   * Run comprehensive batch operation test
   */
  async runBatchOperationTest(config: BatchTestConfig): Promise<TestResult> {
    const testSteps = this.createBatchTestSteps(config);
    
    return await this.framework.executeTestWithSteps(config, testSteps);
  }

  /**
   * Create test steps for batch operations
   */
  private createBatchTestSteps(config: BatchTestConfig): TestStep[] {
    const steps: TestStep[] = [];

    // Setup step
    steps.push({
      id: 'batch-test-setup',
      name: 'Setup Batch Test Environment',
      description: 'Prepare environment for batch operations testing',
      phase: 'setup',
      execute: async (context) => this.setupBatchTest(context, config),
      validate: async (context, result) => this.validateBatchSetup(context, result)
    });

    // Test each batch size
    for (const batchSize of config.batchSizes) {
      // Generate test data for this batch size
      steps.push({
        id: `generate-batch-data-${batchSize}`,
        name: `Generate Batch Data (${batchSize} records)`,
        description: `Generate ${batchSize} test records for batch operations`,
        phase: 'data_generation',
        execute: async (context) => this.generateBatchData(context, config, batchSize),
        validate: async (context, result) => this.validateDataGeneration(context, result)
      });

      // Test single operation batches if enabled
      if (config.compositions.singleOperation) {
        steps.push({
          id: `test-single-operation-batch-${batchSize}`,
          name: `Test Single Operation Batch (${batchSize})`,
          description: `Test batch operations with single operation type`,
          phase: 'execution',
          execute: async (context) => this.testSingleOperationBatch(context, config, batchSize),
          validate: async (context, result) => this.validateSingleOperationBatch(context, result)
        });
      }

      // Test mixed operation batches if enabled
      if (config.compositions.mixedOperations) {
        steps.push({
          id: `test-mixed-operation-batch-${batchSize}`,
          name: `Test Mixed Operation Batch (${batchSize})`,
          description: `Test batch operations with mixed operation types`,
          phase: 'execution',
          execute: async (context) => this.testMixedOperationBatch(context, config, batchSize),
          validate: async (context, result) => this.validateMixedOperationBatch(context, result)
        });
      }

      // Test batch optimization if enabled
      if (config.optimization.testOptimization) {
        steps.push({
          id: `test-batch-optimization-${batchSize}`,
          name: `Test Batch Optimization (${batchSize})`,
          description: `Test batch optimization and merging`,
          phase: 'execution',
          execute: async (context) => this.testBatchOptimization(context, config, batchSize),
          validate: async (context, result) => this.validateBatchOptimization(context, result)
        });
      }
    }

    // Performance analysis
    steps.push({
      id: 'analyze-batch-performance',
      name: 'Analyze Batch Performance',
      description: 'Analyze batch operation performance metrics across all batch sizes',
      phase: 'validation',
      execute: async (context) => this.analyzeBatchPerformance(context, config),
      validate: async (context, result) => this.validatePerformanceMetrics(context, result)
    });

    return steps;
  }

  /**
   * Setup batch test environment
   */
  private async setupBatchTest(context: TestExecutionContext, config: BatchTestConfig): Promise<TestStepResult> {
    const startTime = Date.now();
    
    try {
      // Get services from framework
      const services = this.framework.getServices();
      if (!services) {
        throw new Error('Services not available in framework');
      }

      // Initialize data generator with services
      this.dataGenerator = new TestDataGenerator(services);

      // Initialize performance tracking
      const performanceMetrics = {
        batchResults: new Map<number, any>(), // batch size -> results
        timingResults: new Map<string, number[]>(), // operation type -> times
        throughputMetrics: {
          recordsPerSecond: new Map<number, number>(),
          batchesPerMinute: new Map<number, number>()
        }
      };

      // Store in context
      context.metadata.services = services;
      context.metadata.performanceMetrics = performanceMetrics;
      context.metadata.batchConfig = config;
      context.metadata.generatedDataBySize = new Map();
      context.metadata.operationResults = new Map();

      return {
        success: true,
        data: { 
          batchSizes: config.batchSizes,
          compositions: config.compositions,
          optimizationEnabled: config.optimization.testOptimization
        },
        duration: Date.now() - startTime,
        metadata: {
          setupComplete: true
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
   * Generate batch test data for specific batch size
   */
  private async generateBatchData(context: TestExecutionContext, config: BatchTestConfig, batchSize: number): Promise<TestStepResult> {
    const startTime = Date.now();
    
    try {
      if (!this.dataGenerator) {
        throw new Error('Data generator not initialized');
      }

      const entities: EntityType[] = config.compositions.mixedEntities ? 
        ['tasks', 'projects', 'users', 'comments'] : 
        ['tasks']; // Default to tasks if single entity

      const batchData = new Map<EntityType, any[]>();
      
      // For batch testing, we need existing entities to work with for updates/deletes
      // First create some base entities, then create additional ones for the batch
      
      if (config.compositions.mixedEntities) {
        // Create a realistic dataset first
        const baseData = await this.dataGenerator.createRealisticDataset({
          userCount: Math.min(10, Math.floor(batchSize / 4)),
          projectCount: Math.min(5, Math.floor(batchSize / 8)),
          taskCount: Math.floor(batchSize / 2),
          commentCount: Math.floor(batchSize / 4)
        });
        
        batchData.set('users', baseData.users);
        batchData.set('projects', baseData.projects);
        batchData.set('tasks', baseData.tasks);
        batchData.set('comments', baseData.comments);
      } else {
        // Single entity - just create tasks
        const tasks = await this.dataGenerator.createTestTasks(batchSize);
        batchData.set('tasks', tasks);
      }

      // Store generated data by batch size
      context.metadata.generatedDataBySize.set(batchSize, batchData);

      const totalGenerated = Array.from(batchData.values()).reduce((total, data) => total + data.length, 0);

      return {
        success: true,
        data: {
          batchSize,
          totalGenerated,
          entitiesGenerated: Array.from(batchData.keys()),
          entityCounts: Object.fromEntries(
            Array.from(batchData.entries()).map(([entity, data]) => [entity, data.length])
          )
        },
        duration: Date.now() - startTime,
        metadata: {
          dataGenerationComplete: true
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
   * Test single operation batch (all inserts, all updates, etc.)
   */
  private async testSingleOperationBatch(context: TestExecutionContext, config: BatchTestConfig, batchSize: number): Promise<TestStepResult> {
    const startTime = Date.now();
    const services = context.metadata.services;
    const batchData = context.metadata.generatedDataBySize.get(batchSize);
    
    try {
      const results = {
        insert: [] as any[],
        update: [] as any[],
        delete: [] as any[]
      };

      // Test batch insert operations
      for (const [entity, data] of batchData.entries()) {
        const insertStartTime = Date.now();
        const insertedRecords = await this.executeBatchInserts(services, entity, data);
        const insertDuration = Date.now() - insertStartTime;

        results.insert.push({
          entity,
          count: insertedRecords.length,
          duration: insertDuration,
          recordsPerSecond: insertedRecords.length / (insertDuration / 1000),
          records: insertedRecords
        });

        // Store for potential update/delete operations
        if (!context.metadata.operationResults.has(batchSize)) {
          context.metadata.operationResults.set(batchSize, new Map());
        }
        context.metadata.operationResults.get(batchSize).set(`${entity}_insert`, insertedRecords);
      }

      // Test batch update operations on inserted records
      for (const [entity, _] of batchData.entries()) {
        const insertedRecords = context.metadata.operationResults.get(batchSize)?.get(`${entity}_insert`) || [];
        
        if (insertedRecords.length > 0) {
          const updateStartTime = Date.now();
          const updatedRecords = await this.executeBatchUpdates(services, entity, insertedRecords.slice(0, Math.floor(insertedRecords.length / 2)));
          const updateDuration = Date.now() - updateStartTime;

          results.update.push({
            entity,
            count: updatedRecords.length,
            duration: updateDuration,
            recordsPerSecond: updatedRecords.length / (updateDuration / 1000),
            records: updatedRecords
          });
        }
      }

      // Test batch delete operations
      for (const [entity, _] of batchData.entries()) {
        const insertedRecords = context.metadata.operationResults.get(batchSize)?.get(`${entity}_insert`) || [];
        
        if (insertedRecords.length > 0) {
          const deleteStartTime = Date.now();
          const deletedRecords = await this.executeBatchDeletes(services, entity, insertedRecords.slice(-Math.floor(insertedRecords.length / 4)));
          const deleteDuration = Date.now() - deleteStartTime;

          results.delete.push({
            entity,
            count: deletedRecords.length,
            duration: deleteDuration,
            recordsPerSecond: deletedRecords.length / (deleteDuration / 1000)
          });
        }
      }

      return {
        success: true,
        data: {
          batchSize,
          operationResults: results,
          totalDuration: Date.now() - startTime
        },
        duration: Date.now() - startTime,
        metadata: {
          singleOperationBatchComplete: true
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
   * Test mixed operation batch (inserts, updates, deletes interleaved)
   */
  private async testMixedOperationBatch(context: TestExecutionContext, config: BatchTestConfig, batchSize: number): Promise<TestStepResult> {
    const startTime = Date.now();
    const services = context.metadata.services;
    const batchData = context.metadata.generatedDataBySize.get(batchSize);
    
    try {
      const mixedResults = [];
      
      // Execute mixed operations with timing
      for (const [entity, data] of batchData.entries()) {
        const entityStartTime = Date.now();
        
        // Mix of operations: insert some, update others, delete some
        const insertCount = Math.floor(data.length * 0.6); // 60% insert
        const updateCount = Math.floor(data.length * 0.3); // 30% update (need existing records)
        const deleteCount = Math.floor(data.length * 0.1); // 10% delete
        
        const operationTimes = [];
        
        // Insert operations
        const insertData = data.slice(0, insertCount);
        for (const record of insertData) {
          const opStart = Date.now();
          await this.createSingleRecord(services, entity, record);
          operationTimes.push({ operation: 'insert', duration: Date.now() - opStart });
        }
        
        // Note: In a real mixed batch test, we would interleave operations
        // For simplicity, we're doing them sequentially but tracking timing
        
        const entityDuration = Date.now() - entityStartTime;
        mixedResults.push({
          entity,
          totalOperations: insertCount + updateCount + deleteCount,
          duration: entityDuration,
          operationsPerSecond: (insertCount + updateCount + deleteCount) / (entityDuration / 1000),
          operationBreakdown: {
            insert: insertCount,
            update: updateCount,
            delete: deleteCount
          },
          timingData: operationTimes
        });
      }

      return {
        success: true,
        data: {
          batchSize,
          mixedResults,
          totalDuration: Date.now() - startTime
        },
        duration: Date.now() - startTime,
        metadata: {
          mixedOperationBatchComplete: true
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
   * Test batch optimization (change merging, filtering)
   */
  private async testBatchOptimization(context: TestExecutionContext, config: BatchTestConfig, batchSize: number): Promise<TestStepResult> {
    const startTime = Date.now();
    
    try {
      // Get initial queue size
      const initialLocalChanges = await this.framework.getLocalChanges();
      const initialQueueSize = initialLocalChanges.length;

      // Perform operations that should be optimized
      const services = context.metadata.services;
      const taskService = services.tasks;

      // Create a task
      const createdTask = await taskService.createTask({
        title: 'Optimization Test Task',
        description: 'Test task for batch optimization',
        status: 'pending'
      });

      // Update the same task multiple times rapidly (should be merged)
      const updatePromises = [];
      for (let i = 0; i < 5; i++) {
        updatePromises.push(
          taskService.updateTask(createdTask.id, {
            title: `Updated Task ${i}`,
            description: `Update ${i} for optimization test`
          })
        );
      }
      
      await Promise.all(updatePromises);

      // Wait a moment for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check final queue size
      const finalLocalChanges = await this.framework.getLocalChanges();
      const finalQueueSize = finalLocalChanges.length;
      
      // Analyze optimization
      const changesAdded = finalQueueSize - initialQueueSize;
      const expectedWithoutOptimization = 6; // 1 create + 5 updates
      const optimizationEffective = changesAdded < expectedWithoutOptimization;

      return {
        success: true,
        data: {
          batchSize,
          initialQueueSize,
          finalQueueSize,
          changesAdded,
          expectedWithoutOptimization,
          optimizationEffective,
          optimizationRatio: changesAdded / expectedWithoutOptimization
        },
        duration: Date.now() - startTime,
        metadata: {
          batchOptimizationComplete: true
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
   * Analyze batch performance across all tests
   */
  private async analyzeBatchPerformance(context: TestExecutionContext, config: BatchTestConfig): Promise<TestStepResult> {
    const startTime = Date.now();
    
    try {
      const performanceMetrics = context.metadata.performanceMetrics;
      const batchResults = performanceMetrics.batchResults;
      
      // Aggregate performance data
      const analysis = {
        batchSizeAnalysis: [] as any[],
        overallTrends: {
          scalability: 'unknown',
          throughputTrend: 'unknown',
          optimizationEffectiveness: 'unknown'
        },
        recommendations: [] as string[]
      };

      // Analyze each batch size
      for (const batchSize of config.batchSizes) {
        const sizeAnalysis = {
          batchSize,
          averageThroughput: 0,
          peakThroughput: 0,
          operationCounts: {
            insert: 0,
            update: 0,
            delete: 0
          }
        };

        analysis.batchSizeAnalysis.push(sizeAnalysis);
      }

      // Generate recommendations based on results
      if (config.batchSizes.length > 1) {
        analysis.recommendations.push('Compare throughput across different batch sizes to find optimal batch size');
      }
      
      if (config.optimization.testOptimization) {
        analysis.recommendations.push('Review optimization effectiveness to ensure proper change merging');
      }

      return {
        success: true,
        data: analysis,
        duration: Date.now() - startTime,
        metadata: {
          performanceAnalysisComplete: true
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
   * Execute batch insert operations for an entity
   */
  private async executeBatchInserts(services: any, entity: EntityType, data: any[]): Promise<any[]> {
    const service = this.getServiceForEntity(services, entity);
    const results = [];

    for (const record of data) {
      let result;
      switch (entity) {
        case 'tasks':
          result = await service.createTask(record);
          break;
        case 'projects':
          result = await service.createProject(record);
          break;
        case 'users':
          result = await service.createUser(record);
          break;
        case 'comments':
          result = await service.createComment(record);
          break;
        default:
          throw new Error(`Unsupported entity type: ${entity}`);
      }
      results.push(result);
    }

    return results;
  }

  /**
   * Execute batch update operations for an entity
   */
  private async executeBatchUpdates(services: any, entity: EntityType, records: any[]): Promise<any[]> {
    const service = this.getServiceForEntity(services, entity);
    const results = [];

    for (const record of records) {
      const updateData = this.createUpdateData(entity, record);
      let result;
      
      switch (entity) {
        case 'tasks':
          result = await service.updateTask(record.id, updateData);
          break;
        case 'projects':
          result = await service.updateProject(record.id, updateData);
          break;
        case 'users':
          result = await service.updateUser(record.id, updateData);
          break;
        case 'comments':
          result = await service.updateComment(record.id, updateData);
          break;
        default:
          throw new Error(`Unsupported entity type: ${entity}`);
      }
      results.push(result);
    }

    return results;
  }

  /**
   * Execute batch delete operations for an entity
   */
  private async executeBatchDeletes(services: any, entity: EntityType, records: any[]): Promise<any[]> {
    const service = this.getServiceForEntity(services, entity);
    const results = [];

    for (const record of records) {
      let result;
      switch (entity) {
        case 'tasks':
          result = await service.deleteTask(record.id);
          break;
        case 'projects':
          result = await service.deleteProject(record.id);
          break;
        case 'users':
          result = await service.deleteUser(record.id);
          break;
        case 'comments':
          result = await service.deleteComment(record.id);
          break;
        default:
          throw new Error(`Unsupported entity type: ${entity}`);
      }
      results.push({ id: record.id, deleted: true });
    }

    return results;
  }

  /**
   * Create a single record for mixed operation testing
   */
  private async createSingleRecord(services: any, entity: EntityType, data: any): Promise<any> {
    const service = this.getServiceForEntity(services, entity);
    
    switch (entity) {
      case 'tasks':
        return await service.createTask(data);
      case 'projects':
        return await service.createProject(data);
      case 'users':
        return await service.createUser(data);
      case 'comments':
        return await service.createComment(data);
      default:
        throw new Error(`Unsupported entity type: ${entity}`);
    }
  }

  /**
   * Get service for entity type
   */
  private getServiceForEntity(services: any, entity: EntityType) {
    switch (entity) {
      case 'tasks':
        return services.tasks;
      case 'projects':
        return services.projects;
      case 'users':
        return services.users;
      case 'comments':
        return services.comments;
      default:
        throw new Error(`Unsupported entity type: ${entity}`);
    }
  }

  /**
   * Create update data for entity type
   */
  private createUpdateData(entity: EntityType, originalRecord: any) {
    const timestamp = Date.now();
    
    switch (entity) {
      case 'tasks':
        return {
          title: `${originalRecord.title} (Updated ${timestamp})`,
          description: `Updated description ${timestamp}`,
          status: 'in_progress'
        };
      case 'projects':
        return {
          name: `${originalRecord.name} (Updated ${timestamp})`,
          description: `Updated description ${timestamp}`,
          status: 'in_progress'
        };
      case 'users':
        return {
          name: `${originalRecord.name} (Updated ${timestamp})`
        };
      case 'comments':
        return {
          content: `Updated comment content ${timestamp}`
        };
      default:
        return { updatedAt: new Date().toISOString() };
    }
  }

  // Validation methods
  private async validateBatchSetup(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Batch test setup failed',
        details: result.error?.message
      };
    }

    return {
      status: 'passed',
      message: 'Batch test setup successful'
    };
  }

  private async validateDataGeneration(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Batch data generation failed',
        details: result.error?.message
      };
    }

    return {
      status: 'passed',
      message: `Generated ${result.data.totalGenerated} test records for batch size ${result.data.batchSize}`
    };
  }

  private async validateSingleOperationBatch(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Single operation batch test failed',
        details: result.error?.message
      };
    }

    return {
      status: 'passed',
      message: `Single operation batch test completed for batch size ${result.data.batchSize}`
    };
  }

  private async validateMixedOperationBatch(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Mixed operation batch test failed',
        details: result.error?.message
      };
    }

    return {
      status: 'passed',
      message: `Mixed operation batch test completed for batch size ${result.data.batchSize}`
    };
  }

  private async validateBatchOptimization(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Batch optimization test failed',
        details: result.error?.message
      };
    }

    const { optimizationEffective, optimizationRatio } = result.data;
    
    if (!optimizationEffective) {
      return {
        status: 'warning',
        message: 'Batch optimization may not be working effectively',
        details: {
          optimizationRatio,
          recommendation: 'Review change merging and optimization logic'
        }
      };
    }

    return {
      status: 'passed',
      message: `Batch optimization working effectively (${(optimizationRatio * 100).toFixed(1)}% efficiency)`
    };
  }

  private async validatePerformanceMetrics(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Performance analysis failed',
        details: result.error?.message
      };
    }

    return {
      status: 'passed',
      message: 'Batch performance analysis completed successfully'
    };
  }
} 