import type {
  TestExecutionContext,
  ValidationResult,
  SyncStateSnapshot
} from '../core/TestTypes';
import { SyncTestFramework } from '../core/SyncTestFramework';

/**
 * Outgoing Validator - validates outgoing changes and sync tracking
 * Ensures that all operations are properly tracked for sync
 */
export class OutgoingValidator {
  constructor(private framework: SyncTestFramework) {}

  /**
   * Validate outgoing changes for a test execution
   */
  async validateOutgoingChanges(testContext: TestExecutionContext): Promise<ValidationResult> {
    try {
      // Get pending changes
      const pendingChanges = await this.framework.getLocalChanges();
      
      // Run all validation checks
      const validationResults = await Promise.all([
        this.validateChangeTracking(testContext, pendingChanges),
        this.validateClientIdPresence(pendingChanges),
        this.validateChangeOptimization(pendingChanges),
        this.validateMetadataEncoding(testContext, pendingChanges)
      ]);

      // Combine validation results
      const failedValidations = validationResults.filter(v => v.status === 'failed');
      const warningValidations = validationResults.filter(v => v.status === 'warning');

      if (failedValidations.length > 0) {
        return {
          status: 'failed',
          message: `${failedValidations.length} validation(s) failed`,
          details: {
            failed: failedValidations,
            warnings: warningValidations,
            passed: validationResults.filter(v => v.status === 'passed')
          },
          suggestions: this.generateSuggestions(failedValidations)
        };
      }

      if (warningValidations.length > 0) {
        return {
          status: 'warning',
          message: `All validations passed with ${warningValidations.length} warning(s)`,
          details: {
            warnings: warningValidations,
            passed: validationResults.filter(v => v.status === 'passed')
          }
        };
      }

      return {
        status: 'passed',
        message: 'All outgoing change validations passed',
        details: {
          passed: validationResults,
          totalChanges: pendingChanges.length
        }
      };

    } catch (error) {
      return {
        status: 'failed',
        message: 'Outgoing validation failed with error',
        details: { error: (error as Error).message }
      };
    }
  }

  /**
   * Validate that changes were properly tracked
   */
  private async validateChangeTracking(
    testContext: TestExecutionContext, 
    pendingChanges: any[]
  ): Promise<ValidationResult> {
    const operationResults = testContext.metadata.operationResults || {};
    
    // Count expected changes based on operations performed
    let expectedChangeCount = 0;
    const operationBreakdown: Record<string, number> = {};
    
    for (const [operation, results] of Object.entries(operationResults)) {
      const count = (results as any[]).length;
      expectedChangeCount += count;
      operationBreakdown[operation] = count;
    }

    const actualChangeCount = pendingChanges.filter(change => !change.processedSync).length;

    if (actualChangeCount === 0 && expectedChangeCount > 0) {
      return {
        status: 'failed',
        message: 'No changes were tracked despite operations being performed',
        details: {
          expected: expectedChangeCount,
          actual: actualChangeCount,
          operationBreakdown
        }
      };
    }

    if (actualChangeCount < expectedChangeCount) {
      return {
        status: 'warning',
        message: 'Fewer changes tracked than expected (some may have been optimized)',
        details: {
          expected: expectedChangeCount,
          actual: actualChangeCount,
          operationBreakdown,
          difference: expectedChangeCount - actualChangeCount
        }
      };
    }

    return {
      status: 'passed',
      message: `Change tracking successful - ${actualChangeCount} changes tracked`,
      details: {
        expected: expectedChangeCount,
        actual: actualChangeCount,
        operationBreakdown
      }
    };
  }

  /**
   * Validate that clientId is present for anti-echo
   */
  private async validateClientIdPresence(pendingChanges: any[]): Promise<ValidationResult> {
    const changesWithoutClientId = pendingChanges.filter(change => {
      const data = change.data || {};
      return !data.clientId;
    });

    if (changesWithoutClientId.length > 0) {
      return {
        status: 'failed',
        message: 'Some changes are missing clientId for anti-echo',
        details: {
          totalChanges: pendingChanges.length,
          missingClientId: changesWithoutClientId.length,
          percentage: Math.round((changesWithoutClientId.length / pendingChanges.length) * 100)
        }
      };
    }

    // Check for consistent clientId
    const clientIds = new Set(
      pendingChanges
        .map(change => change.data?.clientId)
        .filter(id => id)
    );

    if (clientIds.size > 1) {
      return {
        status: 'warning',
        message: 'Multiple client IDs found in changes',
        details: {
          clientIds: Array.from(clientIds),
          uniqueCount: clientIds.size
        }
      };
    }

    return {
      status: 'passed',
      message: `All ${pendingChanges.length} changes have consistent clientId`,
      details: {
        totalChanges: pendingChanges.length,
        clientId: Array.from(clientIds)[0]
      }
    };
  }

  /**
   * Validate change optimization and deduplication
   */
  private async validateChangeOptimization(pendingChanges: any[]): Promise<ValidationResult> {
    // Group changes by entity (table + entity ID)
    const entityChangeMap = new Map<string, any[]>();
    
    for (const change of pendingChanges) {
      const entityId = change.data?.id;
      if (!entityId) continue;
      
      const key = `${change.table}:${entityId}`;
      if (!entityChangeMap.has(key)) {
        entityChangeMap.set(key, []);
      }
      entityChangeMap.get(key)!.push(change);
    }

    // Check for potential optimization opportunities
    const entitiesWithMultipleChanges = Array.from(entityChangeMap.entries())
      .filter(([_, changes]) => changes.length > 1);

    if (entitiesWithMultipleChanges.length > 0) {
      return {
        status: 'warning',
        message: 'Multiple unprocessed changes found for some entities',
        details: {
          entitiesWithMultipleChanges: entitiesWithMultipleChanges.length,
          totalEntities: entityChangeMap.size,
          examples: entitiesWithMultipleChanges.slice(0, 3).map(([key, changes]) => ({
            entity: key,
            changeCount: changes.length,
            operations: changes.map(c => c.operation)
          }))
        }
      };
    }

    return {
      status: 'passed',
      message: 'Change optimization appears effective',
      details: {
        totalChanges: pendingChanges.length,
        uniqueEntities: entityChangeMap.size,
        averageChangesPerEntity: pendingChanges.length / entityChangeMap.size
      }
    };
  }

  /**
   * Validate metadata encoding for relationships
   */
  private async validateMetadataEncoding(
    testContext: TestExecutionContext,
    pendingChanges: any[]
  ): Promise<ValidationResult> {
    // Check if any operations involved relationships
    const operationResults = testContext.metadata.operationResults || {};
    const hasRelationshipOperations = Object.values(operationResults).some((results: unknown) => {
      if (!Array.isArray(results)) return false;
      return results.some((result: any) => result.operation === 'relationship' || result.metadata);
    });

    if (!hasRelationshipOperations) {
      return {
        status: 'passed',
        message: 'No relationship operations to validate metadata for'
      };
    }

    // Check for changes with relationship metadata
    const changesWithMetadata = pendingChanges.filter(change => {
      const data = change.data || {};
      return data.__metadata || data.relationshipUpdates;
    });

    if (changesWithMetadata.length === 0 && hasRelationshipOperations) {
      return {
        status: 'warning',
        message: 'Expected relationship metadata but none found',
        details: {
          hasRelationshipOperations,
          changesWithMetadata: changesWithMetadata.length
        }
      };
    }

    // Validate metadata structure
    const invalidMetadata = changesWithMetadata.filter(change => {
      const metadata = change.data?.__metadata;
      if (!metadata) return false;
      
      // Check for required metadata structure
      if (metadata.relationshipUpdates && !Array.isArray(metadata.relationshipUpdates)) {
        return true;
      }
      
      return false;
    });

    if (invalidMetadata.length > 0) {
      return {
        status: 'failed',
        message: 'Invalid metadata structure found in changes',
        details: {
          invalidChanges: invalidMetadata.length,
          totalWithMetadata: changesWithMetadata.length
        }
      };
    }

    return {
      status: 'passed',
      message: `Metadata encoding validated for ${changesWithMetadata.length} changes`,
      details: {
        changesWithMetadata: changesWithMetadata.length,
        totalChanges: pendingChanges.length
      }
    };
  }

  /**
   * Validate sync state during test execution
   */
  async validateSyncState(testContext: TestExecutionContext): Promise<ValidationResult> {
    try {
      const currentState = this.framework.getCurrentSyncState();
      const initialState = testContext.metadata.initialSyncState as SyncStateSnapshot;

      // Basic state validation
      if (!currentState) {
        return {
          status: 'failed',
          message: 'Cannot retrieve current sync state'
        };
      }

      // Check for state changes
      const stateChanges = {
        pendingChangesIncrease: currentState.pendingChangesCount - (initialState?.pendingChangesCount || 0),
        queueSizeIncrease: currentState.queueSize - (initialState?.queueSize || 0)
      };

      if (stateChanges.pendingChangesIncrease <= 0) {
        return {
          status: 'warning',
          message: 'No increase in pending changes count detected',
          details: {
            initial: initialState?.pendingChangesCount || 0,
            current: currentState.pendingChangesCount,
            change: stateChanges.pendingChangesIncrease
          }
        };
      }

      return {
        status: 'passed',
        message: 'Sync state changes detected as expected',
        details: {
          stateChanges,
          currentState: {
            pendingChanges: currentState.pendingChangesCount,
            queueSize: currentState.queueSize,
            connectionStatus: currentState.connectionStatus
          }
        }
      };

    } catch (error) {
      return {
        status: 'failed',
        message: 'Failed to validate sync state',
        details: { error: (error as Error).message }
      };
    }
  }

  /**
   * Generate suggestions based on failed validations
   */
  private generateSuggestions(failedValidations: ValidationResult[]): string[] {
    const suggestions: string[] = [];

    for (const validation of failedValidations) {
      if (validation.message.includes('No changes were tracked')) {
        suggestions.push('Ensure OutgoingChangeProcessor.trackChange() is called after each operation');
        suggestions.push('Check if services are properly wired with sync change manager');
      }

      if (validation.message.includes('missing clientId')) {
        suggestions.push('Verify client ID is set in SyncManager before operations');
        suggestions.push('Check if clientId is being properly added to change data');
      }

      if (validation.message.includes('Invalid metadata structure')) {
        suggestions.push('Verify RelationshipChangeEncoder is working correctly');
        suggestions.push('Check metadata structure matches expected format');
      }
    }

    // Remove duplicates
    return Array.from(new Set(suggestions));
  }
} 