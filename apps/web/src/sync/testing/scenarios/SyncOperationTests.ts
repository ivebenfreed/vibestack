import { v4 as uuidv4 } from 'uuid';
import type {
  EntityTestConfig,
  TestResult,
  TestStep,
  TestStepResult,
  ValidationResult,
  EntityType,
  OperationType,
  TestExecutionContext,
  SyncStateSnapshot
} from '../core/TestTypes';
import { SyncTestFramework } from '../core/SyncTestFramework';
import { TestDataGenerator } from '../generators/TestDataGenerator';
import { CRUDSyncValidator } from '../validators/CRUDSyncValidator';
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
  CLIENT_DOMAIN_TABLE_HIERARCHY
} from '@repo/dataforge/client-entities';

interface SyncEvent {
  id: string;
  timestamp: number;
  type: 'operation' | 'localchange' | 'queue' | 'send' | 'ack' | 'error';
  phase: string;
  message: string;
  data?: any;
  operationId?: string;
}

interface SyncOperationTrace {
  operationId: string;
  operation: OperationType;
  entityType: EntityType;
  startTime: number;
  endTime?: number;
  events: SyncEvent[];
  syncStates: SyncStateSnapshot[];
  result?: any;
  success: boolean;
  error?: Error;
}

/**
 * Sync Operation Tests - Complete Sync Process Tracking
 * Tests the full sync operation lifecycle with comprehensive event tracking
 * from operation execution through sync completion
 */
export class SyncOperationTests {
  private dataGenerator?: TestDataGenerator;
  private syncValidator: CRUDSyncValidator;
  private eventListeners: Map<string, Function[]> = new Map();
  private syncTraces: SyncOperationTrace[] = [];

  constructor(private framework: SyncTestFramework) {
    this.syncValidator = new CRUDSyncValidator(framework);
  }

  /**
   * Run sync operation test with complete event tracking
   */
  async runSyncOperationTest(config: EntityTestConfig): Promise<TestResult> {
    const testSteps = this.createSyncOperationTestSteps(config);
    
    return await this.framework.executeTestWithSteps(config, testSteps);
  }

  /**
   * Create test steps for sync operation tracking
   */
  private createSyncOperationTestSteps(config: EntityTestConfig): TestStep[] {
    const steps: TestStep[] = [];

    // Setup step with event monitoring
    steps.push({
      id: 'setup-sync-monitoring',
      name: 'Setup Sync Event Monitoring',
      description: 'Setup sync event listeners and monitoring infrastructure',
      phase: 'setup',
      execute: async (context) => this.setupSyncMonitoring(context, config),
      validate: async (context, result) => this.validateSyncMonitoringSetup(context, result)
    });

    // Create individual test steps for each operation with sequential sync tracking
    config.operations.forEach((operation, index) => {
      // Step 1: Execute the operation
      steps.push({
        id: `${operation}-step1-execute`,
        name: `${operation.toUpperCase()} Step 1: Execute Operation`,
        description: `Execute ${operation} operation and capture initial state`,
        phase: 'execution',
        execute: async (context) => this.executeOperation(context, config, operation),
        validate: async (context, result) => this.validateOperationExecution(context, result, operation)
      });

      // Step 2: Wait for LocalChange creation
      steps.push({
        id: `${operation}-step2-localchange`,
        name: `${operation.toUpperCase()} Step 2: Wait for LocalChange Creation`,
        description: `Wait for LocalChange to be created for ${operation} operation`,
        phase: 'execution',
        execute: async (context) => this.waitForLocalChangeCreation(context, operation),
        validate: async (context, result) => this.validateLocalChangeCreation(context, result, operation)
      });

      // Step 3: Wait for queue processing
      steps.push({
        id: `${operation}-step3-queue`,
        name: `${operation.toUpperCase()} Step 3: Wait for Queue Processing`,
        description: `Wait for sync queue to process ${operation} change`,
        phase: 'execution',
        execute: async (context) => this.waitForQueueProcessing(context, operation),
        validate: async (context, result) => this.validateQueueProcessing(context, result, operation)
      });

      // Step 4: Wait for message sending
      steps.push({
        id: `${operation}-step4-send`,
        name: `${operation.toUpperCase()} Step 4: Wait for Message Sending`,
        description: `Wait for ${operation} change to be sent to server`,
        phase: 'execution',
        execute: async (context) => this.waitForMessageSending(context, operation),
        validate: async (context, result) => this.validateMessageSending(context, result, operation)
      });

      // Step 5: Wait for server acknowledgment
      steps.push({
        id: `${operation}-step5-ack`,
        name: `${operation.toUpperCase()} Step 5: Wait for Server Acknowledgment`,
        description: `Wait for server to acknowledge ${operation} change`,
        phase: 'execution',
        execute: async (context) => this.waitForServerAcknowledgment(context, operation),
        validate: async (context, result) => this.validateServerAcknowledgment(context, result, operation)
      });

      // Step 6: Verify completion
      steps.push({
        id: `${operation}-step6-complete`,
        name: `${operation.toUpperCase()} Step 6: Verify Sync Completion`,
        description: `Verify ${operation} sync cycle is complete`,
        phase: 'execution',
        execute: async (context) => this.verifySyncCompletion(context, operation),
        validate: async (context, result) => this.validateSyncCompletion(context, result, operation)
      });
    });

    // Final comprehensive analysis
    steps.push({
      id: 'final-sync-analysis',
      name: 'Final Sync Analysis',
      description: 'Analyze complete sync behavior across all operations',
      phase: 'validation',
      execute: async (context) => this.executeComprehensiveSyncAnalysis(context, config),
      validate: async (context, result) => this.validateComprehensiveSyncAnalysis(context, result)
    });

    // Domain coverage validation for sync operations
    steps.push({
      id: 'sync-domain-coverage-validation',
      name: 'Sync Domain Coverage Validation',
      description: 'Validate comprehensive coverage of client entity fields, enums, and relations in sync operations',
      phase: 'validation',
      execute: async (context) => this.executeSyncDomainCoverageValidation(context, config),
      validate: async (context, result) => this.validateSyncDomainCoverage(context, result)
    });

    return steps;
  }

  /**
   * Setup sync monitoring with event listeners
   */
  async setupSyncMonitoring(context: TestExecutionContext, config: EntityTestConfig): Promise<TestStepResult> {
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
      context.metadata.syncTraces = [];
      context.metadata.syncEvents = [];

      // Setup sync event monitoring
      await this.setupSyncEventListeners(context);

      // Generate test data
      const testData = await this.generateSyncTestData(config);
      context.metadata.testData = testData;

      // Capture initial sync state
      const initialSyncState = this.framework.getCurrentSyncState();
      context.metadata.initialSyncState = initialSyncState;

      return {
        success: true,
        duration: Date.now() - startTime,
        data: { 
          message: `Sync monitoring setup completed for ${config.entity} entity`,
          initialSyncState
        },
        metadata: {
          servicesAvailable: Object.keys(services).length,
          testDataVariations: Object.keys(testData).length,
          eventListenersRegistered: this.eventListeners.size,
          initialPendingChanges: initialSyncState.pendingChangesCount
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
   * Setup comprehensive sync event listeners
   */
  private async setupSyncEventListeners(context: TestExecutionContext): Promise<void> {
    const services = this.framework.getServices();
    if (!services) return;

    // Get sync manager and event emitter
    const syncManager = (this.framework as any).syncManager;
    if (!syncManager || !syncManager.events) {
      console.warn('[SyncOperationTests] SyncManager or events not available for monitoring');
      return;
    }

    const events = syncManager.events;

    // Track outgoing change events
    const outgoingChangeListener = (data: any) => {
      this.recordSyncEvent(context, {
        type: 'localchange',
        phase: 'created',
        message: `LocalChange created for ${data.table || 'unknown'} ${data.operation || 'unknown'}`,
        data
      });
    };

    // Track queue processing events
    const queueProcessingListener = (data: any) => {
      this.recordSyncEvent(context, {
        type: 'queue',
        phase: 'processing',
        message: `Processing ${data.changeIds?.length || data.numChanges || 'unknown'} changes`,
        data
      });
    };

    // Track message sending events
    const messageSentListener = (data: any) => {
      this.recordSyncEvent(context, {
        type: 'send',
        phase: 'sent',
        message: `Sent ${data.changesCount || data.changeIds?.length || 'unknown'} changes to server`,
        data
      });
    };

    // Track server acknowledgment events
    const serverAckListener = (data: any) => {
      this.recordSyncEvent(context, {
        type: 'ack',
        phase: 'acknowledged',
        message: `Server acknowledged ${data.appliedCount || data.successfullyProcessedLocalChangeIds?.length || 'unknown'} changes`,
        data
      });
    };

    // Track local change completion events
    const localChangeCompleteListener = (data: any) => {
      this.recordSyncEvent(context, {
        type: 'ack',
        phase: 'completed',
        message: `Marked ${data.changeIds?.length || 'unknown'} local changes as processed (${data.reason || 'completed'})`,
        data
      });
    };

    // Track sync state changes
    const stateChangeListener = (state: string) => {
      this.recordSyncEvent(context, {
        type: 'queue',
        phase: 'state_change',
        message: `Sync state changed to: ${state}`,
        data: { state }
      });
    };

    // Track sync errors
    const errorListener = (error: any) => {
      this.recordSyncEvent(context, {
        type: 'error',
        phase: 'error',
        message: `Sync error: ${error.message || String(error)}`,
        data: error
      });
    };

    // Register all event listeners
    const listenersToRegister = [
      { event: 'outgoing_changes_payload_sent', listener: messageSentListener },
      { event: 'outgoing_changes_processed_locally', listener: localChangeCompleteListener },
      { event: 'server_message:srv_changes_applied', listener: serverAckListener },
      { event: 'stateChange', listener: stateChangeListener },
      { event: 'sync:error', listener: errorListener }
    ];

    for (const { event, listener } of listenersToRegister) {
      events.on(event, listener);
      
      // Store for cleanup
      if (!this.eventListeners.has(event)) {
        this.eventListeners.set(event, []);
      }
      this.eventListeners.get(event)!.push(listener);
    }

    console.log(`[SyncOperationTests] Registered ${listenersToRegister.length} sync event listeners`);
  }

  /**
   * Execute sync operation with comprehensive tracking
   */
  private async executeSyncOperation(
    context: TestExecutionContext, 
    config: EntityTestConfig, 
    operation: OperationType
  ): Promise<TestStepResult> {
    const startTime = Date.now();
    const operationId = uuidv4();
    const services = context.metadata.services;
    const testData = context.metadata.testData;
    
    try {
      // Create sync operation trace
      const trace: SyncOperationTrace = {
        operationId,
        operation,
        entityType: config.entity,
        startTime,
        events: [],
        syncStates: [],
        success: false
      };

      // Start tracking this operation
      this.syncTraces.push(trace);
      context.metadata.currentOperationId = operationId;

      // Record operation start event
      this.recordSyncEvent(context, {
        type: 'operation',
        phase: 'start',
        message: `Starting ${operation} operation on ${config.entity}`,
        operationId
      });

      // Capture pre-operation sync state
      const preOpSyncState = this.framework.getCurrentSyncState();
      trace.syncStates.push(preOpSyncState);

      // Get appropriate service for entity type
      const service = this.getServiceForEntity(services, config.entity);

      // Execute the operation using normal service methods (WITH sync tracking)
      let operationResult;
      switch (operation) {
        case 'insert':
          operationResult = await this.createEntityWithSync(service, config.entity, testData, context);
          break;
        case 'update':
          operationResult = await this.updateEntityWithSync(service, config.entity, testData, context);
          break;
        case 'delete':
          operationResult = await this.deleteEntityWithSync(service, config.entity, testData, context);
          break;
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }

      // Record operation completion
      this.recordSyncEvent(context, {
        type: 'operation',
        phase: 'completed',
        message: `${operation} operation completed successfully`,
        data: { operationResult },
        operationId
      });

      // Wait for sync processing to begin
      await this.waitForSyncProcessing(context, preOpSyncState, 5000);

      // Capture post-operation sync state
      const postOpSyncState = this.framework.getCurrentSyncState();
      trace.syncStates.push(postOpSyncState);

      // Wait for sync completion (changes processed)
      const syncCompleted = await this.waitForSyncCompletion(context, operationId, 10000);

      // Complete the trace
      trace.endTime = Date.now();
      trace.result = operationResult;
      trace.success = syncCompleted;

      // Capture final sync state
      const finalSyncState = this.framework.getCurrentSyncState();
      trace.syncStates.push(finalSyncState);

      // Store trace in context
      context.metadata.syncTraces.push(trace);

      return {
        success: true,
        duration: Date.now() - startTime,
        data: {
          operation,
          entityType: config.entity,
          operationResult,
          syncCompleted,
          traceId: operationId,
          eventsRecorded: trace.events.length,
          syncStateSnapshots: trace.syncStates.length
        },
        metadata: {
          operation,
          entityType: config.entity,
          operationId,
          syncCompleted,
          eventsRecorded: trace.events.length,
          syncStateTransitions: trace.syncStates.length,
          preOpPendingChanges: preOpSyncState.pendingChangesCount,
          postOpPendingChanges: postOpSyncState.pendingChangesCount,
          finalPendingChanges: finalSyncState.pendingChangesCount
        }
      };
    } catch (error) {
      // Complete failed trace
      const trace = this.syncTraces.find(t => t.operationId === operationId);
      if (trace) {
        trace.endTime = Date.now();
        trace.success = false;
        trace.error = error as Error;
      }

      return {
        success: false,
        duration: Date.now() - startTime,
        error: error as Error,
        metadata: {
          operation,
          entityType: config.entity,
          operationId,
          failurePoint: 'execution'
        }
      };
    }
  }

  /**
   * Step 1: Execute the CRUD operation
   */
  private async executeOperation(
    context: TestExecutionContext, 
    config: EntityTestConfig, 
    operation: OperationType
  ): Promise<TestStepResult> {
    const startTime = Date.now();
    const operationId = uuidv4();
    const services = context.metadata.services;
    const testData = context.metadata.testData;
    
    try {
      // Create sync operation trace for this specific operation
      const trace: SyncOperationTrace = {
        operationId,
        operation,
        entityType: config.entity,
        startTime,
        events: [],
        syncStates: [],
        success: false
      };

      // Store trace and set current operation
      this.syncTraces.push(trace);
      context.metadata.currentOperationId = operationId;
      context.metadata.currentTrace = trace;

      // Record operation start event
      this.recordSyncEvent(context, {
        type: 'operation',
        phase: 'start',
        message: `Starting ${operation} operation on ${config.entity}`,
        operationId
      });

      // Capture pre-operation sync state
      const preOpSyncState = this.framework.getCurrentSyncState();
      trace.syncStates.push(preOpSyncState);

      // Get appropriate service for entity type
      const service = this.getServiceForEntity(services, config.entity);

      // Execute the operation using normal service methods (WITH sync tracking)
      let operationResult;
      switch (operation) {
        case 'insert':
          operationResult = await this.createEntityWithSync(service, config.entity, testData, context);
          break;
        case 'update':
          operationResult = await this.updateEntityWithSync(service, config.entity, testData, context);
          break;
        case 'delete':
          operationResult = await this.deleteEntityWithSync(service, config.entity, testData, context);
          break;
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }

      // Record operation completion
      this.recordSyncEvent(context, {
        type: 'operation',
        phase: 'completed',
        message: `${operation} operation completed successfully`,
        data: { operationResult },
        operationId
      });

      // Store operation result in trace
      trace.result = operationResult;

      return {
        success: true,
        duration: Date.now() - startTime,
        data: {
          operation,
          entityType: config.entity,
          operationResult,
          operationId
        },
        metadata: {
          operation,
          entityType: config.entity,
          operationId,
          preOpPendingChanges: preOpSyncState.pendingChangesCount
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
          operationId,
          failurePoint: 'operation_execution'
        }
      };
    }
  }

  /**
   * Step 2: Wait for LocalChange creation
   */
  private async waitForLocalChangeCreation(
    context: TestExecutionContext, 
    operation: OperationType
  ): Promise<TestStepResult> {
    const startTime = Date.now();
    const operationId = context.metadata.currentOperationId;
    const trace = context.metadata.currentTrace;
    
    try {
      // Wait for LocalChange to be created (sync tracking)
      const localChangeCreated = await this.waitForSpecificEvent(
        context, 
        'localchange', 
        'created', 
        5000,
        `LocalChange created for ${operation}`
      );

      if (localChangeCreated) {
        this.recordSyncEvent(context, {
          type: 'localchange',
          phase: 'detected',
          message: `LocalChange creation detected for ${operation}`,
          operationId
        });
      }

      // Capture sync state after LocalChange creation
      const postLocalChangeSyncState = this.framework.getCurrentSyncState();
      if (trace) {
        trace.syncStates.push(postLocalChangeSyncState);
      }

      return {
        success: localChangeCreated,
        duration: Date.now() - startTime,
        data: {
          operation,
          localChangeCreated,
          syncState: postLocalChangeSyncState
        },
        metadata: {
          operation,
          operationId,
          localChangeCreated,
          pendingChangesCount: postLocalChangeSyncState.pendingChangesCount
        }
      };
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error as Error,
        metadata: {
          operation,
          operationId,
          failurePoint: 'localchange_creation'
        }
      };
    }
  }

  /**
   * Step 3: Wait for queue processing
   */
  private async waitForQueueProcessing(
    context: TestExecutionContext, 
    operation: OperationType
  ): Promise<TestStepResult> {
    const startTime = Date.now();
    const operationId = context.metadata.currentOperationId;
    const trace = context.metadata.currentTrace;
    
    try {
      // Wait for queue processing event
      const queueProcessed = await this.waitForSpecificEvent(
        context, 
        'queue', 
        'processing', 
        8000,
        `Processing ${operation} changes`
      );

      if (queueProcessed) {
        this.recordSyncEvent(context, {
          type: 'queue',
          phase: 'detected',
          message: `Queue processing detected for ${operation}`,
          operationId
        });
      }

      // Capture sync state after queue processing
      const postQueueSyncState = this.framework.getCurrentSyncState();
      if (trace) {
        trace.syncStates.push(postQueueSyncState);
      }

      return {
        success: queueProcessed,
        duration: Date.now() - startTime,
        data: {
          operation,
          queueProcessed,
          syncState: postQueueSyncState
        },
        metadata: {
          operation,
          operationId,
          queueProcessed,
          queueSize: postQueueSyncState.queueSize
        }
      };
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error as Error,
        metadata: {
          operation,
          operationId,
          failurePoint: 'queue_processing'
        }
      };
    }
  }

  /**
   * Step 4: Wait for message sending
   */
  private async waitForMessageSending(
    context: TestExecutionContext, 
    operation: OperationType
  ): Promise<TestStepResult> {
    const startTime = Date.now();
    const operationId = context.metadata.currentOperationId;
    const trace = context.metadata.currentTrace;
    
    try {
      // Wait for message sending event
      const messageSent = await this.waitForSpecificEvent(
        context, 
        'send', 
        'sent', 
        10000,
        `Sent ${operation} changes to server`
      );

      if (messageSent) {
        this.recordSyncEvent(context, {
          type: 'send',
          phase: 'detected',
          message: `Message sending detected for ${operation}`,
          operationId
        });
      }

      // Capture sync state after message sending
      const postSendSyncState = this.framework.getCurrentSyncState();
      if (trace) {
        trace.syncStates.push(postSendSyncState);
      }

      return {
        success: messageSent,
        duration: Date.now() - startTime,
        data: {
          operation,
          messageSent,
          syncState: postSendSyncState
        },
        metadata: {
          operation,
          operationId,
          messageSent,
          pendingChangesCount: postSendSyncState.pendingChangesCount
        }
      };
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error as Error,
        metadata: {
          operation,
          operationId,
          failurePoint: 'message_sending'
        }
      };
    }
  }

  /**
   * Step 5: Wait for server acknowledgment
   */
  private async waitForServerAcknowledgment(
    context: TestExecutionContext, 
    operation: OperationType
  ): Promise<TestStepResult> {
    const startTime = Date.now();
    const operationId = context.metadata.currentOperationId;
    const trace = context.metadata.currentTrace;
    
    try {
      // Wait for server acknowledgment event
      const serverAcked = await this.waitForSpecificEvent(
        context, 
        'ack', 
        'acknowledged', 
        15000,
        `Server acknowledged ${operation} changes`
      );

      if (serverAcked) {
        this.recordSyncEvent(context, {
          type: 'ack',
          phase: 'detected',
          message: `Server acknowledgment detected for ${operation}`,
          operationId
        });
      }

      // Capture sync state after server acknowledgment
      const postAckSyncState = this.framework.getCurrentSyncState();
      if (trace) {
        trace.syncStates.push(postAckSyncState);
      }

      return {
        success: serverAcked,
        duration: Date.now() - startTime,
        data: {
          operation,
          serverAcked,
          syncState: postAckSyncState
        },
        metadata: {
          operation,
          operationId,
          serverAcked,
          pendingChangesCount: postAckSyncState.pendingChangesCount
        }
      };
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error as Error,
        metadata: {
          operation,
          operationId,
          failurePoint: 'server_acknowledgment'
        }
      };
    }
  }

  /**
   * Step 6: Verify sync completion
   */
  private async verifySyncCompletion(
    context: TestExecutionContext, 
    operation: OperationType
  ): Promise<TestStepResult> {
    const startTime = Date.now();
    const operationId = context.metadata.currentOperationId;
    const trace = context.metadata.currentTrace;
    
    try {
      // Wait for completion event (LocalChanges marked as processed)
      const syncCompleted = await this.waitForSpecificEvent(
        context, 
        'ack', 
        'completed', 
        10000,
        `Marked ${operation} local changes as processed`
      );

      if (syncCompleted) {
        this.recordSyncEvent(context, {
          type: 'ack',
          phase: 'completion_detected',
          message: `Sync completion detected for ${operation}`,
          operationId
        });
      }

      // Capture final sync state for this operation
      const finalSyncState = this.framework.getCurrentSyncState();
      if (trace) {
        trace.syncStates.push(finalSyncState);
        trace.endTime = Date.now();
        trace.success = syncCompleted;
      }

      return {
        success: syncCompleted,
        duration: Date.now() - startTime,
        data: {
          operation,
          syncCompleted,
          finalSyncState,
          totalDuration: trace ? trace.endTime! - trace.startTime : 0
        },
        metadata: {
          operation,
          operationId,
          syncCompleted,
          finalPendingChanges: finalSyncState.pendingChangesCount,
          totalSyncEvents: trace ? trace.events.length : 0,
          totalStateTransitions: trace ? trace.syncStates.length : 0
        }
      };
    } catch (error) {
      if (trace) {
        trace.endTime = Date.now();
        trace.success = false;
        trace.error = error as Error;
      }

      return {
        success: false,
        duration: Date.now() - startTime,
        error: error as Error,
        metadata: {
          operation,
          operationId,
          failurePoint: 'sync_completion'
        }
      };
    }
  }

  /**
   * Helper method to wait for specific sync events
   */
  private async waitForSpecificEvent(
    context: TestExecutionContext,
    eventType: string,
    eventPhase: string,
    timeoutMs: number,
    expectedMessage?: string
  ): Promise<boolean> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const checkForEvent = () => {
        const events = context.metadata.syncEvents || [];
        
        // Look for the specific event type and phase
        const foundEvent = events.find((event: SyncEvent) => 
          event.type === eventType && 
          event.phase === eventPhase &&
          event.timestamp >= startTime - 1000 && // Allow some buffer for timing
          (!expectedMessage || event.message.includes(expectedMessage.split(' ')[0])) // Partial message match
        );

        if (foundEvent) {
          resolve(true);
          return;
        }
        
        if (Date.now() - startTime > timeoutMs) {
          console.warn(`[SyncOperationTests] Timeout waiting for event: ${eventType}:${eventPhase}`);
          resolve(false);
          return;
        }
        
        setTimeout(checkForEvent, 200);
      };
      
      // Start checking after a small delay
      setTimeout(checkForEvent, 100);
    });
  }

  /**
   * Create entity using normal service method (WITH sync tracking)
   */
  private async createEntityWithSync(service: any, entityType: EntityType, testData: any, context: TestExecutionContext): Promise<any> {
    if (!this.dataGenerator) {
      throw new Error('TestDataGenerator not initialized');
    }

    switch (entityType) {
      case 'tasks':
        const existingProjects = this.getExistingEntitiesFromTestData(testData, 'projects');
        const existingUsers = this.getExistingEntitiesFromTestData(testData, 'users');
        
        const projectId = existingProjects.length > 0 ? existingProjects[0].id : undefined;
        const assigneeId = existingUsers.length > 0 ? existingUsers[0].id : undefined;
        
        return await service.createTask({
          title: `Sync Test Task ${Date.now()}`,
          description: 'Created via sync operation test',
          projectId,
          assigneeId,
          status: TaskStatus.OPEN,
          priority: TaskPriority.MEDIUM
        });

      case 'projects':
        const owners = this.getExistingEntitiesFromTestData(testData, 'users');
        const ownerId = owners.length > 0 ? owners[0].id : undefined;
        
        return await service.createProject({
          name: `Sync Test Project ${Date.now()}`,
          description: 'Created via sync operation test',
          ownerId
        });

      case 'users':
        return await service.createUser({
          name: `Sync Test User ${Date.now()}`,
          email: `synctest${Date.now()}@example.com`
        });

      case 'comments':
        const tasks = this.getExistingEntitiesFromTestData(testData, 'tasks');
        const authors = this.getExistingEntitiesFromTestData(testData, 'users');
        
        if (tasks.length === 0 || authors.length === 0) {
          throw new Error('No tasks or users available for comment creation');
        }
        
        return await service.createComment({
          content: `Sync test comment ${Date.now()}`,
          taskId: tasks[0].id,
          authorId: authors[0].id
        });

      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  /**
   * Update entity using normal service method (WITH sync tracking)
   */
  private async updateEntityWithSync(service: any, entityType: EntityType, testData: any, context: TestExecutionContext): Promise<any> {
    const existingEntities = this.getExistingEntitiesFromTestData(testData, entityType);
    
    if (existingEntities.length === 0) {
      // Create entity first if none exist
      const created = await this.createEntityWithSync(service, entityType, testData, context);
      const updateData = this.generateUpdateData(entityType);
      
      switch (entityType) {
        case 'tasks':
          return await service.updateTask(created.id, updateData);
        case 'projects':
          return await service.updateProject(created.id, updateData);
        case 'users':
          return await service.updateUser(created.id, updateData);
        case 'comments':
          return await service.updateComment(created.id, updateData);
        default:
          throw new Error(`Unsupported entity type: ${entityType}`);
      }
    }
    
    const entityToUpdate = existingEntities[0];
    const updateData = this.generateUpdateData(entityType);
    
    switch (entityType) {
      case 'tasks':
        return await service.updateTask(entityToUpdate.id, updateData);
      case 'projects':
        return await service.updateProject(entityToUpdate.id, updateData);
      case 'users':
        return await service.updateUser(entityToUpdate.id, updateData);
      case 'comments':
        return await service.updateComment(entityToUpdate.id, updateData);
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  /**
   * Delete entity using normal service method (WITH sync tracking)
   */
  private async deleteEntityWithSync(service: any, entityType: EntityType, testData: any, context: TestExecutionContext): Promise<any> {
    const entitiesForDeletion = this.getExistingEntitiesFromTestData(testData, entityType);
    
    if (entitiesForDeletion.length === 0) {
      // Create entity first if none exist
      const created = await this.createEntityWithSync(service, entityType, testData, context);
      
      switch (entityType) {
        case 'tasks':
          return await service.deleteTask(created.id);
        case 'projects':
          return await service.deleteProject(created.id);
        case 'users':
          return await service.deleteUser(created.id);
        case 'comments':
          return await service.deleteComment(created.id);
        default:
          throw new Error(`Unsupported entity type: ${entityType}`);
      }
    }
    
    const entityToDelete = entitiesForDeletion[entitiesForDeletion.length - 1];
    
    switch (entityType) {
      case 'tasks':
        return await service.deleteTask(entityToDelete.id);
      case 'projects':
        return await service.deleteProject(entityToDelete.id);
      case 'users':
        return await service.deleteUser(entityToDelete.id);
      case 'comments':
        return await service.deleteComment(entityToDelete.id);
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  /**
   * Wait for sync processing to begin
   */
  private async waitForSyncProcessing(
    context: TestExecutionContext, 
    preOpState: SyncStateSnapshot, 
    timeoutMs: number
  ): Promise<boolean> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const checkSync = () => {
        const currentState = this.framework.getCurrentSyncState();
        
        // Check if pending changes increased (LocalChange created)
        if (currentState.pendingChangesCount > preOpState.pendingChangesCount) {
          resolve(true);
          return;
        }
        
        if (Date.now() - startTime > timeoutMs) {
          resolve(false);
          return;
        }
        
        setTimeout(checkSync, 100);
      };
      
      checkSync();
    });
  }

  /**
   * Wait for sync completion (changes processed)
   */
  private async waitForSyncCompletion(
    context: TestExecutionContext, 
    operationId: string, 
    timeoutMs: number
  ): Promise<boolean> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const checkCompletion = () => {
        // Check if we received completion events for this operation
        const operationEvents = context.metadata.syncEvents?.filter((event: SyncEvent) => 
          event.operationId === operationId || 
          (event.type === 'ack' && event.phase === 'completed')
        ) || [];
        
        const hasCompletionEvent = operationEvents.some((event: SyncEvent) => 
          event.phase === 'completed' || event.phase === 'acknowledged'
        );
        
        if (hasCompletionEvent) {
          resolve(true);
          return;
        }
        
        if (Date.now() - startTime > timeoutMs) {
          resolve(false);
          return;
        }
        
        setTimeout(checkCompletion, 100);
      };
      
      // Give a small delay before starting to check
      setTimeout(checkCompletion, 500);
    });
  }

  /**
   * Execute comprehensive sync analysis
   */
  private async executeComprehensiveSyncAnalysis(
    context: TestExecutionContext, 
    config: EntityTestConfig
  ): Promise<TestStepResult> {
    const startTime = Date.now();
    
    try {
      const traces = context.metadata.syncTraces || [];
      const allEvents = context.metadata.syncEvents || [];
      
      // Analyze sync operation completeness
      const completeTraces = traces.filter((trace: SyncOperationTrace) => trace.success);
      const incompleteTraces = traces.filter((trace: SyncOperationTrace) => !trace.success);
      
      // Analyze event patterns
      const eventAnalysis = this.analyzeSyncEventPatterns(allEvents);
      
      // Check for sync timing issues
      const timingAnalysis = this.analyzeSyncTiming(traces);
      
      // Validate sync state consistency
      const stateAnalysis = this.analyzeSyncStateConsistency(traces);
      
      const analysis = {
        totalOperations: traces.length,
        completeOperations: completeTraces.length,
        incompleteOperations: incompleteTraces.length,
        eventAnalysis,
        timingAnalysis,
        stateAnalysis,
        overallSuccess: incompleteTraces.length === 0
      };

      return {
        success: analysis.overallSuccess,
        data: analysis,
        duration: Date.now() - startTime,
        metadata: {
          totalTraces: traces.length,
          successfulTraces: completeTraces.length,
          totalEvents: allEvents.length,
          analysisComplete: true
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
   * Record sync event
   */
  private recordSyncEvent(context: TestExecutionContext, eventData: Partial<SyncEvent>): void {
    const event: SyncEvent = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: eventData.type || 'operation',
      phase: eventData.phase || 'unknown',
      message: eventData.message || 'Sync event',
      data: eventData.data,
      operationId: eventData.operationId || context.metadata.currentOperationId
    };

    // Store in context
    if (!context.metadata.syncEvents) {
      context.metadata.syncEvents = [];
    }
    context.metadata.syncEvents.push(event);

    // Also store in current trace if available
    const currentTrace = this.syncTraces.find(t => t.operationId === event.operationId);
    if (currentTrace) {
      currentTrace.events.push(event);
    }

    console.log(`[SyncOperationTests] Event: ${event.type}:${event.phase} - ${event.message}`);
  }

  /**
   * Generate test data for sync operations
   */
  private async generateSyncTestData(config: EntityTestConfig): Promise<any> {
    if (!this.dataGenerator) {
      throw new Error('TestDataGenerator not initialized');
    }

    const testData: Record<string, any> = {};
    
    // Generate base entities that others depend on
    testData.users = await this.dataGenerator.createTestUsers(3);
    testData.projects = await this.dataGenerator.createTestProjects(2, testData.users);
    testData.tasks = await this.dataGenerator.createTestTasks(3, testData.projects, testData.users);
    testData.comments = await this.dataGenerator.createTestComments(2, testData.tasks, testData.users);

    return testData;
  }

  /**
   * Analyze sync event patterns
   */
  private analyzeSyncEventPatterns(events: SyncEvent[]): any {
    const eventsByType = new Map<string, SyncEvent[]>();
    const eventsByPhase = new Map<string, SyncEvent[]>();
    
    events.forEach(event => {
      if (!eventsByType.has(event.type)) {
        eventsByType.set(event.type, []);
      }
      eventsByType.get(event.type)!.push(event);
      
      if (!eventsByPhase.has(event.phase)) {
        eventsByPhase.set(event.phase, []);
      }
      eventsByPhase.get(event.phase)!.push(event);
    });

    return {
      totalEvents: events.length,
      eventTypes: Array.from(eventsByType.keys()),
      eventPhases: Array.from(eventsByPhase.keys()),
      eventTypeCounts: Object.fromEntries(
        Array.from(eventsByType.entries()).map(([type, events]) => [type, events.length])
      ),
      eventPhaseCounts: Object.fromEntries(
        Array.from(eventsByPhase.entries()).map(([phase, events]) => [phase, events.length])
      ),
      hasErrors: events.some(e => e.type === 'error'),
      hasCompletions: events.some(e => e.phase === 'completed' || e.phase === 'acknowledged')
    };
  }

  /**
   * Analyze sync timing
   */
  private analyzeSyncTiming(traces: SyncOperationTrace[]): any {
    const timings = traces.map(trace => ({
      operationId: trace.operationId,
      operation: trace.operation,
      duration: (trace.endTime || Date.now()) - trace.startTime,
      eventsCount: trace.events.length,
      success: trace.success
    }));

    const successfulTimings = timings.filter(t => t.success);
    const averageDuration = successfulTimings.length > 0 
      ? successfulTimings.reduce((sum, t) => sum + t.duration, 0) / successfulTimings.length 
      : 0;

    return {
      totalOperations: timings.length,
      successfulOperations: successfulTimings.length,
      averageDuration,
      maxDuration: Math.max(...timings.map(t => t.duration)),
      minDuration: Math.min(...timings.map(t => t.duration)),
      timings: timings.slice(0, 10) // Include sample of timings
    };
  }

  /**
   * Analyze sync state consistency
   */
  private analyzeSyncStateConsistency(traces: SyncOperationTrace[]): any {
    const stateTransitions = [];
    
    for (const trace of traces) {
      for (let i = 1; i < trace.syncStates.length; i++) {
        const prev = trace.syncStates[i - 1];
        const curr = trace.syncStates[i];
        
        stateTransitions.push({
          operationId: trace.operationId,
          operation: trace.operation,
          pendingChangesDelta: curr.pendingChangesCount - prev.pendingChangesCount,
          queueSizeDelta: curr.queueSize - prev.queueSize,
          timeDelta: curr.timestamp - prev.timestamp
        });
      }
    }

    return {
      totalTransitions: stateTransitions.length,
      expectedIncreases: stateTransitions.filter(t => t.pendingChangesDelta > 0).length,
      unexpectedChanges: stateTransitions.filter(t => t.pendingChangesDelta < 0 && t.queueSizeDelta < 0).length,
      stateConsistency: stateTransitions.every(t => t.pendingChangesDelta >= 0 || t.queueSizeDelta >= 0)
    };
  }

  /**
   * Get existing entities from test data
   */
  private getExistingEntitiesFromTestData(testData: any, entityType?: EntityType): any[] {
    if (!entityType) return [];
    
    switch (entityType) {
      case 'users':
        return testData.users || [];
      case 'projects':
        return testData.projects || [];
      case 'tasks':
        return testData.tasks || [];
      case 'comments':
        return testData.comments || [];
      default:
        return [];
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
   * Generate appropriate update data for entity type
   */
  private generateUpdateData(entityType: EntityType): any {
    const timestamp = new Date();
    
    switch (entityType) {
      case 'tasks':
        return {
          title: `Updated Task ${timestamp.getTime()}`,
          description: 'Updated description via sync operation test',
          status: TaskStatus.IN_PROGRESS,
          updatedAt: timestamp
        };
      case 'projects':
        return {
          name: `Updated Project ${timestamp.getTime()}`,
          description: 'Updated project description via sync operation test',
          updatedAt: timestamp
        };
      case 'users':
        return {
          name: `Updated User ${timestamp.getTime()}`,
          email: `syncupdated${timestamp.getTime()}@example.com`,
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
   * Validation methods
   */
  private async validateSyncMonitoringSetup(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Sync monitoring setup failed',
        details: result.error?.message
      };
    }

    const metadata = result.metadata;
    
    if (metadata.eventListenersRegistered === 0) {
      return {
        status: 'warning',
        message: 'No event listeners registered for sync monitoring'
      };
    }

    return {
      status: 'passed',
      message: `Sync monitoring setup successful - ${metadata.eventListenersRegistered} listeners registered`,
      details: metadata
    };
  }

  /**
   * Validate operation execution
   */
  private async validateOperationExecution(
    context: TestExecutionContext, 
    result: TestStepResult, 
    operation: OperationType
  ): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: `${operation} operation execution failed`,
        details: result.error?.message
      };
    }

    const data = result.data;
    const metadata = result.metadata;
    
    if (!data.operationResult) {
      return {
        status: 'failed',
        message: `${operation} operation did not return a result`,
        details: { operation, metadata }
      };
    }

    return {
      status: 'passed',
      message: `${operation} operation executed successfully`,
      details: {
        operation,
        operationId: metadata.operationId,
        entityType: data.entityType,
        preOpPendingChanges: metadata.preOpPendingChanges
      }
    };
  }

  /**
   * Validate LocalChange creation
   */
  private async validateLocalChangeCreation(
    context: TestExecutionContext, 
    result: TestStepResult, 
    operation: OperationType
  ): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: `LocalChange creation failed for ${operation}`,
        details: result.error?.message
      };
    }

    const data = result.data;
    const metadata = result.metadata;
    
    if (!metadata.localChangeCreated) {
      return {
        status: 'failed',
        message: `LocalChange was not created for ${operation} operation`,
        details: {
          operation,
          operationId: metadata.operationId,
          pendingChangesCount: metadata.pendingChangesCount,
          timeout: 'LocalChange creation timed out'
        },
        suggestions: [
          'Check if sync tracking is enabled',
          'Verify OutgoingChangeProcessor is working',
          'Check for sync system errors'
        ]
      };
    }

    return {
      status: 'passed',
      message: `LocalChange created successfully for ${operation}`,
      details: {
        operation,
        operationId: metadata.operationId,
        pendingChangesCount: metadata.pendingChangesCount
      }
    };
  }

  /**
   * Validate queue processing
   */
  private async validateQueueProcessing(
    context: TestExecutionContext, 
    result: TestStepResult, 
    operation: OperationType
  ): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: `Queue processing failed for ${operation}`,
        details: result.error?.message
      };
    }

    const data = result.data;
    const metadata = result.metadata;
    
    if (!metadata.queueProcessed) {
      return {
        status: 'failed',
        message: `Queue processing was not detected for ${operation} operation`,
        details: {
          operation,
          operationId: metadata.operationId,
          queueSize: metadata.queueSize,
          timeout: 'Queue processing timed out'
        },
        suggestions: [
          'Check if sync queue is running',
          'Verify queue processing events are emitted',
          'Check for queue processing errors'
        ]
      };
    }

    return {
      status: 'passed',
      message: `Queue processing completed for ${operation}`,
      details: {
        operation,
        operationId: metadata.operationId,
        queueSize: metadata.queueSize
      }
    };
  }

  /**
   * Validate message sending
   */
  private async validateMessageSending(
    context: TestExecutionContext, 
    result: TestStepResult, 
    operation: OperationType
  ): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: `Message sending failed for ${operation}`,
        details: result.error?.message
      };
    }

    const data = result.data;
    const metadata = result.metadata;
    
    if (!metadata.messageSent) {
      return {
        status: 'failed',
        message: `Message sending was not detected for ${operation} operation`,
        details: {
          operation,
          operationId: metadata.operationId,
          pendingChangesCount: metadata.pendingChangesCount,
          timeout: 'Message sending timed out'
        },
        suggestions: [
          'Check network connectivity',
          'Verify sync server is running',
          'Check for message sending errors'
        ]
      };
    }

    return {
      status: 'passed',
      message: `Message sent successfully for ${operation}`,
      details: {
        operation,
        operationId: metadata.operationId,
        pendingChangesCount: metadata.pendingChangesCount
      }
    };
  }

  /**
   * Validate server acknowledgment
   */
  private async validateServerAcknowledgment(
    context: TestExecutionContext, 
    result: TestStepResult, 
    operation: OperationType
  ): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: `Server acknowledgment failed for ${operation}`,
        details: result.error?.message
      };
    }

    const data = result.data;
    const metadata = result.metadata;
    
    if (!metadata.serverAcked) {
      return {
        status: 'failed',
        message: `Server acknowledgment was not received for ${operation} operation`,
        details: {
          operation,
          operationId: metadata.operationId,
          pendingChangesCount: metadata.pendingChangesCount,
          timeout: 'Server acknowledgment timed out'
        },
        suggestions: [
          'Check server response time',
          'Verify server is processing changes',
          'Check for server errors'
        ]
      };
    }

    return {
      status: 'passed',
      message: `Server acknowledged ${operation} successfully`,
      details: {
        operation,
        operationId: metadata.operationId,
        pendingChangesCount: metadata.pendingChangesCount
      }
    };
  }

  /**
   * Validate sync completion
   */
  private async validateSyncCompletion(
    context: TestExecutionContext, 
    result: TestStepResult, 
    operation: OperationType
  ): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: `Sync completion failed for ${operation}`,
        details: result.error?.message
      };
    }

    const data = result.data;
    const metadata = result.metadata;
    
    if (!metadata.syncCompleted) {
      return {
        status: 'failed',
        message: `Sync completion was not detected for ${operation} operation`,
        details: {
          operation,
          operationId: metadata.operationId,
          finalPendingChanges: metadata.finalPendingChanges,
          totalSyncEvents: metadata.totalSyncEvents,
          timeout: 'Sync completion timed out'
        },
        suggestions: [
          'Check if LocalChanges are being marked as processed',
          'Verify sync completion events are emitted',
          'Check for sync completion errors'
        ]
      };
    }

    return {
      status: 'passed',
      message: `Sync completed successfully for ${operation} - Full lifecycle tracked`,
      details: {
        operation,
        operationId: metadata.operationId,
        totalDuration: data.totalDuration,
        finalPendingChanges: metadata.finalPendingChanges,
        totalSyncEvents: metadata.totalSyncEvents,
        totalStateTransitions: metadata.totalStateTransitions
      }
    };
  }

  /**
   * Validate comprehensive sync analysis
   */
  private async validateComprehensiveSyncAnalysis(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Comprehensive sync analysis failed',
        details: result.error?.message
      };
    }

    const data = result.data;
    
    if (data.incompleteOperations > 0) {
      return {
        status: 'failed',
        message: `${data.incompleteOperations} out of ${data.totalOperations} operations did not complete sync`,
        details: data
      };
    }

    if (!data.eventAnalysis.hasCompletions) {
      return {
        status: 'warning',
        message: 'No completion events detected in sync traces',
        details: data.eventAnalysis
      };
    }

    return {
      status: 'passed',
      message: `Comprehensive sync analysis successful - all ${data.totalOperations} operations completed`,
      details: data
    };
  }

  /**
   * Execute sync domain coverage validation
   */
  private async executeSyncDomainCoverageValidation(
    context: TestExecutionContext, 
    config: EntityTestConfig
  ): Promise<TestStepResult> {
    const startTime = Date.now();
    
    try {
      // Analyze domain coverage for sync operations (similar to PureCRUDTests but for sync)
      const syncTraces = context.metadata.syncTraces || [];
      
      // Check that sync operations covered domain entities
      const syncOperationCoverage = this.analyzeSyncOperationCoverage(syncTraces);
      
      // Validate that sync events were generated for all entity types
      const syncEventCoverage = this.analyzeSyncEventCoverage(context);
      
      // Validate that all enum values were used in sync operations
      const syncEnumCoverage = this.analyzeSyncEnumCoverage(syncTraces);
      
      // Validate that relations were properly synced
      const syncRelationCoverage = this.analyzeSyncRelationCoverage(syncTraces);

      const overallSuccess = syncOperationCoverage.allEntitiesSynced &&
                            syncEventCoverage.allEventTypesGenerated &&
                            syncEnumCoverage.enumsUsedInSync &&
                            syncRelationCoverage.relationsProperlyTracked;

      return {
        success: overallSuccess,
        data: {
          syncOperationCoverage,
          syncEventCoverage,
          syncEnumCoverage,
          syncRelationCoverage,
          overallSuccess
        },
        duration: Date.now() - startTime,
        metadata: {
          allEntitiesSynced: syncOperationCoverage.allEntitiesSynced,
          allEventTypesGenerated: syncEventCoverage.allEventTypesGenerated,
          enumsUsedInSync: syncEnumCoverage.enumsUsedInSync,
          relationsProperlyTracked: syncRelationCoverage.relationsProperlyTracked,
          totalSyncOperations: syncTraces.length,
          successfulSyncOperations: syncTraces.filter((t: SyncOperationTrace) => t.success).length
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
   * Analyze sync operation coverage across domain entities
   */
  private analyzeSyncOperationCoverage(syncTraces: SyncOperationTrace[]): any {
    const expectedEntities = ['Task', 'Project', 'User', 'Comment'];
    const syncedEntities = new Set<string>();
    
    for (const trace of syncTraces) {
      syncedEntities.add(trace.entityType);
    }
    
    const allEntitiesSynced = expectedEntities.every(entity => 
      syncedEntities.has(entity.toLowerCase() as EntityType)
    );
    
    return {
      allEntitiesSynced,
      expectedEntities,
      syncedEntities: Array.from(syncedEntities),
      coveragePercentage: Math.round((syncedEntities.size / expectedEntities.length) * 100)
    };
  }

  /**
   * Analyze sync event coverage
   */
  private analyzeSyncEventCoverage(context: TestExecutionContext): any {
    const events = context.metadata.syncEvents || [];
    const expectedEventTypes = ['operation', 'localchange', 'queue', 'send', 'ack'];
    const expectedEventPhases = ['start', 'completed', 'created', 'processing', 'sent', 'acknowledged'];
    
    const generatedEventTypes = new Set(events.map((e: any) => e.type));
    const generatedEventPhases = new Set(events.map((e: any) => e.phase));
    
    const allEventTypesGenerated = expectedEventTypes.every(type => 
      generatedEventTypes.has(type)
    );
    
    const allEventPhasesGenerated = expectedEventPhases.every(phase => 
      generatedEventPhases.has(phase)
    );
    
    return {
      allEventTypesGenerated,
      allEventPhasesGenerated,
      expectedEventTypes,
      generatedEventTypes: Array.from(generatedEventTypes),
      expectedEventPhases,
      generatedEventPhases: Array.from(generatedEventPhases),
      totalEvents: events.length
    };
  }

  /**
   * Analyze sync enum coverage
   */
  private analyzeSyncEnumCoverage(syncTraces: SyncOperationTrace[]): any {
    const usedEnums = new Set<string>();
    
    for (const trace of syncTraces) {
      if (trace.result && typeof trace.result === 'object') {
        // Check for enum values in sync results
        if ('status' in trace.result) usedEnums.add(trace.result.status);
        if ('priority' in trace.result) usedEnums.add(trace.result.priority);
        if ('role' in trace.result) usedEnums.add(trace.result.role);
      }
    }
    
    const expectedEnumValues = [
      ...Object.values(TaskStatus),
      ...Object.values(TaskPriority),
      ...Object.values(ProjectStatus),
      ...Object.values(UserRole)
    ];
    
    const enumsUsedInSync = usedEnums.size > 0;
    
    return {
      enumsUsedInSync,
      usedEnums: Array.from(usedEnums),
      expectedEnumValues,
      enumCoveragePercentage: Math.round((usedEnums.size / expectedEnumValues.length) * 100)
    };
  }

  /**
   * Analyze sync relation coverage
   */
  private analyzeSyncRelationCoverage(syncTraces: SyncOperationTrace[]): any {
    const trackedRelations = new Set<string>();
    
    for (const trace of syncTraces) {
      if (trace.result && typeof trace.result === 'object') {
        // Check for foreign key fields that indicate relations
        if ('projectId' in trace.result && trace.result.projectId) {
          trackedRelations.add('Task.project');
        }
        if ('assigneeId' in trace.result && trace.result.assigneeId) {
          trackedRelations.add('Task.assignee');
        }
        if ('ownerId' in trace.result && trace.result.ownerId) {
          trackedRelations.add('Project.owner');
        }
        if ('authorId' in trace.result && trace.result.authorId) {
          trackedRelations.add('Comment.author');
        }
        if ('taskId' in trace.result && trace.result.taskId) {
          trackedRelations.add('Comment.task');
        }
      }
    }
    
    const expectedRelations = [
      'Task.project', 'Task.assignee', 'Project.owner', 
      'Comment.author', 'Comment.task', 'Comment.project'
    ];
    
    const relationsProperlyTracked = trackedRelations.size >= expectedRelations.length * 0.5; // 50% minimum for sync
    
    return {
      relationsProperlyTracked,
      trackedRelations: Array.from(trackedRelations),
      expectedRelations,
      relationCoveragePercentage: Math.round((trackedRelations.size / expectedRelations.length) * 100)
    };
  }

  /**
   * Validate sync domain coverage results
   */
  private async validateSyncDomainCoverage(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Sync domain coverage validation failed',
        details: result.error?.message
      };
    }

    const data = result.data;
    const metadata = result.metadata;
    
    if (!metadata.allEntitiesSynced) {
      return {
        status: 'failed',
        message: 'Not all domain entities were covered in sync operations',
        details: {
          syncOperationCoverage: data.syncOperationCoverage
        },
        suggestions: [
          'Ensure sync tests cover all entity types (User, Project, Task, Comment)',
          'Add sync operations for missing entity types'
        ]
      };
    }

    if (!metadata.allEventTypesGenerated) {
      return {
        status: 'failed',
        message: 'Not all expected sync event types were generated',
        details: {
          syncEventCoverage: data.syncEventCoverage
        },
        suggestions: [
          'Verify sync event listeners are properly configured',
          'Check that all sync phases are being tracked',
          'Ensure sync operations complete the full lifecycle'
        ]
      };
    }

    if (!metadata.enumsUsedInSync) {
      return {
        status: 'warning',
        message: 'Limited enum usage detected in sync operations',
        details: {
          syncEnumCoverage: data.syncEnumCoverage
        },
        suggestions: [
          'Add sync operations that use different enum values',
          'Test sync with various task statuses and priorities'
        ]
      };
    }

    if (!metadata.relationsProperlyTracked) {
      return {
        status: 'warning',
        message: 'Limited relation tracking in sync operations',
        details: {
          syncRelationCoverage: data.syncRelationCoverage
        },
        suggestions: [
          'Add sync operations that involve entity relationships',
          'Test sync with foreign key assignments'
        ]
      };
    }

    return {
      status: 'passed',
      message: `Sync domain coverage validation successful - comprehensive sync tracking achieved`,
      details: {
        allEntitiesSynced: metadata.allEntitiesSynced,
        allEventTypesGenerated: metadata.allEventTypesGenerated,
        enumsUsedInSync: metadata.enumsUsedInSync,
        relationsProperlyTracked: metadata.relationsProperlyTracked,
        totalSyncOperations: metadata.totalSyncOperations,
        successfulSyncOperations: metadata.successfulSyncOperations
      }
    };
  }

  /**
   * Cleanup event listeners
   */
  private cleanupEventListeners(): void {
    const syncManager = (this.framework as any).syncManager;
    if (!syncManager || !syncManager.events) return;

    const events = syncManager.events;

    for (const [eventName, listeners] of this.eventListeners.entries()) {
      for (const listener of listeners) {
        events.off(eventName, listener);
      }
    }

    this.eventListeners.clear();
    console.log('[SyncOperationTests] Cleaned up all event listeners');
  }

  /**
   * Simple test runner for easy usage
   */
  async run(updateProgress?: (progress: number, step: string) => void): Promise<TestResult> {
    const log = (progress: number, message: string) => {
      console.log(`[${progress}%] ${message}`);
      updateProgress?.(progress, message);
    };

    log(0, '🔄 Starting Sequential Sync Operation Tests with Step-by-Step Event Tracking...');
    
    const startTime = Date.now();
    const testId = uuidv4();
    
    try {
      // Configuration for sync operation test
      const config: EntityTestConfig = {
        id: 'sync-operation-test',
        name: 'Sequential Sync Operation Tracking',
        description: 'Test complete sync operation lifecycle step-by-step with event tracking',
        type: 'single_entity_crud',
        entity: 'tasks',
        operations: ['insert', 'update', 'delete'],
        dataVariations: { minimal: true, complete: false, edge: false, invalid: false },
        validation: { immediate: true, eventual: true, state: true },
        enabled: true,
        timeout: 60000, // Longer timeout for step-by-step process
        retries: 0,
        cleanupAfterTest: true,
        tags: ['sync', 'tracking', 'events', 'sequential']
      };

      log(5, '🔧 Setting up sync event monitoring...');
      
      const result = await this.runSyncOperationTest(config);
      
      // Cleanup
      this.cleanupEventListeners();
      
      const duration = Date.now() - startTime;
      log(100, `✅ Sequential Sync Operation Tests completed in ${duration}ms`);

      // Enhanced logging for step-by-step results
      if (result.success) {
        const operationCount = config.operations.length;
        const stepsPerOperation = 6; // 6 steps per operation
        const totalSteps = result.steps?.length || 0;
        
        console.log(`\n📊 Sequential Sync Test Summary:`);
        console.log(`   Operations tested: ${operationCount}`);
        console.log(`   Total steps executed: ${totalSteps}`);
        console.log(`   Expected steps: ${operationCount * stepsPerOperation + 2} (${operationCount} ops × 6 steps + setup + analysis)`);
        console.log(`   Duration: ${duration}ms`);
        
        // Log step-by-step results
        config.operations.forEach((operation, index) => {
          console.log(`\n   ${operation.toUpperCase()} Operation Steps:`);
          console.log(`     ✅ Step 1: Execute Operation`);
          console.log(`     ✅ Step 2: LocalChange Creation`);
          console.log(`     ✅ Step 3: Queue Processing`);
          console.log(`     ✅ Step 4: Message Sending`);
          console.log(`     ✅ Step 5: Server Acknowledgment`);
          console.log(`     ✅ Step 6: Sync Completion`);
        });
      }

      return result;

    } catch (error) {
      // Ensure cleanup on error
      this.cleanupEventListeners();
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(0, `❌ Sequential Sync Operation Tests failed: ${errorMessage}`);
      console.error('❌ Sequential Sync Operation Tests failed:', errorMessage);
      const endTime = Date.now();
      
      return {
        id: testId,
        configId: 'sync-operation-test',
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