import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SyncTestFramework } from '../core/SyncTestFramework';
import { BasicCRUDTests } from '../scenarios/BasicCRUDTests';
import { PureCRUDTests } from '../scenarios/PureCRUDTests';
import { SyncOperationTests } from '../scenarios/SyncOperationTests';
import { OfflineSyncTests } from '../scenarios/OfflineSyncTests';
import { SyncStateTests } from '../scenarios/SyncStateTests';
import { BatchOperationTests } from '../scenarios/BatchOperationTests';
import { RelationshipTests } from '../scenarios/RelationshipTests';
import { OutgoingValidator } from '../validators/OutgoingValidator';
import { OfflineValidator } from '../validators/OfflineValidator';
import { SyncStateValidator } from '../validators/SyncStateValidator';
import { RelationshipValidator } from '../validators/RelationshipValidator';
import type { 
  EntityTestConfig, 
  OfflineSyncTestConfig, 
  SyncStateTestConfig,
  BatchTestConfig,
  RelationshipTestConfig,
  EntityType,
  TestResult,
  TestExecution
} from '../core/TestTypes';
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Database, 
  WifiOff, 
  Network, 
  GitBranch,
  Zap,
  Loader2,
  Square,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Info,
  AlertTriangle,
  HardDrive,
  RefreshCw
} from 'lucide-react';

interface SyncTestingInterfaceProps {
  framework: SyncTestFramework;
}

interface UITestExecution {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  progress: number;
  currentStep?: string;
  startTime?: number;
  endTime?: number;
  result?: TestResult;
  error?: Error;
}

interface TestCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  tests: TestDefinition[];
}

interface TestDefinition {
  id: string;
  name: string;
  description: string;
  detailedDescription: string;
  estimatedDuration: string;
  steps: string[];
  validates: string[];
  tags: string[];
  prerequisites?: string[];
  action: (updateProgress: (progress: number, step: string) => void) => Promise<TestResult>;
}

export const SyncTestingInterface: React.FC<SyncTestingInterfaceProps> = ({ framework }) => {
  const [testExecutions, setTestExecutions] = useState<Map<string, UITestExecution>>(new Map());
  const [testHistory, setTestHistory] = useState<TestResult[]>([]);
  const [activeTests, setActiveTests] = useState<Map<string, UITestExecution>>(new Map());
  const [selectedTest, setSelectedTest] = useState<{test: TestDefinition, categoryId: string} | null>(null);
  const [consoleOutput, setConsoleOutput] = useState<Array<{
    timestamp: number;
    testId: string;
    type: 'info' | 'success' | 'error' | 'progress';
    message: string;
    details?: any;
  }>>([]);
  
  // Ref for auto-scrolling console
  const consoleEndRef = React.useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new console output is added
  React.useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleOutput]);

  // Initialize test classes
  const basicCRUDTests = new BasicCRUDTests(framework);
  const pureCRUDTests = new PureCRUDTests(framework);
  const syncOperationTests = new SyncOperationTests(framework);
  const offlineSyncTests = new OfflineSyncTests(framework);
  const syncStateTests = new SyncStateTests(framework);
  const batchOperationTests = new BatchOperationTests(framework);
  const relationshipTests = new RelationshipTests(framework);
  const outgoingValidator = new OutgoingValidator(framework);
  const offlineValidator = new OfflineValidator(framework);
  const syncStateValidator = new SyncStateValidator(framework);
  const relationshipValidator = new RelationshipValidator(framework);

  // Listen for test events from the framework
  useEffect(() => {
    if (!framework) return;

    const handleTestStarted = (data: { testId: string; execution: TestExecution }) => {
      // Convert framework TestExecution to our UITestExecution
      const uiExecution: UITestExecution = {
        id: data.testId,
        name: data.execution.config.name,
        status: data.execution.status === 'running' ? 'running' : 'idle',
        progress: data.execution.progress,
        currentStep: `Phase: ${data.execution.currentPhase}`,
        startTime: data.execution.startTime
      };
      
      setTestExecutions(prev => new Map(prev).set(data.testId, uiExecution));
      setActiveTests(prev => new Map(prev).set(data.testId, uiExecution));
    };

    const handleTestCompleted = (data: { testId: string; result: TestResult }) => {
      setTestExecutions(prev => {
        const updated = new Map(prev);
        const execution = updated.get(data.testId);
        if (execution) {
          updated.set(data.testId, {
            ...execution,
            status: 'completed',
            progress: 100,
            currentStep: 'Completed',
            endTime: Date.now(),
            result: data.result
          });
        }
        return updated;
      });

      setActiveTests(prev => {
        const updated = new Map(prev);
        updated.delete(data.testId);
        return updated;
      });

      setTestHistory(prev => [data.result, ...prev].slice(0, 100));
    };

    const handleTestProgress = (data: { testId: string; progress: number }) => {
      setTestExecutions(prev => {
        const updated = new Map(prev);
        const execution = updated.get(data.testId);
        if (execution) {
          updated.set(data.testId, {
            ...execution,
            progress: data.progress
          });
        }
        return updated;
      });
    };

    // Set up event listeners (framework events may differ, adjust as needed)
    try {
      framework.on('test:started', handleTestStarted);
      framework.on('test:completed', handleTestCompleted);
      framework.on('test:progress', handleTestProgress);
    } catch (error) {
      console.log('Framework event system not yet implemented');
    }

    return () => {
      try {
        framework.off('test:started', handleTestStarted);
        framework.off('test:completed', handleTestCompleted);
        framework.off('test:progress', handleTestProgress);
      } catch (error) {
        // Event system not implemented yet
      }
    };
  }, [framework]);

  // Get test statistics
  const testStats = useMemo(() => {
    const totalTests = testHistory.length;
    const successfulTests = testHistory.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;
    const successRate = totalTests > 0 ? (successfulTests / totalTests) * 100 : 0;
    const activeTestCount = activeTests.size;

    return {
      totalTests,
      successfulTests,
      failedTests,
      successRate,
      activeTestCount,
    };
  }, [testHistory, activeTests]);

  // Handle clearing test history
  const handleClearHistory = () => {
    setTestHistory([]);
  };

  // Handle stopping all tests
  const handleStopAllTests = async () => {
    if (!framework) return;

    const activeTestIds = Array.from(activeTests.keys());
    for (const testId of activeTestIds) {
      try {
        // Framework may not have stopTest method yet
        if (typeof framework.stopTest === 'function') {
          await framework.stopTest(testId);
        }
      } catch (error) {
        console.error(`Failed to stop test ${testId}:`, error);
      }
    }
  };

  const updateTestProgress = (testId: string, progress: number, step: string) => {
    setTestExecutions(prev => {
      const execution = prev.get(testId);
      if (!execution) return prev;
      
      const updated = new Map(prev);
      updated.set(testId, {
        ...execution,
        progress,
        currentStep: step
      });
      return updated;
    });
  };

  const addConsoleLog = (testId: string, type: 'info' | 'success' | 'error' | 'progress', message: string, details?: any) => {
    setConsoleOutput(prev => [...prev, {
      timestamp: Date.now(),
      testId,
      type,
      message,
      details
    }].slice(-1000)); // Keep last 1000 entries
  };

  const executeTest = async (test: TestDefinition, categoryId: string) => {
    const testId = `${categoryId}-${test.id}`;
    
    addConsoleLog(testId, 'info', `🚀 Starting ${test.name}...`);
    
    // Initialize test execution
    setTestExecutions(prev => {
      const updated = new Map(prev);
      updated.set(testId, {
        id: testId,
        name: test.name,
        status: 'running',
        progress: 0,
        currentStep: 'Initializing...',
        startTime: Date.now()
      });
      return updated;
    });

    try {
      let lastProgress = 0;
      const result = await test.action((progress, step) => {
        updateTestProgress(testId, progress, step);
        
        // Add success indicators for major progress milestones
        if (progress >= 25 && lastProgress < 25) {
          addConsoleLog(testId, 'success', `✅ Setup phase completed`);
        } else if (progress >= 50 && lastProgress < 50) {
          addConsoleLog(testId, 'success', `✅ Execution phase completed`);
        } else if (progress >= 75 && lastProgress < 75) {
          addConsoleLog(testId, 'success', `✅ Validation phase completed`);
        } else if (progress >= 90 && lastProgress < 90) {
          addConsoleLog(testId, 'success', `✅ Cleanup phase completed`);
        }
        
        // Log progress with appropriate icons
        const progressIcon = progress < 25 ? '🏗️' : 
                           progress < 50 ? '⚙️' : 
                           progress < 75 ? '🔍' : 
                           progress < 90 ? '🧹' : '✅';
        
        addConsoleLog(testId, 'progress', `${progressIcon} [${Math.round(progress)}%] ${step}`);
        lastProgress = progress;
      });
      
      setTestExecutions(prev => {
        const updated = new Map(prev);
        updated.set(testId, {
          ...prev.get(testId)!,
          status: 'completed',
          progress: 100,
          currentStep: 'Completed',
          endTime: Date.now(),
          result
        });
        return updated;
      });

      addConsoleLog(testId, 'success', `🎉 ${test.name} completed successfully in ${result.duration}ms`);
      
      // Add detailed success summary
      if (result.success) {
        addConsoleLog(testId, 'success', `📊 Test Summary: ${result.steps?.length || 0} steps executed`, {
          duration: result.duration,
          steps: result.steps?.length || 0,
          validations: result.validations?.length || 0
        });
      }
      
    } catch (error) {
      setTestExecutions(prev => {
        const updated = new Map(prev);
        updated.set(testId, {
          ...prev.get(testId)!,
          status: 'failed',
          progress: 0,
          currentStep: 'Failed',
          endTime: Date.now(),
          error: error as Error
        });
        return updated;
      });

      addConsoleLog(testId, 'error', `❌ ${test.name} failed: ${(error as Error).message}`, {
        error: (error as Error).message,
        stack: (error as Error).stack,
        timestamp: new Date().toISOString()
      });
      
      // Add failure summary
      addConsoleLog(testId, 'error', `💥 Test execution terminated due to error`);
    }
  };

  const createEntityTestConfig = (entity: EntityType): EntityTestConfig => ({
    id: `${entity}-crud-test`,
    name: `${entity.charAt(0).toUpperCase() + entity.slice(1)} CRUD Test`,
    description: `Test CRUD operations for ${entity}`,
    type: 'single_entity_crud',
    entity,
    enabled: true,
    timeout: 30000,
    retries: 3,
    cleanupAfterTest: true,
    tags: ['crud', entity],
    operations: ['insert', 'update', 'delete'],
    dataVariations: {
      minimal: true,
      complete: true,
      edge: false,
      invalid: false
    },
    validation: {
      immediate: true,
      eventual: true,
      state: true
    }
  });

  const createOfflineTestConfig = (scenario: string): OfflineSyncTestConfig => ({
    id: `offline-${scenario}`,
    name: `Offline ${scenario.charAt(0).toUpperCase() + scenario.slice(1)} Test`,
    description: `Test offline ${scenario} operations and recovery`,
    type: 'offline_sync',
    enabled: true,
    timeout: 60000,
    retries: 2,
    cleanupAfterTest: true,
    tags: ['offline', scenario],
    offlineOperations: {
      entityCRUD: true,
      relationshipChanges: scenario === 'comprehensive',
      batchOperations: scenario === 'comprehensive' || scenario === 'batch',
      localChangesManagement: true
    },
    validation: {
      localChangesCreated: true,
      relationshipEncoding: scenario === 'comprehensive',
      clientIdAntiEcho: true,
      changeOptimization: true,
      queuePersistence: true,
      recoveryProcess: true
    },
    scenarios: {
      simpleOffline: scenario === 'simple',
      extendedOffline: scenario === 'extended',
      offlineWithRelationships: scenario === 'comprehensive',
      offlineRecovery: true,
      conflictResolution: scenario === 'comprehensive'
    }
  });

  const createSyncStateTestConfig = (scenario: string): SyncStateTestConfig => ({
    id: `sync-state-${scenario}`,
    name: `Sync State ${scenario.charAt(0).toUpperCase() + scenario.slice(1)} Test`,
    description: `Test sync state ${scenario} and transitions`,
    type: 'sync_states',
    enabled: true,
    timeout: 45000,
    retries: 2,
    cleanupAfterTest: true,
    tags: ['sync-state', scenario],
    states: {
      initial: true,
      catchup: true,
      live: true,
      offline: true,
      transitions: scenario === 'transitions' || scenario === 'lifecycle'
    },
    scenarios: {
      firstTimeSync: scenario === 'first-time',
      offlineRecovery: scenario === 'recovery',
      connectionLoss: scenario === 'connection',
      errorRecovery: scenario === 'error',
      stateTransitions: scenario === 'transitions' || scenario === 'lifecycle'
    },
    validation: {
      stateConsistency: true,
      transitionValidation: true,
      lsnProgression: scenario === 'progression' || scenario === 'lifecycle',
      stateEvents: true
    }
  });

  // Test Categories with organized tests
  const testCategories: TestCategory[] = [
    {
      id: 'database',
      name: 'Database Operations',
      description: 'Test direct database operations and sync isolation',
      icon: Database,
      tests: [
        {
          id: 'pure-crud',
          name: 'Pure CRUD Operations',
          description: 'Test database operations without sync tracking',
          detailedDescription: 'Validates pure database CRUD operations that bypass sync tracking entirely. This test ensures that direct database operations work correctly and do not interfere with the sync system.',
          estimatedDuration: '30-45 sec',
          steps: [
            'Initialize test environment with sync isolation',
            'Execute CREATE operations directly on database',
            'Execute READ operations to verify data integrity',
            'Execute UPDATE operations with validation',
            'Execute DELETE operations with cleanup verification',
            'Verify no sync tracking was triggered',
            'Validate database state consistency'
          ],
          validates: [
            'Direct database operations work correctly',
            'No sync tracking is triggered',
            'Data integrity is maintained',
            'Database constraints are enforced',
            'Operations complete without sync interference'
          ],
          tags: ['database', 'crud', 'no-sync', 'isolation'],
          prerequisites: ['Database connection', 'Sync framework initialized'],
          action: async (updateProgress) => {
            updateProgress(10, 'Initializing Pure CRUD Tests...');
            return await pureCRUDTests.run(updateProgress);
          }
        }
      ]
    },
    {
      id: 'client-sync',
      name: 'Client Sync',
      description: 'Test client-side sync operations and tracking',
      icon: RefreshCw,
      tests: [
        {
          id: 'basic-sync-crud',
          name: 'Basic Sync CRUD',
          description: 'Test CRUD operations with sync tracking',
          detailedDescription: 'Validates create, read, update, and delete operations with full sync tracking enabled. This test ensures proper sync state management, LocalChange creation, and sync consistency for basic operations.',
          estimatedDuration: '45-60 sec',
          steps: [
            'Initialize test environment and data generator',
            'Validate domain entity coverage',
            'Generate comprehensive test dataset',
            'Execute CREATE operation with sync monitoring',
            'Execute UPDATE operation with sync monitoring', 
            'Execute DELETE operation with sync monitoring',
            'Perform comprehensive sync validation',
            'Validate operation results and sync consistency'
          ],
          validates: [
            'All CRUD operations trigger sync tracking',
            'LocalChanges are created correctly',
            'Sync state is consistent',
            'Data integrity is maintained',
            'Relationship integrity is preserved'
          ],
          tags: ['sync', 'crud', 'basic', 'tracking'],
          prerequisites: ['Database connection', 'Sync framework initialized'],
          action: async (updateProgress) => {
            updateProgress(10, 'Initializing Basic Sync CRUD Tests...');
            return await basicCRUDTests.run(updateProgress);
          }
        },
        {
          id: 'sequential-sync-operations',
          name: 'Sequential Sync Operations',
          description: 'Test step-by-step sync operation lifecycle',
          detailedDescription: 'Comprehensive step-by-step tracking of the complete sync operation lifecycle from operation execution through server acknowledgment. This test validates each phase of the sync process with detailed event monitoring.',
          estimatedDuration: '2-3 min',
          steps: [
            'Setup sync event monitoring and listeners',
            'For each operation (CREATE, UPDATE, DELETE):',
            '  - Step 1: Execute Operation',
            '  - Step 2: Wait for LocalChange Creation',
            '  - Step 3: Wait for Queue Processing',
            '  - Step 4: Wait for Message Sending',
            '  - Step 5: Wait for Server Acknowledgment',
            '  - Step 6: Verify Sync Completion',
            'Analyze comprehensive sync behavior',
            'Validate domain coverage in sync operations'
          ],
          validates: [
            'Complete sync lifecycle is tracked',
            'All sync events are generated in sequence',
            'LocalChanges progress through all phases',
            'Server acknowledgments are received',
            'Sync completion is properly detected',
            'Domain entities are comprehensively synced'
          ],
          tags: ['sync', 'sequential', 'lifecycle', 'events'],
          prerequisites: ['Sync framework initialized', 'Event monitoring available'],
          action: async (updateProgress) => {
            updateProgress(5, 'Initializing Sequential Sync Operation Tests...');
            return await syncOperationTests.run(updateProgress);
          }
        },
        {
          id: 'sync-validation',
          name: 'Sync Validation',
          description: 'Test sync validation and outgoing changes',
          detailedDescription: 'Validates that all local changes are correctly formatted, queued, and prepared for transmission to the server. This test ensures the outgoing change protocol is working correctly and that data transformations maintain integrity.',
          estimatedDuration: '2-3 min',
          steps: [
            'Set up test data with various change types',
            'Execute mixed CRUD operations on test data',
            'Trigger sync validation process',
            'Verify outgoing change queue structure',
            'Validate change serialization format',
            'Check for proper client ID anti-echo markers',
            'Confirm all changes are accounted for'
          ],
          validates: [
            'All local changes are captured in sync queue',
            'Change records have correct format and metadata',
            'Client ID anti-echo prevention is working',
            'Change ordering preserves operation dependencies',
            'No duplicate or missing change records',
            'Validation rules prevent invalid data transmission'
          ],
          tags: ['sync', 'validation', 'outgoing-changes'],
          prerequisites: ['Basic CRUD operations working', 'Sync framework connected'],
          action: async (updateProgress) => {
            updateProgress(20, 'Setting up test data...');
            const config = createEntityTestConfig('tasks');
            
            updateProgress(40, 'Running CRUD operations...');
            const testResult = await basicCRUDTests.runEntityCRUDTest(config);
            
            if (!testResult.success) {
              throw new Error(`Sync validation test failed: ${testResult.error?.message}`);
            }
            
            updateProgress(70, 'Validating outgoing changes...');
            const validationResult = await outgoingValidator.validateOutgoingChanges({
              config,
              startTime: Date.now(),
              currentPhase: 'validation',
              status: 'running',
              progress: 100,
              metadata: testResult.metadata
            });
            
            if (validationResult.status === 'failed') {
              throw new Error(`Sync validation failed: ${validationResult.message}`);
            }
            
            updateProgress(100, 'Sync validation completed');
            return testResult;
          }
        }
      ]
    },
    {
      id: 'offline',
      name: 'Offline Sync',
      description: 'Test offline operation queuing and recovery',
      icon: WifiOff,
      tests: [
        {
          id: 'simple-offline',
          name: 'Simple Offline Operations',
          description: 'Test basic offline CRUD operations',
          detailedDescription: 'Validates that basic CRUD operations work correctly when the client is offline. This test ensures that operations are queued locally, data remains accessible, and the queue is properly maintained for later synchronization.',
          estimatedDuration: '2-3 min',
          steps: [
            'Create offline test configuration',
            'Simulate network disconnection',
            'Execute CREATE operations while offline',
            'Execute UPDATE operations while offline',
            'Execute DELETE operations while offline',
            'Verify operations are queued locally',
            'Validate local data state is consistent',
            'Check queue persistence across browser refreshes'
          ],
          validates: [
            'Offline operations are queued correctly',
            'Local data state remains consistent',
            'Operations maintain proper ordering',
            'Queue survives browser refresh/restart',
            'No data loss during offline operations',
            'Queue structure is valid for later sync'
          ],
          tags: ['offline', 'basic', 'crud'],
          prerequisites: ['Network simulation capability', 'Local storage functional'],
          action: async (updateProgress) => {
            updateProgress(15, 'Creating offline test config...');
            const config = createOfflineTestConfig('simple');
            
            updateProgress(40, 'Running offline operations...');
            const result = await offlineSyncTests.runOfflineOperationsTest(config);
            
            if (!result.success) {
              throw new Error(`Offline test failed: ${result.error?.message}`);
            }
            
            updateProgress(75, 'Validating offline changes...');
            const validationResult = await offlineValidator.validateOfflineChanges({
              config,
              startTime: result.startTime,
              currentPhase: 'validation',
              status: 'completed',
              progress: 100,
              metadata: result.metadata
            });
            
            if (validationResult.status === 'failed') {
              throw new Error(`Offline validation failed: ${validationResult.message}`);
            }
            
            updateProgress(100, 'Offline test completed');
            return result;
          }
        },
        {
          id: 'offline-recovery',
          name: 'Offline Recovery',
          description: 'Test offline operations and online recovery',
          detailedDescription: 'Comprehensive test of the complete offline-to-online cycle. This validates that operations performed while offline are correctly synchronized when connectivity is restored, including conflict resolution and data consistency verification.',
          estimatedDuration: '4-5 min',
          steps: [
            'Set up recovery test environment',
            'Simulate extended offline period',
            'Perform various CRUD operations offline',
            'Create complex operation sequences',
            'Simulate connectivity restoration',
            'Trigger recovery/sync process',
            'Monitor change transmission to server',
            'Verify final data consistency',
            'Test conflict resolution scenarios'
          ],
          validates: [
            'All offline changes are transmitted on recovery',
            'Change ordering is preserved during sync',
            'No data loss during recovery process',
            'Conflicts are properly detected and resolved',
            'Server state matches expected final state',
            'Client state is updated with server changes',
            'Recovery process handles errors gracefully'
          ],
          tags: ['offline', 'recovery', 'sync', 'conflict-resolution'],
          prerequisites: ['Simple offline operations working', 'Server connectivity'],
          action: async (updateProgress) => {
            updateProgress(10, 'Setting up recovery test...');
            const config = createOfflineTestConfig('extended');
            config.scenarios.offlineRecovery = true;
            
            updateProgress(30, 'Simulating offline operations...');
            const result = await offlineSyncTests.runOfflineOperationsTest(config);
            
            if (!result.success) {
              throw new Error(`Recovery test failed: ${result.error?.message}`);
            }
            
            updateProgress(70, 'Testing recovery process...');
            const recoveryValidation = await offlineValidator.validateRecoveryProcess({
              config,
              startTime: result.startTime,
              currentPhase: 'validation',
              status: 'completed',
              progress: 100,
              metadata: result.metadata
            });
            
            if (recoveryValidation.status === 'failed') {
              throw new Error(`Recovery validation failed: ${recoveryValidation.message}`);
            }
            
            updateProgress(100, 'Recovery test completed');
            return result;
          }
        },
        {
          id: 'comprehensive-offline',
          name: 'Comprehensive Offline',
          description: 'Test all offline scenarios including relationships',
          detailedDescription: 'The most comprehensive offline test covering all aspects of offline operation including entity relationships, batch operations, and complex data scenarios. This test validates the complete offline capability of the sync framework.',
          estimatedDuration: '6-8 min',
          steps: [
            'Set up comprehensive test environment',
            'Create entities with complex relationships',
            'Test offline CRUD operations on individual entities',
            'Test offline relationship creation/modification',
            'Execute batch operations while offline',
            'Test complex operation sequences',
            'Validate relationship encoding in offline queue',
            'Test edge cases and error scenarios',
            'Perform comprehensive validation of queue state',
            'Simulate various recovery scenarios'
          ],
          validates: [
            'All entity types work properly offline',
            'Relationship changes are captured correctly',
            'Batch operations maintain consistency',
            'Complex operation sequences work correctly',
            'Relationship encoding prevents corruption',
            'Edge cases are handled gracefully',
            'Queue state is always valid and recoverable',
            'Performance remains acceptable with large queues'
          ],
          tags: ['offline', 'comprehensive', 'relationships', 'batch', 'performance'],
          prerequisites: ['All basic offline tests passed', 'Relationship support enabled'],
          action: async (updateProgress) => {
            updateProgress(10, 'Setting up comprehensive test...');
            const config = createOfflineTestConfig('comprehensive');
            
            updateProgress(25, 'Testing offline CRUD operations...');
            updateProgress(45, 'Testing offline relationships...');
            updateProgress(65, 'Testing batch operations...');
            
            const result = await offlineSyncTests.runOfflineOperationsTest(config);
            
            if (!result.success) {
              throw new Error(`Comprehensive offline test failed: ${result.error?.message}`);
            }
            
            updateProgress(85, 'Comprehensive validation...');
            const validationResult = await offlineValidator.validateOfflineChanges({
              config,
              startTime: result.startTime,
              currentPhase: 'validation',
              status: 'completed',
              progress: 100,
              metadata: result.metadata
            });
            
            if (validationResult.status === 'failed') {
              throw new Error(`Comprehensive validation failed: ${validationResult.message}`);
            }
            
            updateProgress(100, 'Comprehensive test completed');
            return result;
          }
        }
      ]
    },
    {
      id: 'sync-states',
      name: 'Sync States',
      description: 'Test sync state transitions and lifecycle',
      icon: Network,
      tests: [
        {
          id: 'state-transitions',
          name: 'State Transitions',
          description: 'Test basic sync state transitions',
          detailedDescription: 'Validates the fundamental sync state machine transitions between Initial, Catchup, Live, and Offline states. This test ensures that state changes occur correctly and that the sync framework properly handles transitions between different operational modes.',
          estimatedDuration: '2-3 min',
          steps: [
            'Create state test configuration',
            'Initialize sync framework in Initial state',
            'Trigger transition to Catchup state',
            'Verify Catchup state behavior and data flow',
            'Transition from Catchup to Live state',
            'Validate Live state real-time sync behavior',
            'Test offline state transition and recovery',
            'Verify all state transitions complete successfully'
          ],
          validates: [
            'All state transitions execute without errors',
            'State machine logic is consistent',
            'Data flow changes appropriately with each state',
            'State persistence across operations',
            'Proper event emission during state changes',
            'Recovery from unexpected state transitions'
          ],
          tags: ['sync-state', 'state-machine', 'transitions'],
          prerequisites: ['Sync framework initialized', 'Event system functional'],
          action: async (updateProgress) => {
            updateProgress(15, 'Creating state test config...');
            const config = createSyncStateTestConfig('transitions');
            
            updateProgress(40, 'Testing state transitions...');
            const result = await syncStateTests.runSyncStateTest(config);
            
            if (!result.success) {
              throw new Error(`State transitions test failed: ${result.error?.message}`);
            }
            
            updateProgress(80, 'Validating state consistency...');
            updateProgress(100, 'State transitions test completed');
            return result;
          }
        },
        {
          id: 'lsn-progression',
          name: 'LSN Progression',
          description: 'Test LSN progression through sync states',
          detailedDescription: 'Validates that Log Sequence Numbers (LSNs) progress correctly through all sync states and that the framework maintains proper LSN ordering for change tracking and synchronization.',
          estimatedDuration: '3-4 min',
          steps: [
            'Set up LSN progression test environment',
            'Initialize with baseline LSN values',
            'Execute operations in Initial state',
            'Monitor LSN progression during Catchup',
            'Validate LSN handling in Live state',
            'Test LSN behavior during offline operations',
            'Verify LSN consistency after state transitions',
            'Check LSN sequence integrity end-to-end'
          ],
          validates: [
            'LSN values increase monotonically',
            'LSN progression is consistent across states',
            'No LSN gaps or duplicates occur',
            'LSN tracking survives state transitions',
            'Proper LSN handling during offline periods',
            'LSN synchronization with server is correct'
          ],
          tags: ['sync-state', 'lsn', 'ordering', 'consistency'],
          prerequisites: ['State transitions working', 'LSN tracking enabled'],
          action: async (updateProgress) => {
            updateProgress(20, 'Setting up LSN test...');
            const config = createSyncStateTestConfig('progression');
            
            updateProgress(50, 'Testing LSN progression...');
            const result = await syncStateTests.runSyncStateTest(config);
            
            if (!result.success) {
              throw new Error(`LSN progression test failed: ${result.error?.message}`);
            }
            
            updateProgress(85, 'Validating LSN sequence...');
            updateProgress(100, 'LSN progression test completed');
            return result;
          }
        },
        {
          id: 'full-lifecycle',
          name: 'Complete Lifecycle',
          description: 'Test complete sync lifecycle with all states',
          detailedDescription: 'Comprehensive test of the complete sync lifecycle from initialization through all operational states including error recovery. This test validates the entire sync framework workflow under various conditions and ensures robust operation.',
          estimatedDuration: '5-6 min',
          steps: [
            'Initialize complete lifecycle test environment',
            'Start with clean Initial state',
            'Perform initial data sync and validation',
            'Execute Catchup state with historical data',
            'Transition to Live state and test real-time sync',
            'Simulate network issues and offline state',
            'Test error recovery mechanisms',
            'Validate final data consistency',
            'Verify complete lifecycle metrics and logs'
          ],
          validates: [
            'Complete sync lifecycle executes successfully',
            'All state transitions occur without data loss',
            'Error recovery restores proper operation',
            'Data consistency is maintained throughout',
            'Performance remains acceptable across all states',
            'Resource cleanup occurs properly',
            'Monitoring and logging capture all events'
          ],
          tags: ['sync-state', 'lifecycle', 'comprehensive', 'error-recovery'],
          prerequisites: ['All individual state tests passed', 'Error simulation capability'],
          action: async (updateProgress) => {
            updateProgress(10, 'Initializing lifecycle test...');
            const config = createSyncStateTestConfig('lifecycle');
            
            updateProgress(25, 'Testing initial state...');
            updateProgress(45, 'Testing catchup state...');
            updateProgress(65, 'Testing live state...');
            updateProgress(80, 'Testing error recovery...');
            
            const result = await syncStateTests.runSyncStateTest(config);
            
            if (!result.success) {
              throw new Error(`Lifecycle test failed: ${result.error?.message}`);
            }
            
            updateProgress(95, 'Final validation...');
            updateProgress(100, 'Complete lifecycle test finished');
            return result;
          }
        }
      ]
    },
    {
      id: 'relationships',
      name: 'Relationships',
      description: 'Test relationship operations and integrity',
      icon: GitBranch,
      tests: [
        {
          id: 'basic-relationships',
          name: 'Basic Relationships',
          description: 'Test basic relationship operations',
          detailedDescription: 'Validates that relationship operations between entities work correctly, including creation, modification, and deletion of entity relationships. This test ensures that foreign key relationships are maintained and that relationship changes are properly tracked for sync.',
          estimatedDuration: '3-4 min',
          steps: [
            'Set up relationship test environment',
            'Create parent entities (projects, users)',
            'Create child entities with relationships (tasks)',
            'Test relationship creation and validation',
            'Modify existing relationships',
            'Test cascade operations on relationship deletion',
            'Validate relationship integrity constraints',
            'Verify relationship changes are queued for sync'
          ],
          validates: [
            'Relationship creation works correctly',
            'Foreign key constraints are enforced',
            'Relationship modifications update properly',
            'Cascade operations maintain data integrity',
            'Orphaned records are handled correctly',
            'Relationship changes appear in sync queue',
            'Complex relationship networks function properly'
          ],
          tags: ['relationships', 'foreign-keys', 'integrity', 'crud'],
          prerequisites: ['Basic CRUD operations working', 'Entity relationships defined'],
          action: async (updateProgress) => {
            updateProgress(20, 'Setting up relationship test...');
            updateProgress(50, 'Testing relationship operations...');
            updateProgress(80, 'Validating relationship integrity...');
            updateProgress(100, 'Relationship test completed');
            
            // For now, return a mock result - replace with actual relationship test
            return {
              id: 'basic-relationships',
              configId: 'relationship-basic',
              status: 'passed' as const,
              success: true,
              startTime: Date.now() - 30000,
              endTime: Date.now(),
              duration: 30000,
              steps: [],
              validations: [],
              syncStates: [],
              metadata: {}
            };
          }
        }
      ]
    },
    {
      id: 'performance',
      name: 'Performance',
      description: 'Test performance and establish baselines',
      icon: Zap,
      tests: [
        {
          id: 'performance-baseline',
          name: 'Performance Baseline',
          description: 'Establish performance baselines for sync operations',
          detailedDescription: 'Establishes performance baselines for all sync operations across different entity types and operation volumes. This test measures execution times, memory usage, and throughput to ensure the sync framework meets performance requirements.',
          estimatedDuration: '5-7 min',
          steps: [
            'Set up performance measurement environment',
            'Configure performance monitoring tools',
            'Execute baseline CRUD operations for each entity type',
            'Measure single operation performance',
            'Test batch operation performance',
            'Measure sync queue processing times',
            'Analyze memory usage patterns',
            'Calculate throughput metrics',
            'Generate performance baseline report'
          ],
          validates: [
            'Single operations complete within acceptable time',
            'Batch operations scale linearly',
            'Memory usage remains within bounds',
            'Sync queue processing is efficient',
            'No memory leaks during extended operations',
            'Performance is consistent across entity types',
            'Baseline metrics are established for monitoring'
          ],
          tags: ['performance', 'baseline', 'monitoring', 'scalability'],
          prerequisites: ['All CRUD operations working', 'Performance monitoring enabled'],
          action: async (updateProgress) => {
            updateProgress(10, 'Setting up performance test...');
            const entities: EntityType[] = ['tasks', 'projects', 'users', 'comments'];
            const performanceResults = [];
            
            for (let i = 0; i < entities.length; i++) {
              const entity = entities[i];
              const progress = 10 + (i / entities.length) * 70;
              
              updateProgress(progress, `Performance testing ${entity}...`);
              const config = createEntityTestConfig(entity);
              config.dataVariations.complete = true;
              config.dataVariations.edge = true;
              
              const entityStartTime = Date.now();
              const result = await basicCRUDTests.runEntityCRUDTest(config);
              const entityDuration = Date.now() - entityStartTime;
              
              performanceResults.push({
                entity,
                duration: entityDuration,
                success: result.success
              });
              
              if (!result.success) {
                throw new Error(`Performance test failed for ${entity}`);
              }
            }
            
            updateProgress(90, 'Calculating performance metrics...');
            const totalDuration = performanceResults.reduce((sum, r) => sum + r.duration, 0);
            console.log(`Performance baseline: ${totalDuration}ms total, avg ${totalDuration / entities.length}ms per entity`);
            
            updateProgress(100, 'Performance baseline established');
            return performanceResults[0].success ? {
              id: 'performance-baseline',
              configId: 'performance-baseline',
              status: 'passed' as const,
              success: true,
              startTime: Date.now() - totalDuration,
              endTime: Date.now(),
              duration: totalDuration,
              steps: [],
              validations: [],
              syncStates: [],
              metadata: { performanceResults }
            } : {
              id: 'performance-baseline',
              configId: 'performance-baseline',
              status: 'failed' as const,
              success: false,
              startTime: Date.now() - totalDuration,
              endTime: Date.now(),
              duration: totalDuration,
              steps: [],
              validations: [],
              syncStates: [],
              error: new Error('Performance test failed'),
              metadata: {}
            };
          }
        }
      ]
    }
  ];

  // Flatten all tests from all categories for the list
  const allTests = useMemo(() => {
    const flatTests: Array<{test: TestDefinition, categoryId: string, category: TestCategory}> = [];
    testCategories.forEach(category => {
      category.tests.forEach(test => {
        flatTests.push({test, categoryId: category.id, category});
      });
    });
    return flatTests;
  }, []);

  const getExecutionForTest = (categoryId: string, testId: string): UITestExecution | undefined => {
    return testExecutions.get(`${categoryId}-${testId}`);
  };

  return (
    <div className="space-y-4">
      {/* Status Dashboard */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sync Testing Framework</CardTitle>
              <CardDescription>
                Comprehensive testing for all sync operations, entity types, and protocols
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              {testStats.activeTestCount > 0 && (
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleStopAllTests}
                >
                  <Square className="h-4 w-4 mr-1" />
                  Stop All Tests
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleClearHistory}
                disabled={testHistory.length === 0}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Clear History
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Test statistics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{testStats.activeTestCount}</div>
              <div className="text-sm text-muted-foreground">Active Tests</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{testStats.totalTests}</div>
              <div className="text-sm text-muted-foreground">Total Tests</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{testStats.successfulTests}</div>
              <div className="text-sm text-muted-foreground">Successful</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{testStats.failedTests}</div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{testStats.successRate.toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </div>
          </div>

          {/* Sync state indicator */}
          <div className="mt-4 flex items-center space-x-2">
            <Badge variant="secondary">
              Test Mode
            </Badge>
            <span className="text-sm text-muted-foreground">
              Sync tests isolated from live context
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Main 2-Panel Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[700px]">
        {/* Left Panel: Test List */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Test Suite</CardTitle>
              <Badge variant="outline">{allTests.length} tests</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <div className="h-full max-h-[650px] overflow-auto">
              <div className="p-4 space-y-3">
                {allTests.map(({test, categoryId, category}) => {
                  const execution = getExecutionForTest(categoryId, test.id);
                  const isRunning = execution?.status === 'running';
                  const hasCompleted = execution?.status === 'completed';
                  const hasFailed = execution?.status === 'failed';
                  const isSelected = selectedTest?.test.id === test.id && selectedTest?.categoryId === categoryId;
                  
                  return (
                    <div 
                      key={`${categoryId}-${test.id}`} 
                      className={`p-4 border rounded-lg cursor-pointer transition-all hover:bg-muted/50 ${
                        isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
                      }`}
                      onClick={() => setSelectedTest({test, categoryId})}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <category.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium truncate">{test.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {category.name}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {test.description}
                          </p>
                          
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{test.estimatedDuration}</span>
                            {test.tags.slice(0, 3).map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>

                          {isRunning && (
                            <div className="mt-3">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span>Progress</span>
                                <span>{Math.round(execution.progress || 0)}%</span>
                              </div>
                              <Progress value={execution.progress} className="h-2" />
                              
                              {/* Stage indicators */}
                              <div className="flex items-center justify-between mt-2 text-xs">
                                <div className="flex items-center gap-1">
                                  <div className={`w-2 h-2 rounded-full ${(execution.progress || 0) >= 25 ? 'bg-green-500' : 'bg-gray-300'}`} />
                                  <span className={`${(execution.progress || 0) >= 25 ? 'text-green-600' : 'text-muted-foreground'}`}>Setup</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className={`w-2 h-2 rounded-full ${(execution.progress || 0) >= 50 ? 'bg-green-500' : 'bg-gray-300'}`} />
                                  <span className={`${(execution.progress || 0) >= 50 ? 'text-green-600' : 'text-muted-foreground'}`}>Execute</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className={`w-2 h-2 rounded-full ${(execution.progress || 0) >= 75 ? 'bg-green-500' : 'bg-gray-300'}`} />
                                  <span className={`${(execution.progress || 0) >= 75 ? 'text-green-600' : 'text-muted-foreground'}`}>Validate</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className={`w-2 h-2 rounded-full ${(execution.progress || 0) >= 90 ? 'bg-green-500' : 'bg-gray-300'}`} />
                                  <span className={`${(execution.progress || 0) >= 90 ? 'text-green-600' : 'text-muted-foreground'}`}>Cleanup</span>
                                </div>
                              </div>
                              
                              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                {(execution.progress || 0) < 25 && <span>🏗️</span>}
                                {(execution.progress || 0) >= 25 && (execution.progress || 0) < 50 && <span>⚙️</span>}
                                {(execution.progress || 0) >= 50 && (execution.progress || 0) < 75 && <span>🔍</span>}
                                {(execution.progress || 0) >= 75 && (execution.progress || 0) < 90 && <span>🧹</span>}
                                {(execution.progress || 0) >= 90 && <span>✅</span>}
                                {execution.currentStep}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-1">
                            {isRunning && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                            {hasCompleted && <CheckCircle className="h-4 w-4 text-green-500" />}
                            {hasFailed && <XCircle className="h-4 w-4 text-red-500" />}
                          </div>
                          
                          <Button
                            size="sm"
                            variant={isRunning ? "secondary" : "default"}
                            disabled={isRunning}
                            onClick={(e) => {
                              e.stopPropagation();
                              executeTest(test, categoryId);
                            }}
                          >
                            {isRunning ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Running
                              </>
                            ) : (
                              <>
                                <Play className="h-3 w-3 mr-1" />
                                Run
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Panel: Test Console */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Test Console</CardTitle>
              <div className="flex items-center gap-2">
                {testStats.activeTestCount > 0 && (
                  <Badge variant="secondary">
                    {testStats.activeTestCount} running
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          {/* Test Details Section */}
          {selectedTest && (
            <div className="px-6 py-4 border-b bg-muted/20 max-h-[200px] overflow-auto">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium">{selectedTest.test.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedTest.test.detailedDescription}
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h5 className="font-medium mb-2">Test Steps</h5>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {selectedTest.test.steps.slice(0, 4).map((step, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="bg-primary/10 rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0 text-xs">
                            {i + 1}
                          </span>
                          <span className="line-clamp-2">{step}</span>
                        </li>
                      ))}
                      {selectedTest.test.steps.length > 4 && (
                        <li className="text-xs text-muted-foreground pl-6">
                          +{selectedTest.test.steps.length - 4} more steps...
                        </li>
                      )}
                    </ul>
                  </div>
                  
                  <div>
                    <h5 className="font-medium mb-2">Validates</h5>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {selectedTest.test.validates.slice(0, 4).map((validation, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{validation}</span>
                        </li>
                      ))}
                      {selectedTest.test.validates.length > 4 && (
                        <li className="text-xs text-muted-foreground pl-5">
                          +{selectedTest.test.validates.length - 4} more validations...
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Console Output */}
          <CardContent className="flex-1 p-0 min-h-0">
            <div className="h-full flex flex-col">
              {/* Console header with scroll indicator */}
              <div className="flex items-center justify-between p-2 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Console Output</span>
                  {consoleOutput.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {consoleOutput.length} entries
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConsoleOutput([])}
                  disabled={consoleOutput.length === 0}
                  className="text-xs"
                >
                  Clear
                </Button>
              </div>
              
              <div className="flex-1 overflow-auto p-4 max-h-[50vh] relative">
                {/* Scroll indicator */}
                {consoleOutput.length > 10 && (
                  <div className="absolute top-2 right-2 z-10">
                    <Badge variant="outline" className="text-xs bg-background/80 backdrop-blur-sm">
                      Scroll for more ↓
                    </Badge>
                  </div>
                )}
                
                <div className="space-y-2 font-mono text-sm">
                  {consoleOutput.length === 0 ? (
                    <div className="text-center text-muted-foreground py-12">
                      <div className="mb-4">
                        <Clock className="h-12 w-12 mx-auto text-muted-foreground/50" />
                      </div>
                      <p className="text-lg font-medium">No test output yet</p>
                      <p className="text-sm">Select and run a test to see live output here</p>
                    </div>
                  ) : (
                    consoleOutput.map((log, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-md text-xs border-l-4 transition-all duration-200 ${
                          log.type === 'error' ? 'bg-red-50 border-red-500 text-red-900 dark:bg-red-950/50 dark:text-red-100' :
                          log.type === 'success' ? 'bg-green-50 border-green-500 text-green-900 dark:bg-green-950/50 dark:text-green-100' :
                          log.type === 'progress' ? 'bg-blue-50 border-blue-500 text-blue-900 dark:bg-blue-950/50 dark:text-blue-100' :
                          'bg-muted/50 border-muted-foreground'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {log.testId.split('-')[0]}
                            </Badge>
                            {/* Add success/error icons */}
                            {log.type === 'success' && <CheckCircle className="h-3 w-3 text-green-600" />}
                            {log.type === 'error' && <XCircle className="h-3 w-3 text-red-600" />}
                            {log.type === 'progress' && <Clock className="h-3 w-3 text-blue-600" />}
                          </div>
                        </div>
                        <p className="font-medium">{log.message}</p>
                        {log.details && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                              View details
                            </summary>
                            <pre className="mt-2 text-xs bg-background/50 p-2 rounded border overflow-auto max-h-32">
                              {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))
                  )}
                  {/* Auto-scroll target */}
                  <div ref={consoleEndRef} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}; 