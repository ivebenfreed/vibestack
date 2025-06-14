import type { TableChange } from '@repo/sync-types';
import type { Task, Project, User, Comment } from '@repo/dataforge/client-entities';

// Entity types that can be tested
export type EntityType = 'tasks' | 'projects' | 'users' | 'comments';
export type OperationType = 'insert' | 'update' | 'delete';
export type RelationshipOperation = 'set' | 'add' | 'remove';

// Entity type mapping
export type EntityTypeMap = {
  tasks: Task;
  projects: Project;
  users: User;
  comments: Comment;
};

// Test scenario types
export type TestScenarioType = 
  | 'single_entity_crud'
  | 'batch_operations'
  | 'relationship_operations'
  | 'conflict_resolution'
  | 'error_handling'
  | 'performance'
  | 'protocol_validation'
  | 'offline_sync'
  | 'sync_states';

// Test execution status
export type TestStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// Test result status
export type TestResultStatus = 'passed' | 'failed' | 'warning' | 'skipped';

// Test execution phases
export type TestPhase = 
  | 'setup'
  | 'data_generation'
  | 'execution'
  | 'validation'
  | 'cleanup';

// Base test configuration
export interface BaseTestConfig {
  id: string;
  name: string;
  description: string;
  type: TestScenarioType;
  enabled: boolean;
  timeout: number;
  retries: number;
  cleanupAfterTest: boolean;
  tags: string[];
}

// Entity test configuration
export interface EntityTestConfig extends BaseTestConfig {
  type: 'single_entity_crud';
  entity: EntityType;
  operations: OperationType[];
  dataVariations: {
    minimal: boolean;        // Required fields only
    complete: boolean;       // All fields populated
    edge: boolean;          // Edge case values
    invalid: boolean;       // Invalid data for error testing
  };
  validation: {
    immediate: boolean;     // Validate immediately after operation
    eventual: boolean;      // Validate after sync completion
    state: boolean;         // Validate sync state changes
  };
}

// Batch test configuration
export interface BatchTestConfig extends BaseTestConfig {
  type: 'batch_operations';
  batchSizes: number[];
  compositions: {
    singleOperation: boolean;     // All inserts, all updates, etc.
    mixedOperations: boolean;     // Mix of insert/update/delete
    singleEntity: boolean;        // All same entity type
    mixedEntities: boolean;       // Different entity types
  };
  optimization: {
    testOptimization: boolean;    // Verify batch optimization
    validateMerging: boolean;     // Check change merging
    validateFiltering: boolean;   // Check change filtering
  };
  timing: {
    sequential: boolean;          // One after another
    rapid: boolean;              // Rapid-fire submission
    delayed: boolean;            // With delays between operations
  };
}

// Relationship test configuration
export interface RelationshipTestConfig extends BaseTestConfig {
  type: 'relationship_operations';
  relationships: {
    projectTasks?: {
      operations: RelationshipOperation[];
      scenarios: string[];
    };
    userTasks?: {
      operations: RelationshipOperation[];
      scenarios: string[];
    };
    taskDependencies?: {
      operations: RelationshipOperation[];
      scenarios: string[];
    };
  };
  validation: {
    parentConsistency: boolean;
    childConsistency: boolean;
    cascadeValidation: boolean;
    symmetryCheck: boolean;
    integrityCheck: boolean;
    cycleDetection: boolean;
  };
}

// Performance test configuration
export interface PerformanceTestConfig extends BaseTestConfig {
  type: 'performance';
  dataVolume: {
    smallScale: number;
    mediumScale: number;
    largeScale: number;
    sustainedLoad: boolean;
  };
  metrics: {
    responseTime: boolean;
    throughput: boolean;
    memoryUsage: boolean;
    batchOptimization: boolean;
  };
  scenarios: {
    burstLoad: boolean;
    sustainedLoad: boolean;
    mixedLoad: boolean;
  };
  thresholds: {
    maxResponseTime: number;
    minThroughput: number;
    maxMemoryIncrease: number;
  };
}

// Error handling test configuration
export interface ErrorTestConfig extends BaseTestConfig {
  type: 'error_handling';
  networkErrors: {
    connectionLoss: boolean;
    slowConnection: boolean;
    packetLoss: boolean;
  };
  serverErrors: {
    internalError: boolean;
    validationError: boolean;
    permissionError: boolean;
    conflictError: boolean;
  };
  dataErrors: {
    invalidFormat: boolean;
    constraintViolation: boolean;
    typeErrors: boolean;
  };
  recovery: {
    automaticRetry: boolean;
    manualRecovery: boolean;
    stateRecovery: boolean;
  };
}

/**
 * Offline Sync Test Configuration
 * Tests offline operations and LocalChanges management
 */
export interface OfflineSyncTestConfig extends BaseTestConfig {
  type: 'offline_sync';
  offlineOperations: {
    entityCRUD: boolean;
    relationshipChanges: boolean;
    batchOperations: boolean;
    localChangesManagement: boolean;
  };
  validation: {
    localChangesCreated: boolean;
    relationshipEncoding: boolean;
    clientIdAntiEcho: boolean;
    changeOptimization: boolean;
    queuePersistence: boolean;
    recoveryProcess: boolean;
  };
  scenarios: {
    simpleOffline: boolean;
    extendedOffline: boolean;
    offlineWithRelationships: boolean;
    offlineRecovery: boolean;
    conflictResolution: boolean;
  };
}

/**
 * Sync State Test Configuration
 * Tests sync state transitions and management
 */
export interface SyncStateTestConfig extends BaseTestConfig {
  type: 'sync_states';
  states: {
    initial: boolean;
    catchup: boolean;
    live: boolean;
    offline: boolean;
    transitions: boolean;
  };
  scenarios: {
    firstTimeSync: boolean;
    offlineRecovery: boolean;
    connectionLoss: boolean;
    errorRecovery: boolean;
    stateTransitions: boolean;
  };
  validation: {
    stateConsistency: boolean;
    transitionValidation: boolean;
    lsnProgression: boolean;
    stateEvents: boolean;
  };
}

export interface ProtocolTestConfig extends BaseTestConfig {
  type: 'protocol_validation';
  directions: {
    outgoing: boolean;        // Test client-to-server messages
    incoming: boolean;        // Test server-to-client messages
    bidirectional: boolean;   // Test full roundtrip communication
  };
  messageTypes: {
    dataSync: boolean;        // Regular data synchronization messages
    heartbeat: boolean;       // Connection heartbeat messages
    errorMessages: boolean;   // Error reporting and handling
    conflictResolution: boolean; // Conflict resolution messages
  };
  validation: {
    messageFormat: boolean;   // Validate message structure and format
    sequencing: boolean;      // Validate message ordering
    acknowledgment: boolean;  // Validate ack/nack responses
    errorHandling: boolean;   // Validate error scenarios
    timeout: boolean;         // Validate timeout handling
  };
  simulation: {
    networkDelay: boolean;    // Simulate network latency
    messageDrops: boolean;    // Simulate dropped messages
    serverErrors: boolean;    // Simulate server error responses
    malformedMessages: boolean; // Test malformed message handling
  };
}

// Union type for all test configurations
export type TestConfig = 
  | EntityTestConfig
  | BatchTestConfig
  | RelationshipTestConfig
  | PerformanceTestConfig
  | ErrorTestConfig
  | OfflineSyncTestConfig
  | SyncStateTestConfig
  | ProtocolTestConfig;

// Test execution context
export interface TestExecutionContext {
  config: TestConfig;
  startTime: number;
  endTime?: number;
  currentPhase: TestPhase;
  status: TestStatus;
  progress: number; // 0-100
  metadata: Record<string, any>;
}

// Test execution state (for active tests)
export interface TestExecution {
  id: string;
  config: TestConfig;
  status: TestStatus;
  progress: number;
  startTime: number;
  currentPhase: TestPhase;
  steps: TestStepResult[];
  error?: Error;
}

// Test step definition
export interface TestStep {
  id: string;
  name: string;
  description: string;
  phase: TestPhase;
  execute: (context: TestExecutionContext) => Promise<TestStepResult>;
  validate?: (context: TestExecutionContext, result: TestStepResult) => Promise<ValidationResult>;
  timeout?: number;
}

// Test step result
export interface TestStepResult {
  success: boolean;
  data?: any;
  error?: Error;
  duration: number;
  metadata: Record<string, any>;
}

// Validation result
export interface ValidationResult {
  status: TestResultStatus;
  message: string;
  details?: any;
  suggestions?: string[];
}

// Test assertion
export interface TestAssertion {
  id: string;
  name: string;
  description: string;
  condition: (context: TestExecutionContext) => boolean | Promise<boolean>;
  severity: 'error' | 'warning' | 'info';
}

// Test data generation options
export interface DataGenerationOptions {
  entity: EntityType;
  count: number;
  variation: 'minimal' | 'complete' | 'edge' | 'invalid';
  relationships?: {
    include: boolean;
    depth: number;
  };
  customData?: Partial<EntityTypeMap[EntityType]>;
}

// Entity generation configuration (new, more specific)
export interface EntityGenerationConfig {
  entity: EntityType;
  count: number;
  variation: 'minimal' | 'basic' | 'complete';
  relationships?: {
    include: boolean;
    depth: number;
  };
}

// Entity generation result (new)
export interface EntityGenerationResult {
  success: boolean;
  data: any[];
  error?: Error;
  metadata: {
    entityType: EntityType;
    count: number;
    variation: string;
    relationshipsIncluded: boolean;
    generationTime: number;
  };
}

// Generated test data
export interface GeneratedTestData<T extends EntityType = EntityType> {
  entity: T;
  data: EntityTypeMap[T][];
  relationships?: {
    [key: string]: string[];
  };
  metadata: {
    variation: string;
    generationTime: number;
    count: number;
  };
}

// Sync state snapshot
export interface SyncStateSnapshot {
  timestamp: number;
  pendingChangesCount: number;
  sentChangesCount: number;
  queueSize: number;
  connectionStatus: string;
  lastLSN?: string;
  clientId?: string;
}

// Performance metrics
export interface PerformanceMetrics {
  operationLatency: number[];
  batchProcessingTime: number[];
  syncCompletionTime: number[];
  networkRoundTrip: number[];
  throughput: {
    changesPerSecond: number;
    batchesPerMinute: number;
  };
  resource: {
    memoryUsage: number;
    cpuUtilization: number;
  };
}

// Test result
export interface TestResult {
  id: string;
  configId: string;
  status: TestResultStatus;
  success: boolean;
  startTime: number;
  endTime: number;
  duration: number;
  steps: TestStepResult[];
  validations: ValidationResult[];
  performance?: PerformanceMetrics;
  syncStates: SyncStateSnapshot[];
  error?: Error;
  metadata: Record<string, any>;
}

// Test suite
export interface TestSuite {
  id: string;
  name: string;
  description: string;
  configs: TestConfig[];
  results: TestResult[];
  status: TestStatus;
  progress: number;
  startTime?: number;
  endTime?: number;
}

// Test framework options
export interface SyncTestFrameworkOptions {
  defaultTimeout: number;
  defaultRetries: number;
  cleanupAfterTest: boolean;
  parallelExecution: boolean;
  maxConcurrentTests: number;
  enablePerformanceMonitoring: boolean;
  enableStateSnapshots: boolean;
  snapshotInterval: number;
}

// Event types for test framework
export type TestFrameworkEvent = 
  | 'test_started'
  | 'test_completed'
  | 'test_failed'
  | 'step_started'
  | 'step_completed'
  | 'validation_completed'
  | 'state_snapshot'
  | 'performance_update';

export interface TestFrameworkEventData {
  type: TestFrameworkEvent;
  testId: string;
  timestamp: number;
  data: any;
} 