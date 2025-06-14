import type {
  ValidationResult,
  TestExecutionContext,
  TestConfig,
  TestStepResult
} from './TestTypes';
import { OutgoingValidator } from '../validators/OutgoingValidator';
import { IncomingValidator } from '../validators/IncomingValidator';
import { OfflineValidator } from '../validators/OfflineValidator';
import { SyncStateValidator } from '../validators/SyncStateValidator';
import { RelationshipValidator } from '../validators/RelationshipValidator';
import { CRUDSyncValidator } from '../validators/CRUDSyncValidator';
import { SyncTestFramework } from './SyncTestFramework';

/**
 * Validation Engine - Central orchestrator for all sync testing validations
 * Coordinates multiple validators and provides comprehensive validation reporting
 */
export class ValidationEngine {
  private outgoingValidator: OutgoingValidator;
  private incomingValidator: IncomingValidator;
  private offlineValidator: OfflineValidator;
  private syncStateValidator: SyncStateValidator;
  private relationshipValidator: RelationshipValidator;
  private crudSyncValidator: CRUDSyncValidator;

  constructor(private framework: SyncTestFramework) {
    this.outgoingValidator = new OutgoingValidator(framework);
    this.incomingValidator = new IncomingValidator(framework);
    this.offlineValidator = new OfflineValidator(framework);
    this.syncStateValidator = new SyncStateValidator(framework);
    this.relationshipValidator = new RelationshipValidator(framework);
    this.crudSyncValidator = new CRUDSyncValidator(framework);
  }

  /**
   * Validate test step based on test configuration and context
   */
  async validateTestStep(
    config: TestConfig,
    context: TestExecutionContext,
    stepResult: TestStepResult,
    stepType: string
  ): Promise<ValidationResult> {
    try {
      // Route to appropriate validator based on test type and step
      switch (config.type) {
        case 'single_entity_crud':
          return await this.validateCRUDStep(context, stepResult, stepType);
          
        case 'batch_operations':
          return await this.validateBatchStep(context, stepResult, stepType);
          
        case 'relationship_operations':
          return await this.validateRelationshipStep(context, stepResult, stepType);
          
        case 'offline_sync':
          return await this.validateOfflineStep(context, stepResult, stepType);
          
        case 'sync_states':
          return await this.validateSyncStateStep(context, stepResult, stepType);
          
        case 'protocol_validation':
          return await this.validateProtocolStep(context, stepResult, stepType);
          
        default:
          return {
            status: 'warning',
            message: `No specific validation available for test type: ${config.type}`,
            details: { testType: config.type, stepType }
          };
      }
    } catch (error) {
      return {
        status: 'failed',
        message: 'Validation engine error',
        details: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validate CRUD operation steps with enhanced per-operation sync validation
   */
  private async validateCRUDStep(
    context: TestExecutionContext,
    stepResult: TestStepResult,
    stepType: string
  ): Promise<ValidationResult> {
    switch (stepType) {
      case 'setup':
        return await this.validateSetupStep(context, stepResult);
        
      case 'insert-operation':
      case 'update-operation':  
      case 'delete-operation':
        return await this.validateCRUDOperationWithSync(context, stepResult, stepType);
        
      case 'validate-sync':
        return await this.outgoingValidator.validateOutgoingChanges(context);
        
      default:
        return this.createGenericValidation(stepResult, stepType);
    }
  }

  /**
   * Enhanced CRUD operation validation that includes immediate sync validation
   */
  private async validateCRUDOperationWithSync(
    context: TestExecutionContext,
    stepResult: TestStepResult,
    stepType: string
  ): Promise<ValidationResult> {
    if (!stepResult.success) {
      return {
        status: 'failed',
        message: `${stepType} failed`,
        details: stepResult.error?.message
      };
    }

    // Extract operation details from step metadata
    const operationType = stepResult.metadata?.operationType;
    const entityType = stepResult.metadata?.entityType;
    const beforeSyncState = stepResult.metadata?.beforeSyncState;
    const afterSyncState = stepResult.metadata?.afterSyncState;
    const newChanges = stepResult.metadata?.newChanges || [];
    const operationResult = stepResult.data;

    if (!operationType || !entityType) {
      return {
        status: 'warning',
        message: 'Missing operation metadata for enhanced sync validation',
        details: { stepType, hasOperationType: !!operationType, hasEntityType: !!entityType }
      };
    }

    // Use the specialized CRUD sync validator
    const syncValidation = await this.crudSyncValidator.validateCRUDOperationSync(
      entityType,
      operationType,
      operationResult,
      beforeSyncState,
      afterSyncState,
      newChanges
    );

    // Combine basic operation validation with sync validation
    const basicValidation = await this.validateBasicCRUDOperation(context, stepResult);

    // If sync validation failed, that takes priority
    if (syncValidation.status === 'failed') {
      return {
        status: 'failed',
        message: `${stepType} sync validation failed: ${syncValidation.message}`,
        details: {
          basic: basicValidation,
          sync: syncValidation,
          combined: true
        },
        suggestions: syncValidation.suggestions
      };
    }

    // If basic operation failed, return that
    if (basicValidation.status === 'failed') {
      return basicValidation;
    }

    // Return combined successful result
    return {
      status: syncValidation.status, // 'passed' or 'warning'
      message: `${stepType} completed with sync validation: ${syncValidation.message}`,
      details: {
        basic: basicValidation,
        sync: syncValidation,
        combined: true
      }
    };
  }

  /**
   * Basic CRUD operation validation (without sync specifics)
   */
  private async validateBasicCRUDOperation(
    context: TestExecutionContext,
    stepResult: TestStepResult
  ): Promise<ValidationResult> {
    if (!stepResult.success) {
      return {
        status: 'failed',
        message: 'CRUD operation failed',
        details: stepResult.error?.message
      };
    }

    // Validate that operations were recorded
    const operations = stepResult.data?.operations || [];
    const hasOperations = operations.length > 0;

    // Check for basic operation result
    const hasResult = !!stepResult.data;
    const operationType = stepResult.metadata?.operationType;

    return {
      status: hasOperations || hasResult ? 'passed' : 'warning',
      message: `Basic CRUD operation validation: ${operationType || 'unknown'} completed`,
      details: { 
        operationCount: operations.length, 
        operations,
        hasResult,
        operationType
      }
    };
  }

  /**
   * Validate batch operation steps
   */
  private async validateBatchStep(
    context: TestExecutionContext,
    stepResult: TestStepResult,
    stepType: string
  ): Promise<ValidationResult> {
    switch (stepType) {
      case 'generate-batch-data':
        return await this.validateBatchDataGeneration(context, stepResult);
        
      case 'execute-batch':
        return await this.validateBatchExecution(context, stepResult);
        
      case 'analyze-performance':
        return await this.validateBatchPerformance(context, stepResult);
        
      default:
        return this.createGenericValidation(stepResult, stepType);
    }
  }

  /**
   * Validate relationship operation steps
   */
  private async validateRelationshipStep(
    context: TestExecutionContext,
    stepResult: TestStepResult,
    stepType: string
  ): Promise<ValidationResult> {
    switch (stepType) {
      case 'setup-relationships':
        return await this.relationshipValidator.validateRelationshipChanges(context, []);
        
      case 'test-project-members':
      case 'test-task-dependencies':
        return await this.relationshipValidator.validateRelationshipConsistency(context, []);
        
      case 'validate-relationships':
        return await this.relationshipValidator.validateRelationshipIntegrity(context, []);
        
      default:
        return this.createGenericValidation(stepResult, stepType);
    }
  }

  /**
   * Validate offline sync steps
   */
  private async validateOfflineStep(
    context: TestExecutionContext,
    stepResult: TestStepResult,
    stepType: string
  ): Promise<ValidationResult> {
    switch (stepType) {
      case 'offline-operations':
        return await this.offlineValidator.validateOfflineChanges(context);
        
      case 'relationship-tracking':
        return await this.offlineValidator.validateOfflineChanges(context);
        
      case 'recovery-process':
        return await this.offlineValidator.validateRecoveryProcess(context);
        
      default:
        return this.createGenericValidation(stepResult, stepType);
    }
  }

  /**
   * Validate sync state steps
   */
  private async validateSyncStateStep(
    context: TestExecutionContext,
    stepResult: TestStepResult,
    stepType: string
  ): Promise<ValidationResult> {
    switch (stepType) {
      case 'initial-sync':
        return await this.syncStateValidator.validateSyncStates(context);
        
      case 'catchup-sync':
        return await this.syncStateValidator.validateSyncStates(context);
        
      case 'live-sync':
        return await this.syncStateValidator.validateSyncStates(context);
        
      case 'state-consistency':
        return await this.syncStateValidator.validateSyncStates(context);
        
      default:
        return this.createGenericValidation(stepResult, stepType);
    }
  }

  /**
   * Validate protocol steps
   */
  private async validateProtocolStep(
    context: TestExecutionContext,
    stepResult: TestStepResult,
    stepType: string
  ): Promise<ValidationResult> {
    switch (stepType) {
      case 'outgoing-protocol':
        return await this.outgoingValidator.validateOutgoingChanges(context);
        
      case 'incoming-protocol':
        return await this.incomingValidator.validateIncomingMessages(context, []);
        
      case 'bidirectional-flow':
        return await this.validateBidirectionalProtocol(context, stepResult);
        
      default:
        return this.createGenericValidation(stepResult, stepType);
    }
  }

  /**
   * Run comprehensive validation across all validators
   */
  async runComprehensiveValidation(
    context: TestExecutionContext,
    config: TestConfig
  ): Promise<ValidationResult[]> {
    const validations: ValidationResult[] = [];

    try {
      // Always validate outgoing changes
      validations.push(await this.outgoingValidator.validateOutgoingChanges(context));

      // Validate sync state
      validations.push(await this.syncStateValidator.validateSyncStates(context));

      // Type-specific validations
      switch (config.type) {
        case 'relationship_operations':
          validations.push(await this.relationshipValidator.validateRelationshipConsistency(context, []));
          validations.push(await this.relationshipValidator.validateRelationshipIntegrity(context, []));
          break;
          
        case 'offline_sync':
          validations.push(await this.offlineValidator.validateOfflineChanges(context));
          validations.push(await this.offlineValidator.validateRecoveryProcess(context));
          break;
          
        case 'protocol_validation':
          validations.push(await this.incomingValidator.validateIncomingMessages(context, []));
          break;
      }

      return validations;
    } catch (error) {
      return [{
        status: 'failed',
        message: 'Comprehensive validation failed',
        details: error instanceof Error ? error.message : String(error)
      }];
    }
  }

  /**
   * Validate data generation quality
   */
  async validateDataGeneration(
    context: TestExecutionContext,
    generatedData: any
  ): Promise<ValidationResult> {
    if (!generatedData) {
      return {
        status: 'failed',
        message: 'No data was generated',
        details: 'Data generation step failed or returned null/undefined'
      };
    }

    const validationChecks = {
      hasData: Object.keys(generatedData).length > 0,
      allEntitiesPresent: ['users', 'projects', 'tasks'].every(entity => 
        entity in generatedData && Array.isArray(generatedData[entity])
      ),
      entitiesHaveIds: this.validateEntityIds(generatedData),
      dataStructureValid: this.validateDataStructure(generatedData)
    };

    const allChecksPass = Object.values(validationChecks).every(check => check);

    return {
      status: allChecksPass ? 'passed' : 'failed',
      message: `Data generation validation: ${Object.values(validationChecks).filter(Boolean).length}/${Object.keys(validationChecks).length} checks passed`,
      details: validationChecks
    };
  }

  // Helper validation methods
  private async validateSetupStep(
    context: TestExecutionContext,
    stepResult: TestStepResult
  ): Promise<ValidationResult> {
    if (!stepResult.success) {
      return {
        status: 'failed',
        message: 'Setup step failed',
        details: stepResult.error?.message
      };
    }

    const hasServices = !!context.metadata.services;
    const hasTestData = !!context.metadata.testData;
    const hasInitialState = !!context.metadata.initialSyncState;

    return {
      status: hasServices && hasTestData && hasInitialState ? 'passed' : 'failed',
      message: 'Setup validation completed',
      details: { hasServices, hasTestData, hasInitialState }
    };
  }

  private async validateBatchDataGeneration(
    context: TestExecutionContext,
    stepResult: TestStepResult
  ): Promise<ValidationResult> {
    const batchData = stepResult.data?.batchData;
    if (!batchData) {
      return {
        status: 'failed',
        message: 'No batch data generated',
        details: stepResult.data
      };
    }

    return {
      status: 'passed',
      message: 'Batch data generation validated',
      details: { batchSize: batchData.length }
    };
  }

  private async validateBatchExecution(
    context: TestExecutionContext,
    stepResult: TestStepResult
  ): Promise<ValidationResult> {
    const results = stepResult.data?.results || [];
    const successCount = results.filter((r: any) => r.success).length;
    const totalCount = results.length;

    return {
      status: successCount === totalCount ? 'passed' : 'warning',
      message: `Batch execution: ${successCount}/${totalCount} operations successful`,
      details: { successCount, totalCount, results }
    };
  }

  private async validateBatchPerformance(
    context: TestExecutionContext,
    stepResult: TestStepResult
  ): Promise<ValidationResult> {
    const metrics = stepResult.data?.metrics;
    if (!metrics) {
      return {
        status: 'warning',
        message: 'No performance metrics available',
        details: stepResult.data
      };
    }

    return {
      status: 'passed',
      message: 'Performance metrics captured',
      details: metrics
    };
  }

  private async validateBidirectionalProtocol(
    context: TestExecutionContext,
    stepResult: TestStepResult
  ): Promise<ValidationResult> {
    return {
      status: 'warning',
      message: 'Bidirectional protocol validation not fully implemented',
      details: {
        note: 'Requires server integration for complete validation',
        stepResult: stepResult.data
      }
    };
  }

  private validateEntityIds(generatedData: any): boolean {
    for (const entityType of Object.keys(generatedData)) {
      const entities = generatedData[entityType];
      if (!Array.isArray(entities)) continue;
      
      for (const entity of entities) {
        if (!entity.id || typeof entity.id !== 'string') {
          return false;
        }
      }
    }
    return true;
  }

  private validateDataStructure(generatedData: any): boolean {
    // Basic structure validation - could be more sophisticated
    return typeof generatedData === 'object' && generatedData !== null;
  }

  private createGenericValidation(
    stepResult: TestStepResult,
    stepType: string
  ): ValidationResult {
    return {
      status: stepResult.success ? 'passed' : 'failed',
      message: `Generic validation for ${stepType}: ${stepResult.success ? 'passed' : 'failed'}`,
      details: {
        stepType,
        success: stepResult.success,
        duration: stepResult.duration,
        error: stepResult.error?.message
      }
    };
  }
} 