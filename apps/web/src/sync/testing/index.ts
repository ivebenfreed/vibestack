// Sync Testing Framework
// Main exports for the comprehensive sync testing framework

// Core testing framework
export { SyncTestFramework } from './core/SyncTestFramework';
export { ValidationEngine } from './core/ValidationEngine';

// Test scenarios
export { BasicCRUDTests } from './scenarios/BasicCRUDTests';
export { SyncOperationTests } from './scenarios/SyncOperationTests';
export { PureCRUDTests } from './scenarios/PureCRUDTests';
export { ProtocolTests } from './scenarios/ProtocolTests';
export { OfflineSyncTests } from './scenarios/OfflineSyncTests';
export { SyncStateTests } from './scenarios/SyncStateTests';
export { BatchOperationTests } from './scenarios/BatchOperationTests';
export { RelationshipTests } from './scenarios/RelationshipTests';

// Validators
export { OutgoingValidator } from './validators/OutgoingValidator';
export { IncomingValidator } from './validators/IncomingValidator';
export { RelationshipValidator } from './validators/RelationshipValidator';
export { SyncStateValidator } from './validators/SyncStateValidator';
export { OfflineValidator } from './validators/OfflineValidator';
export { CRUDSyncValidator } from './validators/CRUDSyncValidator';

// Generators
export { TestDataGenerator } from './generators/TestDataGenerator';

// UI Components
export { SyncTestingInterface } from './components/SyncTestingInterface';
export { DiagnosticsPanel } from './components/DiagnosticsPanel';

// Types
export type { TestResult, TestStep, TestStepResult, ValidationResult } from './types/TestTypes';

// Framework version
export const SYNC_TESTING_FRAMEWORK_VERSION = '1.0.0';

// Default configurations
export const DEFAULT_TEST_CONFIG = {
  batchSizes: [1, 5, 10, 25, 50],
  entities: ['tasks', 'projects', 'users', 'comments'] as const,
  operations: ['insert', 'update', 'delete'] as const,
  timeout: 30000, // 30 seconds
  retries: 3,
  cleanupAfterTest: true
}; 