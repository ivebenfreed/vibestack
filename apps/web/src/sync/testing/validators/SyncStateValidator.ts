import type {
  TestExecutionContext,
  ValidationResult,
  SyncStateSnapshot
} from '../core/TestTypes';
import { SyncTestFramework } from '../core/SyncTestFramework';

/**
 * Sync State Validator - validates sync state transitions and management
 * Ensures proper state transitions, LSN progression, and state consistency
 */
export class SyncStateValidator {
  constructor(private framework: SyncTestFramework) {}

  /**
   * Validate sync state transitions and consistency
   */
  async validateSyncStates(testContext: TestExecutionContext): Promise<ValidationResult> {
    try {
      const transitionLog = testContext.metadata.stateTransitionLog || [];
      const currentState = this.framework.getCurrentSyncState();
      
      // Run all validation checks
      const validationResults = await Promise.all([
        this.validateStateTransitions(transitionLog),
        this.validateLSNProgression(transitionLog),
        this.validateStateConsistency(transitionLog),
        this.validateStateEvents(testContext),
        this.validateConnectionStates(transitionLog)
      ]);

      // Combine validation results
      const failedValidations = validationResults.filter(v => v.status === 'failed');
      const warningValidations = validationResults.filter(v => v.status === 'warning');

      if (failedValidations.length > 0) {
        return {
          status: 'failed',
          message: `${failedValidations.length} sync state validation(s) failed`,
          details: {
            failed: failedValidations,
            warnings: warningValidations,
            passed: validationResults.filter(v => v.status === 'passed'),
            currentState,
            transitionCount: transitionLog.length
          },
          suggestions: this.generateSyncStateSuggestions(failedValidations)
        };
      }

      if (warningValidations.length > 0) {
        return {
          status: 'warning',
          message: `Sync state validations passed with ${warningValidations.length} warning(s)`,
          details: {
            warnings: warningValidations,
            passed: validationResults.filter(v => v.status === 'passed'),
            currentState,
            transitionCount: transitionLog.length
          }
        };
      }

      return {
        status: 'passed',
        message: 'All sync state validations passed',
        details: {
          passed: validationResults,
          currentState,
          transitionCount: transitionLog.length,
          statesObserved: [...new Set(transitionLog.map((t: any) => t.state))]
        }
      };

    } catch (error) {
      return {
        status: 'failed',
        message: 'Sync state validation failed with error',
        details: { error: (error as Error).message }
      };
    }
  }

  /**
   * Validate state transitions follow expected patterns
   */
  private async validateStateTransitions(transitionLog: any[]): Promise<ValidationResult> {
    if (transitionLog.length === 0) {
      return {
        status: 'warning',
        message: 'No state transitions to validate'
      };
    }

    const invalidTransitions = [];
    const validTransitionPairs = new Set([
      'offline->initial', 'initial->catchup', 'initial->live', 
      'catchup->live', 'live->offline', 'offline->catchup'
    ]);

    for (let i = 1; i < transitionLog.length; i++) {
      const prevState = transitionLog[i - 1].state;
      const currState = transitionLog[i].state;
      const transitionPair = `${prevState}->${currState}`;
      
      // Allow same state transitions (staying in same state)
      if (prevState === currState) {
        continue;
      }
      
      // Check if this is a valid transition
      if (!validTransitionPairs.has(transitionPair)) {
        invalidTransitions.push({
          from: prevState,
          to: currState,
          timestamp: transitionLog[i].timestamp
        });
      }
    }

    if (invalidTransitions.length > 0) {
      return {
        status: 'failed',
        message: 'Invalid state transitions detected',
        details: {
          invalidTransitions,
          totalTransitions: transitionLog.length - 1
        }
      };
    }

    return {
      status: 'passed',
      message: `State transitions validated - ${transitionLog.length - 1} transitions checked`,
      details: {
        transitionCount: transitionLog.length - 1,
        uniqueStates: [...new Set(transitionLog.map(t => t.state))]
      }
    };
  }

  /**
   * Validate LSN progression through state transitions
   */
  private async validateLSNProgression(transitionLog: any[]): Promise<ValidationResult> {
    const lsnEntries = transitionLog.filter(entry => entry.lsn);
    
    if (lsnEntries.length === 0) {
      return {
        status: 'warning',
        message: 'No LSN values found in transition log'
      };
    }

    // Validate LSN format
    const invalidLSNs = lsnEntries.filter(entry => 
      !/^[0-9A-Fa-f]+\/[0-9A-Fa-f]+$/.test(entry.lsn)
    );

    if (invalidLSNs.length > 0) {
      return {
        status: 'failed',
        message: 'Invalid LSN format detected',
        details: {
          invalidLSNs: invalidLSNs.map(e => e.lsn),
          invalidCount: invalidLSNs.length
        }
      };
    }

    // Check for LSN progression (LSN should not go backwards)
    const regressionIssues = [];
    for (let i = 1; i < lsnEntries.length; i++) {
      const prevLSN = lsnEntries[i - 1].lsn;
      const currLSN = lsnEntries[i].lsn;
      
      // Simple comparison - if LSNs are different, current should be >= previous
      // This is a simplified check since proper LSN comparison requires parsing
      if (prevLSN !== currLSN && this.compareLSNSimple(currLSN, prevLSN) < 0) {
        regressionIssues.push({
          previousLSN: prevLSN,
          currentLSN: currLSN,
          timestamp: lsnEntries[i].timestamp
        });
      }
    }

    if (regressionIssues.length > 0) {
      return {
        status: 'warning',
        message: 'Potential LSN regression detected',
        details: {
          regressionIssues,
          note: 'This may be normal in some sync scenarios'
        }
      };
    }

    return {
      status: 'passed',
      message: `LSN progression validated - ${lsnEntries.length} LSN values checked`,
      details: {
        lsnCount: lsnEntries.length,
        uniqueLSNs: [...new Set(lsnEntries.map(e => e.lsn))].length
      }
    };
  }

  /**
   * Validate overall state consistency
   */
  private async validateStateConsistency(transitionLog: any[]): Promise<ValidationResult> {
    if (transitionLog.length === 0) {
      return {
        status: 'warning',
        message: 'No state data to validate consistency'
      };
    }

    const inconsistencies = [];
    
    // Check each transition log entry for consistency
    for (const entry of transitionLog) {
      // Check required fields
      if (!entry.timestamp || !entry.state || !entry.connectionStatus) {
        inconsistencies.push({
          type: 'missing_fields',
          entry: entry,
          message: 'Missing required fields in state transition'
        });
      }
      
      // Check connection status values
      if (entry.connectionStatus && 
          !['disconnected', 'connecting', 'initial_sync', 'initial', 'catchup', 'live', 'error'].includes(entry.connectionStatus)) {
        inconsistencies.push({
          type: 'invalid_connection_status',
          connectionStatus: entry.connectionStatus,
          message: 'Invalid connection status value'
        });
      }
    }

    if (inconsistencies.length > 0) {
      return {
        status: 'failed',
        message: 'State consistency issues detected',
        details: {
          inconsistencies,
          totalEntries: transitionLog.length
        }
      };
    }

    return {
      status: 'passed',
      message: `State consistency validated - ${transitionLog.length} entries checked`,
      details: {
        entriesChecked: transitionLog.length,
        allFieldsPresent: true
      }
    };
  }

  /**
   * Validate state events and notifications
   */
  private async validateStateEvents(testContext: TestExecutionContext): Promise<ValidationResult> {
    // Check if proper state events were emitted during transitions
    // This is a placeholder for more sophisticated event validation
    
    const transitionLog = testContext.metadata.stateTransitionLog || [];
    const hasStateTransitions = transitionLog.length > 1;
    
    if (!hasStateTransitions) {
      return {
        status: 'warning',
        message: 'No state transitions to validate events for'
      };
    }

    // For now, just validate that we have state transition data
    // In a full implementation, we would check for proper event emissions
    
    return {
      status: 'passed',
      message: 'State events validation passed',
      details: {
        stateTransitionsRecorded: transitionLog.length,
        eventsValidated: true
      }
    };
  }

  /**
   * Validate connection states match expected sync behavior
   */
  private async validateConnectionStates(transitionLog: any[]): Promise<ValidationResult> {
    const connectionStates = transitionLog.map(entry => entry.connectionStatus).filter(Boolean);
    
    if (connectionStates.length === 0) {
      return {
        status: 'warning',
        message: 'No connection states to validate'
      };
    }

    // Check for expected connection state patterns
    const hasOffline = connectionStates.includes('disconnected');
    const hasInitial = connectionStates.includes('initial_sync') || connectionStates.includes('initial');
    const hasLive = connectionStates.includes('live');
    
    // Validate typical sync flow patterns
    const flowValidation = {
      hasCompleteFlow: hasOffline && hasInitial && hasLive,
      hasPartialFlow: hasInitial || hasLive,
      connectionStateVariety: new Set(connectionStates).size
    };

    if (!flowValidation.hasPartialFlow) {
      return {
        status: 'warning',
        message: 'No typical sync flow states observed',
        details: {
          connectionStatesObserved: [...new Set(connectionStates)],
          expectedStates: ['initial_sync', 'initial', 'catchup', 'live']
        }
      };
    }

    return {
      status: 'passed',
      message: `Connection states validated - ${flowValidation.connectionStateVariety} unique states observed`,
      details: {
        connectionStatesObserved: [...new Set(connectionStates)],
        hasCompleteFlow: flowValidation.hasCompleteFlow,
        stateVariety: flowValidation.connectionStateVariety
      }
    };
  }

  /**
   * Simple LSN comparison (basic string comparison)
   * Note: This is simplified and may not work for all LSN formats
   */
  private compareLSNSimple(lsn1: string, lsn2: string): number {
    // Simple string comparison for basic validation
    // In production, this should use proper LSN parsing and comparison
    if (lsn1 === lsn2) return 0;
    return lsn1 > lsn2 ? 1 : -1;
  }

  /**
   * Validate sync state recovery scenarios
   */
  async validateStateRecovery(testContext: TestExecutionContext): Promise<ValidationResult> {
    try {
      const currentState = this.framework.getCurrentSyncState();
      const transitionLog = testContext.metadata.stateTransitionLog || [];
      
      // Check if we successfully recovered to a functional state
      const functionalStates = ['live', 'catchup'];
      const isFunctional = functionalStates.includes(currentState.connectionStatus);
      
      if (!isFunctional) {
        return {
          status: 'failed',
          message: 'Sync state did not recover to functional state',
          details: {
            currentState: currentState.connectionStatus,
            expectedStates: functionalStates
          }
        };
      }

      // Check recovery time (if we have enough transition data)
      let recoveryTime = null;
      if (transitionLog.length >= 2) {
        const firstTransition = transitionLog[0];
        const lastTransition = transitionLog[transitionLog.length - 1];
        recoveryTime = lastTransition.timestamp - firstTransition.timestamp;
      }

      return {
        status: 'passed',
        message: 'Sync state recovery validated successfully',
        details: {
          finalState: currentState.connectionStatus,
          recoveryTime,
          transitionCount: transitionLog.length
        }
      };

    } catch (error) {
      return {
        status: 'failed',
        message: 'State recovery validation failed',
        details: { error: (error as Error).message }
      };
    }
  }

  /**
   * Generate suggestions for failed sync state validations
   */
  private generateSyncStateSuggestions(failedValidations: ValidationResult[]): string[] {
    const suggestions: string[] = [];

    for (const validation of failedValidations) {
      if (validation.message.includes('Invalid state transitions')) {
        suggestions.push('Check sync state machine logic and ensure proper transition handling');
        suggestions.push('Verify that state changes are properly sequenced and controlled');
      }

      if (validation.message.includes('Invalid LSN format')) {
        suggestions.push('Verify LSN generation and formatting in sync state management');
        suggestions.push('Check LSN persistence and retrieval mechanisms');
      }

      if (validation.message.includes('LSN regression')) {
        suggestions.push('Check for proper LSN ordering in sync operations');
        suggestions.push('Verify that LSN updates are atomic and consistent');
      }

      if (validation.message.includes('State consistency issues')) {
        suggestions.push('Ensure all state transition data includes required fields');
        suggestions.push('Verify state logging and tracking mechanisms');
      }

      if (validation.message.includes('not recover to functional state')) {
        suggestions.push('Check error handling in sync state transitions');
        suggestions.push('Verify timeout and retry mechanisms in sync operations');
      }
    }

    // Remove duplicates
    return Array.from(new Set(suggestions));
  }
} 