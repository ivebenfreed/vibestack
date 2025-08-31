/**
 * IntegrityDecisionEngine - Evaluates decision matrices and executes validation logic
 * 
 * This utility processes the pure decision matrices from IntegrityDecisionMatrix.ts
 * and evaluates them against validation context to determine the appropriate action.
 * 
 * Responsibilities:
 * - Evaluate condition expressions safely
 * - Process decision pipeline in order
 * - Return structured decision results
 * - Handle error cases and fallbacks
 */

import {
  ValidationContext,
  ValidationThresholds,
  DecisionMatrix,
  DecisionCondition,
  DecisionAction,
  DecisionResult,
  ValidationDecision,
  INTEGRITY_DECISION_PIPELINE,
  DEFAULT_VALIDATION_THRESHOLDS
} from './IntegrityDecisionMatrix';
import { syncLogger } from '../utils/SyncLogger';
import { syncLog } from '@/logger';
const log = syncLog('sync/integrity/IntegrityDecisionEngine.ts');

// ============================================================================
// Decision Engine Class
// ============================================================================

export class IntegrityDecisionEngine {
  private thresholds: ValidationThresholds;
  
  constructor(thresholds?: Partial<ValidationThresholds>) {
    this.thresholds = { ...DEFAULT_VALIDATION_THRESHOLDS, ...thresholds };
  }

  /**
   * Main entry point - process the complete decision pipeline
   */
  async processValidationDecision(context: ValidationContext): Promise<ValidationDecision> {
    const startTime = Date.now();
    
    syncLogger.info('validation', 'Starting integrity decision pipeline', {
      reason: context.reason,
      totalRecords: context.totalRecords,
      changesSinceBaseline: context.changesSinceBaseline
    });

    const pipeline: DecisionResult[] = [];
    let finalAction: ValidationDecision['finalAction'] = 'VALIDATION';
    let finalStrategy: string | undefined;
    let finalReason = 'Default validation action';

    try {
      // Process each matrix in the pipeline
      for (const matrix of INTEGRITY_DECISION_PIPELINE) {
        const result = await this.evaluateMatrix(matrix, context);
        pipeline.push(result);

        syncLogger.debug('validation', `Matrix ${matrix.id} result`, {
          conditionMatched: result.conditionMatched,
          actionTaken: result.actionTaken,
          shouldStop: result.shouldStop
        });

        // Update final decision based on result
        if (result.actionTaken !== 'PROCEED') {
          const action = matrix.actions[result.actionTaken];
          finalAction = action.type as ValidationDecision['finalAction'];
          finalStrategy = action.strategy;
          finalReason = action.reason;
        }

        // Stop pipeline if action indicates completion
        if (result.shouldStop) {
          syncLogger.info('validation', `Pipeline stopped at matrix ${matrix.id}`, {
            reason: result.reason
          });
          break;
        }
      }

      const decision: ValidationDecision = {
        finalAction,
        strategy: finalStrategy,
        reason: finalReason,
        pipeline,
        context,
        timestamp: startTime
      };

      const duration = Date.now() - startTime;
      syncLogger.info('validation', 'Decision pipeline completed', {
        finalAction,
        strategy: finalStrategy,
        pipelineSteps: pipeline.length,
        durationMs: duration
      });

      // Log comprehensive decision path for traceability
      this.logDecisionPath(decision, duration);

      return decision;

    } catch (error) {
      syncLogger.error('validation', 'Error in decision pipeline', error);
      
      // Return safe fallback decision
      return {
        finalAction: 'ERROR',
        reason: `Decision pipeline error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        pipeline,
        context,
        timestamp: startTime
      };
    }
  }

  /**
   * Evaluate a single decision matrix against context
   */
  private async evaluateMatrix(matrix: DecisionMatrix, context: ValidationContext): Promise<DecisionResult> {
    log.info(`[DecisionEngine] 🔍 Evaluating matrix: ${matrix.id}`, {
      description: matrix.description,
      conditionCount: matrix.conditions.length
    });
    
    syncLogger.debug('validation', `Evaluating matrix: ${matrix.id}`, {
      description: matrix.description,
      conditionCount: matrix.conditions.length
    });

    try {
      // Sort conditions by priority (highest first)
      const sortedConditions = [...matrix.conditions].sort((a, b) => b.priority - a.priority);

      // Evaluate conditions in priority order
      for (const condition of sortedConditions) {
        log.info(`[DecisionEngine] 🔍 Checking condition: ${condition.id}`);
        const conditionResult = await this.evaluateCondition(condition, context);
        log.info(`[DecisionEngine] 🔍 Condition ${condition.id} result: ${conditionResult}`);
        
        if (conditionResult) {
          const actionId = this.getActionForCondition(condition, matrix);
          const action = matrix.actions[actionId];
          log.info(`[DecisionEngine] ✅ Condition matched! Action: ${actionId}`);
          
          return {
            matrixId: matrix.id,
            conditionMatched: condition.id,
            actionTaken: actionId,
            reason: action.reason,
            strategy: action.strategy,
            nextStep: action.nextStep,
            metadata: action.metadata,
            shouldStop: this.shouldStopPipeline(action)
          };
        }
      }

      // No conditions matched - use default action
      log.info(`[DecisionEngine] ❌ No conditions matched for ${matrix.id}, using default: ${matrix.defaultAction}`);
      const defaultAction = matrix.actions[matrix.defaultAction];
      return {
        matrixId: matrix.id,
        conditionMatched: null,
        actionTaken: matrix.defaultAction,
        reason: defaultAction.reason,
        strategy: defaultAction.strategy,
        nextStep: defaultAction.nextStep,
        metadata: defaultAction.metadata,
        shouldStop: this.shouldStopPipeline(defaultAction)
      };

    } catch (error) {
      syncLogger.error('validation', `Error evaluating matrix ${matrix.id}`, error);
      
      // Return safe fallback
      return {
        matrixId: matrix.id,
        conditionMatched: null,
        actionTaken: 'ERROR',
        reason: `Matrix evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        shouldStop: true
      };
    }
  }

  /**
   * Safely evaluate a condition expression against context
   */
  private async evaluateCondition(condition: DecisionCondition, context: ValidationContext): Promise<boolean> {
    try {
      // Create a safe evaluation environment
      const evaluationContext = {
        context,
        thresholds: this.thresholds
      };

      // Use Function constructor for safe evaluation (better than eval)
      const expr = condition.evaluate;
      const evaluator = new Function('context', 'thresholds', `return ${expr}`);
      
      const result = evaluator(context, this.thresholds);
      
      syncLogger.debug('validation', `Condition ${condition.id} evaluated`, {
        expression: expr,
        result,
        description: condition.description
      });

      return Boolean(result);

    } catch (error) {
      syncLogger.warn('validation', `Failed to evaluate condition ${condition.id}`, {
        expression: condition.evaluate,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Fail safe - assume condition is false
      return false;
    }
  }

  /**
   * Get the action ID for a matched condition (explicit mappings for reliability)
   */
  private getActionForCondition(condition: DecisionCondition, matrix: DecisionMatrix): string {
    // Explicit condition-to-action mappings by matrix
    const conditionToActionMap: Record<string, Record<string, string>> = {
      'pre_validation': {
        'service_unavailable': 'SERVICE_ERROR',
        'empty_database': 'SKIP_EMPTY', 
        'fresh_database': 'SKIP_FRESH'
      },
      'baseline_assessment': {
        'no_baseline': 'FULL_VALIDATION',
        'stale_baseline': 'RESET_STALE',
        'warning_baseline': 'FULL_VALIDATION_STALE'
      },
      'change_volume': {
        'zero_changes': 'SKIP_NO_CHANGES',
        'minimal_changes': 'QUICK_VALIDATION',
        'moderate_changes': 'BASELINE_VALIDATION', 
        'high_changes': 'FULL_VALIDATION_HIGH',
        'excessive_changes': 'RESET_EXCESSIVE'
      },
      'validation_strategy': {
        'server_validation_available': 'SERVER_VALIDATION',
        'server_validation_configured_but_unavailable': 'LOCAL_FALLBACK',
        'local_validation_only': 'LOCAL_VALIDATION'
      }
    };
    
    // Look up explicit mapping
    const matrixMappings = conditionToActionMap[matrix.id];
    if (matrixMappings && matrixMappings[condition.id]) {
      const mappedAction = matrixMappings[condition.id];
      log.info(`[DecisionEngine] 🎯 Mapped ${condition.id} → ${mappedAction}`);
      return mappedAction;
    }
    
    // Fallback to simple uppercase mapping
    const actionId = condition.id.toUpperCase();
    if (matrix.actions[actionId]) {
      log.info(`[DecisionEngine] 📝 Direct mapping ${condition.id} → ${actionId}`);
      return actionId;
    }
    
    // Use default action if no mapping found
    log.info(`[DecisionEngine] ⚠️ No mapping for ${condition.id}, using default: ${matrix.defaultAction}`);
    return matrix.defaultAction;
  }

  /**
   * Determine if pipeline should stop based on action type
   */
  private shouldStopPipeline(action: DecisionAction): boolean {
    // Stop pipeline for terminal actions
    const terminalActions = ['SKIP', 'RESET', 'ERROR'];
    return terminalActions.includes(action.type);
  }

  /**
   * Build validation context from current state
   */
  static async buildValidationContext(params: {
    reason: string;
    clientId: string;
    totalRecords: number;
    isEmpty: boolean;
    hasBaseline: boolean;
    baselineTimestamp: number | null;
    changesSinceBaseline: number;
    changeBreakdown: Record<string, number>;
    hasIntegrityService: boolean;
    hasServerValidation: boolean;
    hasMessageSender: boolean;
    config: {
      enableServerValidation: boolean;
      autoResetOnFailure: boolean;
      validationTimeoutMs: number;
    };
    thresholds?: Partial<ValidationThresholds>;
  }): Promise<ValidationContext> {
    
    const now = Date.now();
    const daysSinceBaseline = params.baselineTimestamp 
      ? Math.floor((now - params.baselineTimestamp) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      // Database state
      totalRecords: params.totalRecords,
      isEmpty: params.isEmpty,
      
      // Baseline state
      hasBaseline: params.hasBaseline,
      baselineTimestamp: params.baselineTimestamp,
      daysSinceBaseline,
      
      // Change tracking
      changesSinceBaseline: params.changesSinceBaseline,
      changeBreakdown: params.changeBreakdown,
      
      // Service availability
      hasIntegrityService: params.hasIntegrityService,
      hasServerValidation: params.hasServerValidation,
      hasMessageSender: params.hasMessageSender,
      
      // Configuration
      thresholds: { ...DEFAULT_VALIDATION_THRESHOLDS, ...params.thresholds },
      config: params.config,
      
      // Context info
      reason: params.reason,
      clientId: params.clientId
    };
  }

  /**
   * Update thresholds configuration
   */
  updateThresholds(newThresholds: Partial<ValidationThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    syncLogger.info('validation', 'Updated validation thresholds', newThresholds);
  }

  /**
   * Get current thresholds
   */
  getThresholds(): ValidationThresholds {
    return { ...this.thresholds };
  }

  /**
   * Log comprehensive decision path for traceability and debugging
   */
  private logDecisionPath(decision: ValidationDecision, duration: number): void {
    const { context, pipeline, finalAction, strategy, reason } = decision;
    
    // Create decision summary
    const summary = {
      // Context overview
      contextSummary: {
        reason: context.reason,
        clientId: context.clientId,
        totalRecords: context.totalRecords,
        isEmpty: context.isEmpty,
        hasBaseline: context.hasBaseline,
        daysSinceBaseline: context.daysSinceBaseline,
        changesSinceBaseline: context.changesSinceBaseline,
        hasServerValidation: context.hasServerValidation
      },
      
      // Decision chain
      decisionChain: pipeline.map(step => ({
        matrix: step.matrixId,
        conditionMatched: step.conditionMatched || 'default',
        action: step.actionTaken,
        reason: step.reason,
        stopped: step.shouldStop
      })),
      
      // Final outcome
      finalOutcome: {
        action: finalAction,
        strategy: strategy || 'none',
        reason: reason,
        duration: `${duration}ms`
      },
      
      // Key decision factors
      keyFactors: this.extractKeyDecisionFactors(context, pipeline)
    };

    // Log as structured data for easy parsing
    syncLogger.info('validation', '📋 INTEGRITY VALIDATION DECISION PATH', summary);
    
    // Also log a human-readable decision narrative
    const narrative = this.buildDecisionNarrative(context, pipeline, finalAction, strategy);
    syncLogger.info('validation', '📖 Decision Narrative', { narrative });
  }

  /**
   * Extract key factors that influenced the decision
   */
  private extractKeyDecisionFactors(context: ValidationContext, pipeline: DecisionResult[]): Record<string, any> {
    const factors: Record<string, any> = {};
    
    // Data state factors
    if (context.isEmpty) {
      factors.databaseState = 'empty';
    } else if (context.totalRecords < 10) {
      factors.databaseState = 'minimal';
    } else {
      factors.databaseState = 'populated';
    }
    
    // Baseline factors
    if (!context.hasBaseline) {
      factors.baselineStatus = 'missing';
    } else if (context.daysSinceBaseline > context.thresholds.maxDaysWithoutBaseline) {
      factors.baselineStatus = 'stale';
    } else if (context.daysSinceBaseline > context.thresholds.staleBaselineWarningDays) {
      factors.baselineStatus = 'aging';
    } else {
      factors.baselineStatus = 'fresh';
    }
    
    // Change volume factors
    if (context.changesSinceBaseline === 0) {
      factors.changeVolume = 'none';
    } else if (context.changesSinceBaseline <= context.thresholds.quickValidationLimit) {
      factors.changeVolume = 'low';
    } else if (context.changesSinceBaseline <= context.thresholds.baselineValidationLimit) {
      factors.changeVolume = 'moderate';
    } else if (context.changesSinceBaseline < context.thresholds.maxRecordsBeforeReset) {
      factors.changeVolume = 'high';
    } else {
      factors.changeVolume = 'excessive';
    }
    
    // Service availability factors
    factors.validationCapability = context.hasServerValidation ? 'server_and_local' : 'local_only';
    
    // Threshold breaches
    const breaches = [];
    if (context.changesSinceBaseline >= context.thresholds.maxRecordsBeforeReset) {
      breaches.push('max_records_exceeded');
    }
    if (context.daysSinceBaseline > context.thresholds.maxDaysWithoutBaseline) {
      breaches.push('baseline_too_old');
    }
    if (breaches.length > 0) {
      factors.thresholdBreaches = breaches;
    }
    
    // Pipeline termination reason
    const terminatingStep = pipeline.find(step => step.shouldStop);
    if (terminatingStep) {
      factors.terminatedBy = {
        matrix: terminatingStep.matrixId,
        condition: terminatingStep.conditionMatched,
        reason: terminatingStep.reason
      };
    }
    
    return factors;
  }

  /**
   * Build a human-readable narrative of the decision process
   */
  private buildDecisionNarrative(
    context: ValidationContext, 
    pipeline: DecisionResult[], 
    finalAction: string, 
    strategy?: string
  ): string {
    const parts: string[] = [];
    
    // Opening context
    parts.push(`Integrity validation requested for "${context.reason}".`);
    
    // Database state
    if (context.isEmpty) {
      parts.push(`Database is empty (${context.totalRecords} records total).`);
    } else {
      parts.push(`Database contains ${context.totalRecords} records.`);
    }
    
    // Baseline assessment
    if (!context.hasBaseline) {
      parts.push('No baseline timestamp available.');
    } else {
      const daysText = context.daysSinceBaseline === 1 ? '1 day' : `${context.daysSinceBaseline} days`;
      parts.push(`Baseline established ${daysText} ago.`);
      
      if (context.changesSinceBaseline === 0) {
        parts.push('No changes detected since baseline.');
      } else {
        parts.push(`${context.changesSinceBaseline} changes detected since baseline.`);
      }
    }
    
    // Pipeline decisions
    const significantSteps = pipeline.filter(step => step.conditionMatched || step.shouldStop);
    for (const step of significantSteps) {
      if (step.conditionMatched) {
        parts.push(`${step.matrixId}: ${step.conditionMatched} condition matched - ${step.reason}`);
      }
      if (step.shouldStop) {
        parts.push(`Pipeline terminated at ${step.matrixId}.`);
        break;
      }
    }
    
    // Final decision
    if (strategy) {
      parts.push(`Final decision: ${finalAction} using ${strategy} strategy.`);
    } else {
      parts.push(`Final decision: ${finalAction}.`);
    }
    
    return parts.join(' ');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const integrityDecisionEngine = new IntegrityDecisionEngine();