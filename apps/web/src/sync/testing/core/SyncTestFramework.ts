// Simple browser-compatible event emitter
class SimpleEventEmitter {
  private events: Map<string, Array<(...args: any[]) => void>> = new Map();

  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    const listeners = this.events.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}

import { v4 as uuidv4 } from 'uuid';
import type {
  TestConfig,
  TestResult,
  TestSuite,
  TestExecutionContext,
  TestStatus,
  TestPhase,
  SyncTestFrameworkOptions,
  TestFrameworkEvent,
  TestFrameworkEventData,
  SyncStateSnapshot,
  PerformanceMetrics,
  TestStep,
  TestStepResult,
  ValidationResult
} from './TestTypes';
import { SyncManager } from '../../SyncManager';
import { OutgoingChangeProcessor } from '../../OutgoingChangeProcessor';
import { IncomingChangeProcessor } from '../../IncomingChangeProcessor';

/**
 * Core sync testing framework that manages test execution,
 * validation, and result collection
 */
export class SyncTestFramework extends SimpleEventEmitter {
  private syncManager: SyncManager;
  private outgoingProcessor: OutgoingChangeProcessor;
  private incomingProcessor: IncomingChangeProcessor;
  private options: SyncTestFrameworkOptions;
  private services: any = null; // Store services directly
  private activeTests: Map<string, TestExecutionContext> = new Map();
  private testResults: Map<string, TestResult> = new Map();
  private stateSnapshots: Map<string, SyncStateSnapshot[]> = new Map();
  private performanceMetrics: Map<string, PerformanceMetrics> = new Map();

  constructor(syncManager: SyncManager, options: Partial<SyncTestFrameworkOptions> = {}, services?: any) {
    super();
    
    this.syncManager = syncManager;
    this.services = services; // Store services if provided
    this.options = {
      defaultTimeout: 30000,
      defaultRetries: 3,
      cleanupAfterTest: true,
      parallelExecution: false,
      maxConcurrentTests: 3,
      enablePerformanceMonitoring: true,
      enableStateSnapshots: true,
      snapshotInterval: 1000,
      ...options
    };

    // Get sync system components
    this.outgoingProcessor = this.syncManager.getOutgoingChangeProcessor();
    this.incomingProcessor = this.syncManager.getIncomingChangeProcessor();

    this.setupEventListeners();
  }

  /**
   * Set services after framework creation
   */
  setServices(services: any): void {
    this.services = services;
  }

  /**
   * Execute a single test configuration
   */
  async executeTest(config: TestConfig): Promise<TestResult> {
    const testId = uuidv4();
    const startTime = Date.now();

    const context: TestExecutionContext = {
      config,
      startTime,
      currentPhase: 'setup',
      status: 'running',
      progress: 0,
      metadata: {}
    };

    this.activeTests.set(testId, context);
    this.emit('test_started', testId, { config });

    try {
      // Initialize performance monitoring
      if (this.options.enablePerformanceMonitoring) {
        this.startPerformanceMonitoring(testId);
      }

      // Initialize state snapshots
      if (this.options.enableStateSnapshots) {
        this.startStateSnapshots(testId);
      }

      // Execute test phases
      await this.executeTestPhases(testId, context);

      // Create successful result
      const result: TestResult = {
        id: testId,
        configId: config.id,
        status: 'passed',
        success: true,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        steps: [],
        validations: [],
        performance: this.performanceMetrics.get(testId),
        syncStates: this.stateSnapshots.get(testId) || [],
        metadata: context.metadata
      };

      this.testResults.set(testId, result);
      this.emit('test_completed', testId, { result });

      return result;

    } catch (error) {
      // Create failed result
      const result: TestResult = {
        id: testId,
        configId: config.id,
        status: 'failed',
        success: false,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        steps: [],
        validations: [],
        performance: this.performanceMetrics.get(testId),
        syncStates: this.stateSnapshots.get(testId) || [],
        error: error as Error,
        metadata: context.metadata
      };

      this.testResults.set(testId, result);
      this.emit('test_failed', testId, { result, error });

      throw error;

    } finally {
      // Cleanup
      this.activeTests.delete(testId);
      
      if (config.cleanupAfterTest) {
        await this.cleanupTest(testId);
      }

      // Stop monitoring
      this.stopPerformanceMonitoring(testId);
      this.stopStateSnapshots(testId);
    }
  }

  /**
   * Execute a test suite (multiple test configurations)
   */
  async executeTestSuite(suite: TestSuite): Promise<TestSuite> {
    const startTime = Date.now();
    suite.status = 'running';
    suite.startTime = startTime;
    suite.progress = 0;

    const results: TestResult[] = [];
    const totalTests = suite.configs.length;

    try {
      if (this.options.parallelExecution) {
        // Execute tests in parallel (limited concurrency)
        const chunks = this.chunkArray(suite.configs, this.options.maxConcurrentTests);
        
        for (const chunk of chunks) {
          const chunkPromises = chunk.map(config => this.executeTest(config));
          const chunkResults = await Promise.allSettled(chunkPromises);
          
          chunkResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              results.push(result.value);
            } else {
              // Create failed result for rejected promises
              const config = chunk[index];
              const failedResult: TestResult = {
                id: uuidv4(),
                configId: config.id,
                status: 'failed',
                success: false,
                startTime: Date.now(),
                endTime: Date.now(),
                duration: 0,
                steps: [],
                validations: [],
                syncStates: [],
                error: result.reason,
                metadata: {}
              };
              results.push(failedResult);
            }
          });

          // Update progress
          suite.progress = Math.round((results.length / totalTests) * 100);
        }
      } else {
        // Execute tests sequentially
        for (let i = 0; i < suite.configs.length; i++) {
          const config = suite.configs[i];
          try {
            const result = await this.executeTest(config);
            results.push(result);
          } catch (error) {
            // Create failed result
            const failedResult: TestResult = {
              id: uuidv4(),
              configId: config.id,
              status: 'failed',
              success: false,
              startTime: Date.now(),
              endTime: Date.now(),
              duration: 0,
              steps: [],
              validations: [],
              syncStates: [],
              error: error as Error,
              metadata: {}
            };
            results.push(failedResult);
          }

          // Update progress
          suite.progress = Math.round(((i + 1) / totalTests) * 100);
        }
      }

      // Update suite with results
      suite.results = results;
      suite.status = 'completed';
      suite.endTime = Date.now();
      suite.progress = 100;

      // Determine overall status
      const hasFailures = results.some(r => r.status === 'failed');
      if (hasFailures) {
        suite.status = 'failed';
      }

      return suite;

    } catch (error) {
      suite.status = 'failed';
      suite.endTime = Date.now();
      throw error;
    }
  }

  /**
   * Get current sync state snapshot
   */
  getCurrentSyncState(): SyncStateSnapshot {
    const timestamp = Date.now();
    
    return {
      timestamp,
      pendingChangesCount: this.outgoingProcessor.getPendingChangesCount(),
      sentChangesCount: this.outgoingProcessor.getQueueSize(),
      queueSize: this.outgoingProcessor.getQueueSize(),
      connectionStatus: this.syncManager.getStatus(),
      lastLSN: this.syncManager.getLSN(),
      clientId: this.syncManager.getClientId()
    };
  }

  /**
   * Get test result by ID
   */
  getTestResult(testId: string): TestResult | undefined {
    return this.testResults.get(testId);
  }

  /**
   * Get all test results
   */
  getAllTestResults(): TestResult[] {
    return Array.from(this.testResults.values());
  }

  /**
   * Clear all test results
   */
  clearTestResults(): void {
    this.testResults.clear();
    this.stateSnapshots.clear();
    this.performanceMetrics.clear();
  }

  /**
   * Get all active tests
   */
  getActiveTests(): TestExecutionContext[] {
    return Array.from(this.activeTests.values());
  }

  /**
   * Stop a running test
   */
  async stopTest(testId: string): Promise<void> {
    const context = this.activeTests.get(testId);
    if (!context) {
      throw new Error(`Test ${testId} not found or not running`);
    }

    // Update context status
    context.status = 'cancelled';
    context.endTime = Date.now();

    // Create cancelled result
    const result: TestResult = {
      id: testId,
      configId: context.config.id,
      status: 'failed',
      success: false,
      startTime: context.startTime,
      endTime: context.endTime,
      duration: context.endTime - context.startTime,
      steps: [],
      validations: [],
      performance: this.performanceMetrics.get(testId),
      syncStates: this.stateSnapshots.get(testId) || [],
      error: new Error('Test cancelled by user'),
      metadata: { ...context.metadata, cancelled: true }
    };

    this.testResults.set(testId, result);
    this.activeTests.delete(testId);

    // Stop monitoring
    this.stopPerformanceMonitoring(testId);
    this.stopStateSnapshots(testId);

    this.emit('test_failed', testId, { result, error: result.error });
  }

  /**
   * Execute a test with custom test steps
   */
  async executeTestWithSteps(config: TestConfig, steps: TestStep[]): Promise<TestResult> {
    const testId = uuidv4();
    const startTime = Date.now();

    const context: TestExecutionContext = {
      config,
      startTime,
      currentPhase: 'setup',
      status: 'running',
      progress: 0,
      metadata: {}
    };

    this.activeTests.set(testId, context);
    this.emit('test_started', testId, { config });

    try {
      // Initialize performance monitoring
      if (this.options.enablePerformanceMonitoring) {
        this.startPerformanceMonitoring(testId);
      }

      // Initialize state snapshots
      if (this.options.enableStateSnapshots) {
        this.startStateSnapshots(testId);
      }

      // Execute custom test steps
      const stepResults: TestStepResult[] = [];
      const validations: ValidationResult[] = [];

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        context.currentPhase = step.phase;
        context.progress = Math.round(((i + 1) / steps.length) * 100);

        this.emit('step_started', testId, { step });

        try {
          // Execute step
          const stepResult = await step.execute(context);
          
          // Enhance stepResult with step metadata
          const enhancedStepResult: TestStepResult = {
            ...stepResult,
            metadata: {
              ...stepResult.metadata,
              stepId: step.id,
              stepName: step.name,
              stepDescription: step.description,
              stepPhase: step.phase
            }
          };
          
          stepResults.push(enhancedStepResult);

          // Validate step if validator provided
          if (step.validate) {
            const validation = await step.validate(context, enhancedStepResult);
            validations.push(validation);
          }

          this.emit('step_completed', testId, { step, success: stepResult.success });

          // Stop if step failed
          if (!stepResult.success) {
            throw stepResult.error || new Error(`Step ${step.name} failed`);
          }
        } catch (error) {
          this.emit('step_completed', testId, { step, success: false, error });
          throw error;
        }
      }

      // Create successful result
      const result: TestResult = {
        id: testId,
        configId: config.id,
        status: 'passed',
        success: true,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        steps: stepResults,
        validations,
        performance: this.performanceMetrics.get(testId),
        syncStates: this.stateSnapshots.get(testId) || [],
        metadata: context.metadata
      };

      this.testResults.set(testId, result);
      this.emit('test_completed', testId, { result });

      return result;

    } catch (error) {
      // Create failed result
      const result: TestResult = {
        id: testId,
        configId: config.id,
        status: 'failed',
        success: false,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        steps: [],
        validations: [],
        performance: this.performanceMetrics.get(testId),
        syncStates: this.stateSnapshots.get(testId) || [],
        error: error as Error,
        metadata: context.metadata
      };

      this.testResults.set(testId, result);
      this.emit('test_failed', testId, { result, error });

      throw error;

    } finally {
      // Cleanup
      this.activeTests.delete(testId);
      
      if (config.cleanupAfterTest) {
        await this.cleanupTest(testId);
      }

      // Stop monitoring
      this.stopPerformanceMonitoring(testId);
      this.stopStateSnapshots(testId);
    }
  }

  /**
   * Get services from sync manager or injected services
   */
  getServices(): any {
    // Return injected services if available
    if (this.services) {
      return this.services;
    }

    // Fallback: try to get services from the sync manager (legacy approach)
    try {
      return (this.syncManager as any).services;
    } catch (error) {
      console.warn('[SyncTestFramework] Could not get services from sync manager:', error);
      return null;
    }
  }

  /**
   * Get sync manager instance
   */
  getSyncManager(): SyncManager {
    return this.syncManager;
  }

  /**
   * Get local changes for validation
   */
  async getLocalChanges(): Promise<any[]> {
    try {
      return await this.outgoingProcessor.getPendingChanges();
    } catch (error) {
      console.warn('[SyncTestFramework] Could not get local changes:', error);
      return [];
    }
  }

  /**
   * Wait for specific sync state(s) with timeout
   */
  async waitForSyncState(targetStates: string[], timeoutMs: number = 10000): Promise<SyncStateSnapshot> {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const checkState = () => {
        const currentState = this.getCurrentSyncState();
        
        if (targetStates.includes(currentState.connectionStatus)) {
          resolve(currentState);
          return;
        }
        
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error(`Timeout waiting for sync state(s): ${targetStates.join(', ')}. Current: ${currentState.connectionStatus}`));
          return;
        }
        
        setTimeout(checkState, 100);
      };
      
      checkState();
    });
  }

  /**
   * Capture sync state delta between two snapshots
   */
  captureSyncStateDelta(beforeState: SyncStateSnapshot, afterState: SyncStateSnapshot) {
    return {
      pendingChangesIncrease: afterState.pendingChangesCount - beforeState.pendingChangesCount,
      queueSizeIncrease: afterState.queueSize - beforeState.queueSize,
      lsnChanged: afterState.lastLSN !== beforeState.lastLSN,
      connectionStatusChanged: afterState.connectionStatus !== beforeState.connectionStatus,
      timeDelta: afterState.timestamp - beforeState.timestamp
    };
  }

  /**
   * Monitor local changes for a specific operation
   * Returns the changes that were created during the operation
   */
  async monitorLocalChangesForOperation<T>(
    operation: () => Promise<T>,
    entityType?: string,
    operationType?: string
  ): Promise<{
    result: T;
    newChanges: any[];
    syncStateDelta: {
      pendingChangesIncrease: number;
      queueSizeIncrease: number;
      lsnChanged: boolean;
      connectionStatusChanged: boolean;
      timeDelta: number;
    };
  }> {
    // Capture baseline state
    const beforeState = this.getCurrentSyncState();
    const beforeChanges = await this.getLocalChanges();
    
    // Execute operation
    const result = await operation();
    
    // Wait a moment for sync processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Capture after state
    const afterState = this.getCurrentSyncState();
    const afterChanges = await this.getLocalChanges();
    
    // Find new changes (by comparing IDs or creation time)
    const newChanges = afterChanges.filter(change => 
      !beforeChanges.some(beforeChange => beforeChange.id === change.id)
    );
    
    // Filter for specific entity/operation if specified
    const filteredChanges = newChanges.filter(change => {
      if (entityType && change.tableName !== entityType) return false;
      if (operationType && change.operation !== operationType) return false;
      return true;
    });
    
    return {
      result,
      newChanges: filteredChanges,
      syncStateDelta: this.captureSyncStateDelta(beforeState, afterState)
    };
  }

  /**
   * Validate that a specific operation created the expected sync changes
   */
  async validateOperationSyncResponse(
    operation: () => Promise<any>,
    expectedOperation: string,
    expectedEntityType: string,
    entityId?: string
  ): Promise<{
    success: boolean;
    operation: any;
    changes: any[];
    validations: {
      changeCreated: boolean;
      correctOperation: boolean;
      correctEntityType: boolean;
      correctEntityId: boolean;
      syncStateIncreased: boolean;
    };
    details: any;
  }> {
    const monitoring = await this.monitorLocalChangesForOperation(
      operation,
      expectedEntityType,
      expectedOperation
    );
    
    const validations = {
      changeCreated: monitoring.newChanges.length > 0,
      correctOperation: monitoring.newChanges.some(change => change.operation === expectedOperation),
      correctEntityType: monitoring.newChanges.some(change => change.tableName === expectedEntityType),
      correctEntityId: entityId ? monitoring.newChanges.some(change => 
        change.data && (change.data.id === entityId || change.oldData?.id === entityId)
      ) : true,
      syncStateIncreased: monitoring.syncStateDelta.pendingChangesIncrease > 0
    };
    
    const success = Object.values(validations).every(v => v === true);
    
    return {
      success,
      operation: monitoring.result,
      changes: monitoring.newChanges,
      validations,
      details: {
        syncStateDelta: monitoring.syncStateDelta,
        expectedOperation,
        expectedEntityType,
        entityId
      }
    };
  }

  /**
   * Wait for local changes to be processed by sync system
   */
  async waitForChangesToSync(initialChangeCount: number, timeoutMs: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const checkChanges = async () => {
        const currentChanges = await this.getLocalChanges();
        const unprocessedChanges = currentChanges.filter(change => !change.processedSync);
        
        // If we have fewer unprocessed changes than we started with, sync is working
        if (unprocessedChanges.length < initialChangeCount) {
          resolve(true);
          return;
        }
        
        if (Date.now() - startTime > timeoutMs) {
          resolve(false);
          return;
        }
        
        setTimeout(checkChanges, 200);
      };
      
      checkChanges();
    });
  }

  /**
   * Get filtered local changes for specific criteria
   */
  async getFilteredLocalChanges(filters: {
    entityType?: string;
    operation?: string;
    unprocessedOnly?: boolean;
    createdAfter?: number;
  }): Promise<any[]> {
    const allChanges = await this.getLocalChanges();
    
    return allChanges.filter(change => {
      if (filters.entityType && change.tableName !== filters.entityType) return false;
      if (filters.operation && change.operation !== filters.operation) return false;
      if (filters.unprocessedOnly && change.processedSync) return false;
      if (filters.createdAfter && change.createdAt && change.createdAt <= filters.createdAfter) return false;
      return true;
    });
  }

  // Private methods

  private async executeTestPhases(testId: string, context: TestExecutionContext): Promise<void> {
    const phases: TestPhase[] = ['setup', 'data_generation', 'execution', 'validation', 'cleanup'];
    
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      context.currentPhase = phase;
      context.progress = Math.round(((i + 1) / phases.length) * 100);

      this.emit('step_started', testId, { phase });

      try {
        await this.executePhase(testId, context, phase);
        this.emit('step_completed', testId, { phase, success: true });
      } catch (error) {
        this.emit('step_completed', testId, { phase, success: false, error });
        throw error;
      }
    }
  }

  private async executePhase(testId: string, context: TestExecutionContext, phase: TestPhase): Promise<void> {
    switch (phase) {
      case 'setup':
        await this.setupPhase(testId, context);
        break;
      case 'data_generation':
        await this.dataGenerationPhase(testId, context);
        break;
      case 'execution':
        await this.executionPhase(testId, context);
        break;
      case 'validation':
        await this.validationPhase(testId, context);
        break;
      case 'cleanup':
        await this.cleanupPhase(testId, context);
        break;
    }
  }

  private async setupPhase(testId: string, context: TestExecutionContext): Promise<void> {
    // Setup test environment
    // This will be implemented by specific test scenarios
  }

  private async dataGenerationPhase(testId: string, context: TestExecutionContext): Promise<void> {
    // Generate test data
    // This will be implemented by specific test scenarios
  }

  private async executionPhase(testId: string, context: TestExecutionContext): Promise<void> {
    // Execute the actual test operations
    // This will be implemented by specific test scenarios
  }

  private async validationPhase(testId: string, context: TestExecutionContext): Promise<void> {
    // Validate test results
    // This will be implemented by specific test scenarios
  }

  private async cleanupPhase(testId: string, context: TestExecutionContext): Promise<void> {
    // Cleanup test artifacts
    await this.cleanupTest(testId);
  }

  private async cleanupTest(testId: string): Promise<void> {
    // Clear any test data, reset state, etc.
    try {
      // Clear unprocessed changes if any
      await this.outgoingProcessor.clearUnprocessedChanges();
    } catch (error) {
      console.warn('[SyncTestFramework] Error during cleanup:', error);
    }
  }

  private setupEventListeners(): void {
    // Listen to sync events for monitoring
    if (this.syncManager) {
      // Add event listeners for sync events
      // This will help track sync state during tests
    }
  }

  private startPerformanceMonitoring(testId: string): void {
    if (!this.options.enablePerformanceMonitoring) return;

    const metrics: PerformanceMetrics = {
      operationLatency: [],
      batchProcessingTime: [],
      syncCompletionTime: [],
      networkRoundTrip: [],
      throughput: {
        changesPerSecond: 0,
        batchesPerMinute: 0
      },
      resource: {
        memoryUsage: 0,
        cpuUtilization: 0
      }
    };

    this.performanceMetrics.set(testId, metrics);
  }

  private stopPerformanceMonitoring(testId: string): void {
    // Performance monitoring cleanup if needed
  }

  private startStateSnapshots(testId: string): void {
    if (!this.options.enableStateSnapshots) return;

    const snapshots: SyncStateSnapshot[] = [];
    this.stateSnapshots.set(testId, snapshots);

    // Take initial snapshot
    snapshots.push(this.getCurrentSyncState());

    // Set up interval for periodic snapshots
    const intervalId = setInterval(() => {
      if (this.activeTests.has(testId)) {
        snapshots.push(this.getCurrentSyncState());
      } else {
        clearInterval(intervalId);
      }
    }, this.options.snapshotInterval);
  }

  private stopStateSnapshots(testId: string): void {
    // State snapshot cleanup if needed
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
} 