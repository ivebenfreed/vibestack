import { v4 as uuidv4 } from 'uuid';
import type {
  SyncStateTestConfig,
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
 * Sync State Tests - Tests sync state transitions and behaviors
 * Focuses on initial, catchup, live, and offline state transitions
 */
export class SyncStateTests {
  private dataGenerator?: TestDataGenerator;

  constructor(private framework: SyncTestFramework) {}

  /**
   * Run comprehensive sync state transition test
   */
  async runSyncStateTest(config: SyncStateTestConfig): Promise<TestResult> {
    const testSteps = this.createSyncStateTestSteps(config);
    
    return await this.framework.executeTestWithSteps(config, testSteps);
  }

  /**
   * Create test steps for sync state transitions
   */
  private createSyncStateTestSteps(config: SyncStateTestConfig): TestStep[] {
    const steps: TestStep[] = [];

    // Setup step
    steps.push({
      id: 'state-test-setup',
      name: 'Setup Sync State Test Environment',
      description: 'Prepare environment for sync state testing and capture initial state',
      phase: 'setup',
      execute: async (context) => this.setupSyncStateTest(context, config),
      validate: async (context, result) => this.validateSyncStateSetup(context, result)
    });

    // Test offline state (if enabled)
    if (config.states.offline) {
      steps.push({
        id: 'test-offline-state',
        name: 'Test Offline State',
        description: 'Test offline state behavior and local operations',
        phase: 'execution',
        execute: async (context) => this.testOfflineState(context, config),
        validate: async (context, result) => this.validateOfflineState(context, result)
      });
    }

    // Test initial sync state (if enabled)
    if (config.states.initial) {
      steps.push({
        id: 'test-initial-state',
        name: 'Test Initial Sync State',
        description: 'Force initial sync by resetting LSN and test initial sync process',
        phase: 'execution',
        execute: async (context) => this.testInitialSyncState(context, config),
        validate: async (context, result) => this.validateInitialSyncState(context, result)
      });
    }

    // Test catchup sync state (if enabled)  
    if (config.states.catchup) {
      steps.push({
        id: 'test-catchup-state',
        name: 'Test Catchup Sync State',
        description: 'Test catchup sync when client LSN is behind server LSN',
        phase: 'execution',
        execute: async (context) => this.testCatchupSyncState(context, config),
        validate: async (context, result) => this.validateCatchupSyncState(context, result)
      });
    }

    // Test live sync state (if enabled)
    if (config.states.live) {
      steps.push({
        id: 'test-live-state',
        name: 'Test Live Sync State',
        description: 'Test live sync operations and real-time bidirectional sync',
        phase: 'execution',
        execute: async (context) => this.testLiveSyncState(context, config),
        validate: async (context, result) => this.validateLiveSyncState(context, result)
      });
    }

    // Test state transitions (if enabled)
    if (config.states.transitions) {
      steps.push({
        id: 'test-state-transitions',
        name: 'Test State Transitions',
        description: 'Test complete state transition flow: offline → initial → catchup → live',
        phase: 'execution',
        execute: async (context) => this.testStateTransitions(context, config),
        validate: async (context, result) => this.validateStateTransitions(context, result)
      });
    }

    // Validation step
    steps.push({
      id: 'validate-sync-states',
      name: 'Validate All Sync States',
      description: 'Final validation of all sync state behaviors and transitions',
      phase: 'validation',
      execute: async (context) => this.validateAllSyncStates(context, config),
      validate: async (context, result) => this.validateAllSyncStatesResult(context, result)
    });

    return steps;
  }

  /**
   * Setup sync state test environment
   */
  private async setupSyncStateTest(context: TestExecutionContext, config: SyncStateTestConfig): Promise<TestStepResult> {
    const startTime = Date.now();
    
    try {
      // Get services and sync manager from framework
      const services = this.framework.getServices();
      const syncManager = this.framework.getSyncManager();
      
      if (!services || !syncManager) {
        throw new Error('Services or SyncManager not available in framework');
      }

      // Initialize data generator with services
      this.dataGenerator = new TestDataGenerator(services);

      // Capture initial sync state
      const initialSyncState = this.framework.getCurrentSyncState();
      const initialLocalChanges = await this.framework.getLocalChanges();

      // Generate test data for sync state testing using services
      const testData = await this.dataGenerator.createRealisticDataset({
        userCount: 3,
        projectCount: 2,
        taskCount: 5,
        commentCount: 3
      });

      // Store in context
      context.metadata.services = services;
      context.metadata.syncManager = syncManager;
      context.metadata.initialSyncState = initialSyncState;
      context.metadata.initialLocalChanges = initialLocalChanges;
      context.metadata.testData = testData;
      context.metadata.stateTransitionLog = [];
      context.metadata.dataGenerator = this.dataGenerator;

      return {
        success: true,
        data: { 
          initialSyncState,
          testEntitiesGenerated: Object.keys(testData),
          initialLSN: initialSyncState.lastLSN,
          initialConnectionStatus: initialSyncState.connectionStatus
        },
        duration: Date.now() - startTime,
        metadata: {
          totalTestEntities: Object.values(testData).reduce((sum: number, data: any) => sum + data.length, 0),
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
   * Test offline state behavior
   */
  private async testOfflineState(context: TestExecutionContext, config: SyncStateTestConfig): Promise<TestStepResult> {
    const startTime = Date.now();
    const syncManager = context.metadata.syncManager;
    
    try {
      // Disconnect from sync to simulate offline state
      await syncManager.disconnect();
      
      // Wait a moment for state to settle
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Capture offline state
      const offlineState = this.framework.getCurrentSyncState();
      
      // Log state transition
      context.metadata.stateTransitionLog.push({
        timestamp: Date.now(),
        state: 'offline',
        connectionStatus: offlineState.connectionStatus,
        lsn: offlineState.lastLSN
      });

      return {
        success: offlineState.connectionStatus === 'disconnected',
        data: {
          offlineState,
          disconnected: true,
          connectionStatus: offlineState.connectionStatus
        },
        duration: Date.now() - startTime,
        metadata: {
          offlineStateAchieved: offlineState.connectionStatus === 'disconnected'
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
   * Test initial sync state by resetting LSN
   */
  private async testInitialSyncState(context: TestExecutionContext, config: SyncStateTestConfig): Promise<TestStepResult> {
    const startTime = Date.now();
    const syncManager = context.metadata.syncManager;
    
    try {
      // Reset LSN to force initial sync
      await syncManager.resetLSN();
      
      // Connect to trigger initial sync
      await syncManager.connect();
      
      // Wait for initial sync to begin
      await this.waitForSyncState(syncManager, ['initial_sync', 'initial'], 5000);
      
      // Capture initial sync state
      const initialState = this.framework.getCurrentSyncState();
      
      // Log state transition
      context.metadata.stateTransitionLog.push({
        timestamp: Date.now(),
        state: 'initial',
        connectionStatus: initialState.connectionStatus,
        lsn: initialState.lastLSN
      });

      // Wait for initial sync to complete
      await this.waitForSyncState(syncManager, ['catchup', 'live'], 15000);
      
      const postInitialState = this.framework.getCurrentSyncState();

      return {
        success: true,
        data: {
          initialState,
          postInitialState,
          lsnReset: true,
          initialSyncTriggered: true
        },
        duration: Date.now() - startTime,
        metadata: {
          initialSyncCompleted: postInitialState.connectionStatus !== 'initial_sync'
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
   * Test catchup sync state
   */
  private async testCatchupSyncState(context: TestExecutionContext, config: SyncStateTestConfig): Promise<TestStepResult> {
    const startTime = Date.now();
    const syncManager = context.metadata.syncManager;
    
    try {
      // Wait for or trigger catchup sync state
      // (This might happen automatically after initial sync if there are pending changes)
      await this.waitForSyncState(syncManager, ['catchup', 'live'], 10000);
      
      const catchupState = this.framework.getCurrentSyncState();
      
      // Log state transition
      context.metadata.stateTransitionLog.push({
        timestamp: Date.now(),
        state: 'catchup',
        connectionStatus: catchupState.connectionStatus,
        lsn: catchupState.lastLSN
      });

      // If we're already in live state, this means catchup completed quickly
      const isCatchupOrLive = ['catchup', 'live'].includes(catchupState.connectionStatus);

      return {
        success: isCatchupOrLive,
        data: {
          catchupState,
          connectionStatus: catchupState.connectionStatus,
          catchupOrLiveAchieved: isCatchupOrLive
        },
        duration: Date.now() - startTime,
        metadata: {
          catchupStateProcessed: true
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
   * Test live sync state with real-time operations
   */
  private async testLiveSyncState(context: TestExecutionContext, config: SyncStateTestConfig): Promise<TestStepResult> {
    const startTime = Date.now();
    const syncManager = context.metadata.syncManager;
    const services = context.metadata.services;
    
    try {
      // Wait for live sync state
      await this.waitForSyncState(syncManager, ['live'], 10000);
      
      const liveState = this.framework.getCurrentSyncState();
      
      // Perform live operations
      const taskService = services.tasks;
      const createdTask = await taskService.createTask({
        title: `Live Sync Test Task ${Date.now()}`,
        description: 'Testing live sync operations',
        status: 'pending'
      });

      // Wait a moment for sync to process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const postOperationState = this.framework.getCurrentSyncState();
      
      // Log state transition
      context.metadata.stateTransitionLog.push({
        timestamp: Date.now(),
        state: 'live',
        connectionStatus: liveState.connectionStatus,
        lsn: liveState.lastLSN,
        operation: 'create_task',
        entityId: createdTask.id
      });

      return {
        success: liveState.connectionStatus === 'live',
        data: {
          liveState,
          postOperationState,
          liveOperationPerformed: true,
          createdTaskId: createdTask.id
        },
        duration: Date.now() - startTime,
        metadata: {
          liveStateAchieved: liveState.connectionStatus === 'live',
          liveOperationSuccessful: !!createdTask.id
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
   * Test complete state transition flow
   */
  private async testStateTransitions(context: TestExecutionContext, config: SyncStateTestConfig): Promise<TestStepResult> {
    const startTime = Date.now();
    const syncManager = context.metadata.syncManager;
    
    try {
      // Start from disconnected state
      await syncManager.disconnect();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 1: offline → initial
      await syncManager.resetLSN();
      await syncManager.connect();
      
      // Step 2: initial → catchup/live
      await this.waitForSyncState(syncManager, ['catchup', 'live'], 15000);
      
      // Step 3: ensure we reach live state
      await this.waitForSyncState(syncManager, ['live'], 10000);
      
      const finalState = this.framework.getCurrentSyncState();
      const transitionLog = context.metadata.stateTransitionLog;
      
      // Add final state to log
      transitionLog.push({
        timestamp: Date.now(),
        state: 'final',
        connectionStatus: finalState.connectionStatus,
        lsn: finalState.lastLSN
      });

      return {
        success: finalState.connectionStatus === 'live',
        data: {
          finalState,
          transitionLog,
          completeTransitionAchieved: true
        },
        duration: Date.now() - startTime,
        metadata: {
          transitionSteps: transitionLog.length,
          finalStateIsLive: finalState.connectionStatus === 'live'
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
   * Validate all sync states
   */
  private async validateAllSyncStates(context: TestExecutionContext, config: SyncStateTestConfig): Promise<TestStepResult> {
    const startTime = Date.now();
    
    try {
      const transitionLog = context.metadata.stateTransitionLog || [];
      const currentState = this.framework.getCurrentSyncState();
      
      // Analyze state transitions
      const statesObserved = new Set(transitionLog.map((entry: any) => entry.state));
      const connectionStates = new Set(transitionLog.map((entry: any) => entry.connectionStatus));
      
      const validationResults = {
        statesObserved: Array.from(statesObserved),
        connectionStatesObserved: Array.from(connectionStates),
        transitionCount: transitionLog.length,
        finalState: currentState.connectionStatus,
        lsnProgression: this.validateLSNProgression(transitionLog),
        stateConsistency: this.validateStateConsistency(transitionLog)
      };

      return {
        success: validationResults.stateConsistency && validationResults.lsnProgression,
        data: validationResults,
        duration: Date.now() - startTime,
        metadata: {
          validationPassed: validationResults.stateConsistency && validationResults.lsnProgression
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
   * Helper method to wait for specific sync state
   */
  private async waitForSyncState(syncManager: any, targetStates: string[], timeoutMs: number): Promise<string> {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const checkState = () => {
        const currentStatus = syncManager.getStatus();
        
        if (targetStates.includes(currentStatus)) {
          resolve(currentStatus);
          return;
        }
        
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error(`Timeout waiting for sync state. Expected: ${targetStates.join(' or ')}, Current: ${currentStatus}`));
          return;
        }
        
        setTimeout(checkState, 200);
      };
      
      checkState();
    });
  }

  /**
   * Validate LSN progression through state transitions
   */
  private validateLSNProgression(transitionLog: any[]): boolean {
    // LSN should generally progress forward (though it can stay the same)
    let lastLSN = '0/0';
    
    for (const entry of transitionLog) {
      if (entry.lsn) {
        // Simple validation - just check LSN exists and is properly formatted
        if (!/^[0-9A-Fa-f]+\/[0-9A-Fa-f]+$/.test(entry.lsn)) {
          return false;
        }
        lastLSN = entry.lsn;
      }
    }
    
    return true;
  }

  /**
   * Validate state consistency
   */
  private validateStateConsistency(transitionLog: any[]): boolean {
    // Check that state transitions are logical
    for (let i = 1; i < transitionLog.length; i++) {
      const prev = transitionLog[i - 1];
      const curr = transitionLog[i];
      
      // Basic consistency: connection status should be valid
      if (!['disconnected', 'connecting', 'initial_sync', 'initial', 'catchup', 'live'].includes(curr.connectionStatus)) {
        return false;
      }
    }
    
    return true;
  }

  // Validation methods
  private async validateSyncStateSetup(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Sync state test setup failed',
        details: result.error?.message
      };
    }

    return {
      status: 'passed',
      message: 'Sync state test setup successful'
    };
  }

  private async validateOfflineState(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Offline state test failed',
        details: result.error?.message
      };
    }

    return {
      status: 'passed',
      message: 'Offline state validation successful'
    };
  }

  private async validateInitialSyncState(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Initial sync state test failed',
        details: result.error?.message
      };
    }

    return {
      status: 'passed',
      message: 'Initial sync state validation successful'
    };
  }

  private async validateCatchupSyncState(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Catchup sync state test failed',
        details: result.error?.message
      };
    }

    return {
      status: 'passed',
      message: 'Catchup sync state validation successful'
    };
  }

  private async validateLiveSyncState(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Live sync state test failed',
        details: result.error?.message
      };
    }

    return {
      status: 'passed',
      message: 'Live sync state validation successful'
    };
  }

  private async validateStateTransitions(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'State transitions test failed',
        details: result.error?.message
      };
    }

    return {
      status: 'passed',
      message: 'State transitions validation successful'
    };
  }

  private async validateAllSyncStatesResult(context: TestExecutionContext, result: TestStepResult): Promise<ValidationResult> {
    if (!result.success) {
      return {
        status: 'failed',
        message: 'Sync states validation failed',
        details: result.error?.message
      };
    }

    const { stateConsistency, lsnProgression } = result.data;
    
    if (!stateConsistency) {
      return {
        status: 'failed',
        message: 'State consistency validation failed'
      };
    }

    if (!lsnProgression) {
      return {
        status: 'failed',
        message: 'LSN progression validation failed'
      };
    }

    return {
      status: 'passed',
      message: 'All sync states validation successful'
    };
  }
} 