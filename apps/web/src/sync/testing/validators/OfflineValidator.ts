import type {
  TestExecutionContext,
  ValidationResult,
  SyncStateSnapshot
} from '../core/TestTypes';
import { SyncTestFramework } from '../core/SyncTestFramework';

/**
 * Offline Validator - validates offline change handling and LocalChanges management
 * Ensures that all offline operations are properly queued and can be recovered
 */
export class OfflineValidator {
  constructor(private framework: SyncTestFramework) {}

  /**
   * Validate offline changes and queue integrity
   */
  async validateOfflineChanges(testContext: TestExecutionContext): Promise<ValidationResult> {
    try {
      // Get local changes and test metadata
      const localChanges = await this.framework.getLocalChanges();
      const offlineOperations = testContext.metadata.offlineOperations || [];
      
      // Run all validation checks
      const validationResults = await Promise.all([
        this.validateLocalChangesQueue(testContext, localChanges),
        this.validateOfflineOperationTracking(offlineOperations, localChanges),
        this.validateQueuePersistence(localChanges),
        this.validateChangeOptimization(localChanges),
        this.validateRecoveryReadiness(testContext, localChanges)
      ]);

      // Combine validation results
      const failedValidations = validationResults.filter(v => v.status === 'failed');
      const warningValidations = validationResults.filter(v => v.status === 'warning');

      if (failedValidations.length > 0) {
        return {
          status: 'failed',
          message: `${failedValidations.length} offline validation(s) failed`,
          details: {
            failed: failedValidations,
            warnings: warningValidations,
            passed: validationResults.filter(v => v.status === 'passed'),
            totalLocalChanges: localChanges.length
          },
          suggestions: this.generateOfflineSuggestions(failedValidations)
        };
      }

      if (warningValidations.length > 0) {
        return {
          status: 'warning',
          message: `Offline validations passed with ${warningValidations.length} warning(s)`,
          details: {
            warnings: warningValidations,
            passed: validationResults.filter(v => v.status === 'passed'),
            totalLocalChanges: localChanges.length
          }
        };
      }

      return {
        status: 'passed',
        message: 'All offline change validations passed',
        details: {
          passed: validationResults,
          totalLocalChanges: localChanges.length,
          offlineOperations: offlineOperations.length
        }
      };

    } catch (error) {
      return {
        status: 'failed',
        message: 'Offline validation failed with error',
        details: { error: (error as Error).message }
      };
    }
  }

  /**
   * Validate LocalChanges queue integrity
   */
  private async validateLocalChangesQueue(
    testContext: TestExecutionContext,
    localChanges: any[]
  ): Promise<ValidationResult> {
    const initialLocalChanges = testContext.metadata.initialLocalChanges as any[] || [];
    const newChanges = localChanges.length - initialLocalChanges.length;

    // Check if queue exists and has entries
    if (localChanges.length === 0) {
      return {
        status: 'failed',
        message: 'No LocalChanges queue found',
        details: { localChangesCount: 0 }
      };
    }

    // Validate queue structure
    const invalidChanges = localChanges.filter(change => {
      return !change.table || 
             !change.operation || 
             !change.data || 
             typeof change.processedSync !== 'number';
    });

    if (invalidChanges.length > 0) {
      return {
        status: 'failed',
        message: 'Invalid LocalChanges structure detected',
        details: {
          invalidChanges: invalidChanges.length,
          totalChanges: localChanges.length,
          examples: invalidChanges.slice(0, 3)
        }
      };
    }

    // Check for unprocessed changes (should exist for offline operations)
    const unprocessedChanges = localChanges.filter(change => change.processedSync === 0);
    
    if (newChanges > 0 && unprocessedChanges.length === 0) {
      return {
        status: 'warning',
        message: 'No unprocessed changes found despite new operations',
        details: {
          newChanges,
          unprocessedChanges: unprocessedChanges.length
        }
      };
    }

    return {
      status: 'passed',
      message: `LocalChanges queue valid - ${localChanges.length} total, ${unprocessedChanges.length} unprocessed`,
      details: {
        totalChanges: localChanges.length,
        newChanges,
        unprocessedChanges: unprocessedChanges.length
      }
    };
  }

  /**
   * Validate that offline operations were properly tracked
   */
  private async validateOfflineOperationTracking(
    offlineOperations: any[],
    localChanges: any[]
  ): Promise<ValidationResult> {
    if (offlineOperations.length === 0) {
      return {
        status: 'passed',
        message: 'No offline operations to validate'
      };
    }

    // Count operations by type
    const operationTypes = offlineOperations.reduce((acc: Record<string, number>, op) => {
      acc[op.type] = (acc[op.type] || 0) + 1;
      return acc;
    }, {});

    // Check if we have corresponding LocalChanges entries
    const unprocessedChanges = localChanges.filter(change => change.processedSync === 0);
    
    if (unprocessedChanges.length < offlineOperations.length) {
      return {
        status: 'warning',
        message: 'Fewer LocalChanges than offline operations (may be optimized)',
        details: {
          offlineOperations: offlineOperations.length,
          localChanges: unprocessedChanges.length,
          operationTypes
        }
      };
    }

    // Validate operation types are represented
    const changeOperations = new Set(unprocessedChanges.map(change => change.operation));
    const expectedOperations = new Set(['insert', 'update', 'delete']);
    
    const hasExpectedOperations = Array.from(expectedOperations).some(op => 
      changeOperations.has(op)
    );

    if (!hasExpectedOperations) {
      return {
        status: 'failed',
        message: 'No expected CRUD operations found in LocalChanges',
        details: {
          foundOperations: Array.from(changeOperations),
          expectedOperations: Array.from(expectedOperations)
        }
      };
    }

    return {
      status: 'passed',
      message: `Offline operation tracking valid - ${offlineOperations.length} operations tracked`,
      details: {
        offlineOperations: offlineOperations.length,
        localChanges: unprocessedChanges.length,
        operationTypes
      }
    };
  }

  /**
   * Validate queue persistence and data integrity
   */
  private async validateQueuePersistence(localChanges: any[]): Promise<ValidationResult> {
    // Check for required fields in each LocalChanges entry
    const requiredFields = ['id', 'table', 'operation', 'data', 'lsn', 'updatedAt', 'processedSync'];
    const incompleteChanges = localChanges.filter(change => {
      return requiredFields.some(field => change[field] === undefined || change[field] === null);
    });

    if (incompleteChanges.length > 0) {
      return {
        status: 'failed',
        message: 'Incomplete LocalChanges entries found',
        details: {
          incompleteEntries: incompleteChanges.length,
          totalEntries: localChanges.length,
          requiredFields
        }
      };
    }

    // Validate data structure integrity
    const dataIntegrityIssues = localChanges.filter(change => {
      try {
        // Check if data is a valid object with id
        if (typeof change.data !== 'object' || !change.data.id) {
          return true;
        }
        return false;
      } catch {
        return true;
      }
    });

    if (dataIntegrityIssues.length > 0) {
      return {
        status: 'failed',
        message: 'Data integrity issues in LocalChanges',
        details: {
          integrityIssues: dataIntegrityIssues.length,
          totalEntries: localChanges.length
        }
      };
    }

    return {
      status: 'passed',
      message: `Queue persistence validated - ${localChanges.length} entries with complete data`,
      details: {
        totalEntries: localChanges.length,
        validatedFields: requiredFields
      }
    };
  }

  /**
   * Validate change optimization and deduplication
   */
  private async validateChangeOptimization(localChanges: any[]): Promise<ValidationResult> {
    // Group changes by entity (table + entity ID)
    const entityChangeMap = new Map<string, any[]>();
    
    for (const change of localChanges) {
      const entityId = change.data?.id;
      if (!entityId) continue;
      
      const key = `${change.table}:${entityId}`;
      if (!entityChangeMap.has(key)) {
        entityChangeMap.set(key, []);
      }
      entityChangeMap.get(key)!.push(change);
    }

    // Look for optimization opportunities
    const entitiesWithMultipleChanges = Array.from(entityChangeMap.entries())
      .filter(([_, changes]) => changes.length > 1);

    if (entitiesWithMultipleChanges.length > 0) {
      // Check if these are legitimately different operations
      const duplicateOperations = entitiesWithMultipleChanges.filter(([_, changes]) => {
        const operations = new Set(changes.map(c => c.operation));
        return operations.size < changes.length; // Same operation type repeated
      });

      if (duplicateOperations.length > 0) {
        return {
          status: 'warning',
          message: 'Potential optimization opportunities detected',
          details: {
            entitiesWithDuplicates: duplicateOperations.length,
            totalEntities: entityChangeMap.size,
            examples: duplicateOperations.slice(0, 3).map(([key, changes]) => ({
              entity: key,
              changeCount: changes.length,
              operations: changes.map(c => c.operation)
            }))
          }
        };
      }
    }

    return {
      status: 'passed',
      message: `Change optimization analysis complete - ${entitiesWithMultipleChanges.length} entities with multiple changes`,
      details: {
        totalChanges: localChanges.length,
        uniqueEntities: entityChangeMap.size,
        entitiesWithMultipleChanges: entitiesWithMultipleChanges.length
      }
    };
  }

  /**
   * Validate recovery readiness
   */
  private async validateRecoveryReadiness(
    testContext: TestExecutionContext,
    localChanges: any[]
  ): Promise<ValidationResult> {
    const unprocessedChanges = localChanges.filter(change => change.processedSync === 0);
    
    if (unprocessedChanges.length === 0) {
      return {
        status: 'warning',
        message: 'No unprocessed changes available for recovery',
        details: { unprocessedChanges: 0 }
      };
    }

    // Check if changes have required fields for sync processing
    const syncReadyChanges = unprocessedChanges.filter(change => {
      return change.data?.clientId && // Has client ID for anti-echo
             change.lsn &&            // Has LSN for ordering
             change.updatedAt;        // Has timestamp
    });

    const notReadyCount = unprocessedChanges.length - syncReadyChanges.length;
    
    if (notReadyCount > 0) {
      return {
        status: 'failed',
        message: `${notReadyCount} changes not ready for sync processing`,
        details: {
          totalUnprocessed: unprocessedChanges.length,
          syncReady: syncReadyChanges.length,
          notReady: notReadyCount
        }
      };
    }

    return {
      status: 'passed',
      message: `Recovery readiness validated - ${syncReadyChanges.length} changes ready for sync`,
      details: {
        syncReadyChanges: syncReadyChanges.length,
        totalUnprocessed: unprocessedChanges.length
      }
    };
  }

  /**
   * Validate offline to online recovery process
   */
  async validateRecoveryProcess(testContext: TestExecutionContext): Promise<ValidationResult> {
    try {
      const currentState = this.framework.getCurrentSyncState();
      const isOffline = testContext.metadata.isOffline;
      const localChanges = await this.framework.getLocalChanges();

      if (isOffline) {
        // Still offline - validate queue is intact
        const unprocessedChanges = localChanges.filter(change => change.processedSync === 0);
        
        return {
          status: 'passed',
          message: `Offline state maintained - ${unprocessedChanges.length} changes queued`,
          details: {
            offline: true,
            queuedChanges: unprocessedChanges.length,
            connectionStatus: currentState.connectionStatus
          }
        };
      } else {
        // Back online - validate recovery capability
        const unprocessedChanges = localChanges.filter(change => change.processedSync === 0);
        
        if (unprocessedChanges.length === 0) {
          return {
            status: 'warning',
            message: 'No changes available for recovery process',
            details: { unprocessedChanges: 0 }
          };
        }

        return {
          status: 'passed',
          message: `Recovery process ready - ${unprocessedChanges.length} changes awaiting sync`,
          details: {
            online: true,
            awaitingSync: unprocessedChanges.length,
            connectionStatus: currentState.connectionStatus
          }
        };
      }

    } catch (error) {
      return {
        status: 'failed',
        message: 'Recovery process validation failed',
        details: { error: (error as Error).message }
      };
    }
  }

  /**
   * Generate suggestions for failed offline validations
   */
  private generateOfflineSuggestions(failedValidations: ValidationResult[]): string[] {
    const suggestions: string[] = [];

    for (const validation of failedValidations) {
      if (validation.message.includes('No LocalChanges queue')) {
        suggestions.push('Ensure LocalChanges entity is properly configured and database is initialized');
        suggestions.push('Check if OutgoingChangeProcessor.trackChange() is being called');
      }

      if (validation.message.includes('Invalid LocalChanges structure')) {
        suggestions.push('Verify LocalChanges entity schema matches expected structure');
        suggestions.push('Check database migration and entity mapping');
      }

      if (validation.message.includes('No expected CRUD operations')) {
        suggestions.push('Verify services are properly calling trackChange() for operations');
        suggestions.push('Check if sync integration is enabled in service layer');
      }

      if (validation.message.includes('Incomplete LocalChanges entries')) {
        suggestions.push('Verify OutgoingChangeProcessor is setting all required fields');
        suggestions.push('Check LSN generation and client ID assignment');
      }

      if (validation.message.includes('not ready for sync processing')) {
        suggestions.push('Ensure client ID is set before performing operations');
        suggestions.push('Verify LSN and timestamp generation in change tracking');
      }
    }

    // Remove duplicates
    return Array.from(new Set(suggestions));
  }
} 