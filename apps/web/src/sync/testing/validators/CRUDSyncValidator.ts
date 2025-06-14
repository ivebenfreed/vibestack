import type {
  TestExecutionContext,
  ValidationResult,
  EntityType,
  OperationType
} from '../core/TestTypes';
import { SyncTestFramework } from '../core/SyncTestFramework';

/**
 * CRUD Sync Validator - validates the sync response to individual CRUD operations
 * Focuses on the immediate sync tracking and state changes for each operation
 */
export class CRUDSyncValidator {
  constructor(private framework: SyncTestFramework) {}

  /**
   * Validate that a CRUD operation created the expected sync response
   */
  async validateCRUDOperationSync(
    entityType: EntityType,
    operationType: OperationType,
    operationResult: any,
    beforeSyncState: any,
    afterSyncState: any,
    newChanges: any[]
  ): Promise<ValidationResult> {
    try {
      // Run individual validations
      const validations = await Promise.all([
        this.validateChangeCreated(newChanges, operationType, entityType),
        this.validateChangeContent(newChanges, operationResult, operationType),
        this.validateSyncStateResponse(beforeSyncState, afterSyncState, operationType),
        this.validateChangeMetadata(newChanges, operationType),
        this.validateAntiEcho(newChanges)
      ]);

      // Combine results
      const failedValidations = validations.filter(v => v.status === 'failed');
      const warningValidations = validations.filter(v => v.status === 'warning');

      if (failedValidations.length > 0) {
        return {
          status: 'failed',
          message: `CRUD sync validation failed: ${failedValidations.length} error(s)`,
          details: {
            entityType,
            operationType,
            failed: failedValidations,
            warnings: warningValidations,
            passed: validations.filter(v => v.status === 'passed')
          },
          suggestions: this.generateCRUDSyncSuggestions(failedValidations, operationType)
        };
      }

      if (warningValidations.length > 0) {
        return {
          status: 'warning',
          message: `CRUD sync validation passed with ${warningValidations.length} warning(s)`,
          details: {
            entityType,
            operationType,
            warnings: warningValidations,
            passed: validations.filter(v => v.status === 'passed')
          }
        };
      }

      return {
        status: 'passed',
        message: `CRUD sync validation successful for ${operationType} on ${entityType}`,
        details: {
          entityType,
          operationType,
          passed: validations,
          changesCreated: newChanges.length
        }
      };

    } catch (error) {
      return {
        status: 'failed',
        message: 'CRUD sync validation error',
        details: { 
          error: (error as Error).message,
          entityType,
          operationType
        }
      };
    }
  }

  /**
   * Validate that the operation created local changes
   */
  private async validateChangeCreated(
    newChanges: any[],
    operationType: OperationType,
    entityType: EntityType
  ): Promise<ValidationResult> {
    if (newChanges.length === 0) {
      return {
        status: 'failed',
        message: `No local changes created for ${operationType} operation`,
        details: { operationType, entityType, expectedChanges: 1, actualChanges: 0 }
      };
    }

    // Check for correct operation type
    const correctOperationChanges = newChanges.filter(change => 
      change.operation === operationType
    );

    if (correctOperationChanges.length === 0) {
      return {
        status: 'failed',
        message: `No changes with correct operation type (${operationType})`,
        details: {
          expectedOperation: operationType,
          foundOperations: newChanges.map(c => c.operation)
        }
      };
    }

    // Check for correct entity type
    const correctEntityChanges = newChanges.filter(change => 
      change.tableName === this.getTableNameForEntity(entityType)
    );

    if (correctEntityChanges.length === 0) {
      return {
        status: 'failed',
        message: `No changes for correct entity type (${entityType})`,
        details: {
          expectedEntity: entityType,
          foundEntities: newChanges.map(c => c.tableName)
        }
      };
    }

    return {
      status: 'passed',
      message: `Local change created successfully for ${operationType} on ${entityType}`,
      details: {
        changesCreated: newChanges.length,
        correctOperationType: correctOperationChanges.length,
        correctEntityType: correctEntityChanges.length
      }
    };
  }

  /**
   * Validate the content of the created change matches the operation
   */
  private async validateChangeContent(
    newChanges: any[],
    operationResult: any,
    operationType: OperationType
  ): Promise<ValidationResult> {
    if (newChanges.length === 0) {
      return {
        status: 'failed',
        message: 'No changes to validate content'
      };
    }

    const change = newChanges[0]; // Focus on the first relevant change
    const entityId = operationResult?.id;

    // Validate entity ID correlation
    if (entityId) {
      const changeHasCorrectId = 
        (change.data?.id === entityId) || 
        (change.oldData?.id === entityId);

      if (!changeHasCorrectId) {
        return {
          status: 'failed',
          message: 'Change does not reference the correct entity ID',
          details: {
            expectedId: entityId,
            changeDataId: change.data?.id,
            changeOldDataId: change.oldData?.id
          }
        };
      }
    }

    // Validate operation-specific content
    switch (operationType) {
      case 'insert':
        if (!change.data || Object.keys(change.data).length === 0) {
          return {
            status: 'failed',
            message: 'Insert change missing new data',
            details: { changeData: change.data }
          };
        }
        break;

      case 'update':
        if (!change.data || Object.keys(change.data).length === 0) {
          return {
            status: 'warning',
            message: 'Update change has minimal data (may be optimized)',
            details: { changeData: change.data }
          };
        }
        break;

      case 'delete':
        if (!change.oldData && !change.data?.id) {
          return {
            status: 'failed',
            message: 'Delete change missing entity reference',
            details: { changeData: change.data, oldData: change.oldData }
          };
        }
        break;
    }

    return {
      status: 'passed',
      message: `Change content valid for ${operationType} operation`,
      details: {
        operationType,
        hasData: !!change.data,
        hasOldData: !!change.oldData,
        entityId
      }
    };
  }

  /**
   * Validate sync state changed appropriately
   */
  private async validateSyncStateResponse(
    beforeState: any,
    afterState: any,
    operationType: OperationType
  ): Promise<ValidationResult> {
    const delta = this.framework.captureSyncStateDelta(beforeState, afterState);

    // Sync state should increase for most operations
    if (delta.pendingChangesIncrease <= 0) {
      return {
        status: 'warning',
        message: 'Sync state did not increase (change may have been optimized)',
        details: {
          pendingChangesDelta: delta.pendingChangesIncrease,
          queueSizeDelta: delta.queueSizeIncrease,
          operationType
        }
      };
    }

    // Validate timing
    if (delta.timeDelta > 1000) {
      return {
        status: 'warning',
        message: 'Long delay between operation and sync state update',
        details: {
          timeDelta: delta.timeDelta,
          operationType
        }
      };
    }

    return {
      status: 'passed',
      message: 'Sync state responded appropriately to operation',
      details: {
        pendingChangesIncrease: delta.pendingChangesIncrease,
        queueSizeIncrease: delta.queueSizeIncrease,
        timeDelta: delta.timeDelta,
        operationType
      }
    };
  }

  /**
   * Validate change metadata (timestamps, client ID, etc.)
   */
  private async validateChangeMetadata(
    newChanges: any[],
    operationType: OperationType
  ): Promise<ValidationResult> {
    if (newChanges.length === 0) {
      return {
        status: 'failed',
        message: 'No changes to validate metadata'
      };
    }

    const change = newChanges[0];
    const issues = [];

    // Check for timestamp
    if (!change.createdAt && !change.timestamp) {
      issues.push('Missing timestamp');
    }

    // Check for client ID (for anti-echo)
    if (!change.data?.clientId && !change.clientId) {
      issues.push('Missing client ID for anti-echo');
    }

    // Check for operation field
    if (!change.operation) {
      issues.push('Missing operation type');
    } else if (change.operation !== operationType) {
      issues.push(`Operation mismatch: expected ${operationType}, got ${change.operation}`);
    }

    // Check for table name
    if (!change.tableName && !change.table) {
      issues.push('Missing table name');
    }

    if (issues.length > 0) {
      return {
        status: 'failed',
        message: 'Change metadata validation failed',
        details: {
          issues,
          change: {
            operation: change.operation,
            tableName: change.tableName || change.table,
            hasClientId: !!(change.data?.clientId || change.clientId),
            hasTimestamp: !!(change.createdAt || change.timestamp)
          }
        }
      };
    }

    return {
      status: 'passed',
      message: 'Change metadata validation successful',
      details: {
        operation: change.operation,
        tableName: change.tableName || change.table,
        hasClientId: !!(change.data?.clientId || change.clientId),
        hasTimestamp: !!(change.createdAt || change.timestamp)
      }
    };
  }

  /**
   * Validate anti-echo capability
   */
  private async validateAntiEcho(newChanges: any[]): Promise<ValidationResult> {
    if (newChanges.length === 0) {
      return {
        status: 'failed',
        message: 'No changes to validate anti-echo'
      };
    }

    const changesWithClientId = newChanges.filter(change => 
      change.data?.clientId || change.clientId
    );

    if (changesWithClientId.length === 0) {
      return {
        status: 'failed',
        message: 'No changes have client ID for anti-echo protection',
        details: {
          totalChanges: newChanges.length,
          changesWithClientId: 0
        }
      };
    }

    // Check for consistent client ID
    const clientIds = new Set(
      changesWithClientId.map(change => change.data?.clientId || change.clientId)
    );

    if (clientIds.size > 1) {
      return {
        status: 'warning',
        message: 'Multiple client IDs found in changes',
        details: {
          clientIds: Array.from(clientIds),
          expectedSingle: true
        }
      };
    }

    return {
      status: 'passed',
      message: 'Anti-echo validation successful',
      details: {
        changesWithClientId: changesWithClientId.length,
        totalChanges: newChanges.length,
        clientId: Array.from(clientIds)[0]
      }
    };
  }

  /**
   * Get table name for entity type
   */
  private getTableNameForEntity(entityType: EntityType): string {
    switch (entityType) {
      case 'tasks': return 'tasks';
      case 'projects': return 'projects';
      case 'users': return 'users';
      case 'comments': return 'comments';
      default: throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  /**
   * Generate suggestions for failed CRUD sync validations
   */
  private generateCRUDSyncSuggestions(
    failedValidations: ValidationResult[], 
    operationType: OperationType
  ): string[] {
    const suggestions = [];

    if (failedValidations.some(v => v.message.includes('No local changes created'))) {
      suggestions.push(`Ensure ${operationType} operation triggers LocalChanges creation`);
      suggestions.push('Check if sync tracking is enabled for this entity type');
    }

    if (failedValidations.some(v => v.message.includes('client ID'))) {
      suggestions.push('Verify client ID is properly set in operation context');
      suggestions.push('Check anti-echo configuration');
    }

    if (failedValidations.some(v => v.message.includes('Sync state'))) {
      suggestions.push('Verify OutgoingChangeProcessor is running');
      suggestions.push('Check if changes are being optimized or deduplicated');
    }

    if (failedValidations.some(v => v.message.includes('content'))) {
      suggestions.push(`Verify ${operationType} operation provides correct data structure`);
      suggestions.push('Check entity schema validation');
    }

    return suggestions;
  }
} 