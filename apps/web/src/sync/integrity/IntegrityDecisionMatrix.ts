/**
 * IntegrityDecisionMatrix - Pure Decision Logic for Integrity Validation
 * 
 * This file contains ONLY decision matrices and configuration - no implementation.
 * Provides structured, extensible decision trees for integrity validation scenarios.
 * 
 * Design principles:
 * - Pure data structures - no business logic
 * - Clear condition/action mappings
 * - Extensible for future scenarios
 * - Easy to test and reason about
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ValidationContext {
  // Database state
  totalRecords: number;
  isEmpty: boolean;
  
  // Baseline state
  hasBaseline: boolean;
  baselineTimestamp: number | null;
  daysSinceBaseline: number;
  
  // Change tracking
  changesSinceBaseline: number;
  changeBreakdown: Record<string, number>;
  
  // Service availability
  hasIntegrityService: boolean;
  hasServerValidation: boolean;
  hasMessageSender: boolean;
  
  // Configuration
  thresholds: ValidationThresholds;
  config: {
    enableServerValidation: boolean;
    autoResetOnFailure: boolean;
    validationTimeoutMs: number;
  };
  
  // Context info
  reason: string;
  clientId: string;
}

export interface ValidationThresholds {
  // Record count thresholds
  maxRecordsBeforeReset: number;
  quickValidationLimit: number;
  baselineValidationLimit: number;
  
  // Time thresholds  
  maxDaysWithoutBaseline: number;
  staleBaselineWarningDays: number;
  
  // Performance thresholds
  maxValidationTimeMs: number;
  maxFingerprintSizeMB: number;
}

export interface DecisionCondition {
  id: string;
  description: string;
  evaluate: string; // JS expression to evaluate against context
  priority: number; // Higher number = higher priority
}

export interface DecisionAction {
  id: string;
  type: 'VALIDATION' | 'RESET' | 'SKIP' | 'ERROR' | 'RETRY';
  strategy?: string;
  reason: string;
  nextStep?: string;
  metadata?: Record<string, any>;
}

export interface DecisionMatrix {
  id: string;
  description: string;
  conditions: DecisionCondition[];
  actions: Record<string, DecisionAction>;
  defaultAction: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_VALIDATION_THRESHOLDS: ValidationThresholds = {
  // Record count thresholds
  maxRecordsBeforeReset: 10000,
  quickValidationLimit: 100,
  baselineValidationLimit: 1000,
  
  // Time thresholds (in days)
  maxDaysWithoutBaseline: 7,
  staleBaselineWarningDays: 30,
  
  // Performance thresholds
  maxValidationTimeMs: 30000, // 30 seconds
  maxFingerprintSizeMB: 10
};

// ============================================================================
// Pre-Validation Decision Matrix
// ============================================================================

export const PRE_VALIDATION_MATRIX: DecisionMatrix = {
  id: 'pre_validation',
  description: 'Initial checks before attempting validation',
  
  conditions: [
    {
      id: 'service_unavailable',
      description: 'Integrity service is not available',
      evaluate: '!context.hasIntegrityService',
      priority: 100
    },
    {
      id: 'empty_database',
      description: 'Database is completely empty',
      evaluate: 'context.isEmpty && context.totalRecords === 0',
      priority: 90
    },
    {
      id: 'fresh_database',
      description: 'Very few records, likely just initialized',
      evaluate: 'context.totalRecords > 0 && context.totalRecords < 10',
      priority: 85
    }
  ],
  
  actions: {
    'SERVICE_ERROR': {
      id: 'SERVICE_ERROR',
      type: 'ERROR',
      reason: 'IntegrityService is not available - cannot perform validation',
      metadata: { recoverable: false }
    },
    'SKIP_EMPTY': {
      id: 'SKIP_EMPTY',
      type: 'SKIP',
      reason: 'Database is empty - skipping validation to prevent false positives',
      nextStep: 'establish_baseline'
    },
    'SKIP_FRESH': {
      id: 'SKIP_FRESH',
      type: 'SKIP', 
      reason: 'Database has minimal records - skipping validation for fresh database',
      nextStep: 'establish_baseline'
    },
    'PROCEED': {
      id: 'PROCEED',
      type: 'VALIDATION',
      strategy: 'continue_to_baseline_check',
      reason: 'Pre-validation checks passed - proceeding to baseline assessment'
    }
  },
  
  defaultAction: 'PROCEED'
};

// ============================================================================
// Baseline Assessment Matrix
// ============================================================================

export const BASELINE_ASSESSMENT_MATRIX: DecisionMatrix = {
  id: 'baseline_assessment',
  description: 'Evaluate baseline status and determine validation approach',
  
  conditions: [
    {
      id: 'no_baseline',
      description: 'No baseline timestamp available',
      evaluate: '!context.hasBaseline || context.baselineTimestamp === null',
      priority: 100
    },
    {
      id: 'stale_baseline',
      description: 'Baseline is very old and may be unreliable',
      evaluate: 'context.hasBaseline && context.daysSinceBaseline > context.thresholds.maxDaysWithoutBaseline',
      priority: 90
    },
    {
      id: 'warning_baseline',
      description: 'Baseline is getting old but still usable',
      evaluate: 'context.hasBaseline && context.daysSinceBaseline > context.thresholds.staleBaselineWarningDays',
      priority: 80
    }
  ],
  
  actions: {
    'FULL_VALIDATION': {
      id: 'FULL_VALIDATION',
      type: 'VALIDATION',
      strategy: 'full_validation',
      reason: 'No valid baseline available - performing full validation to establish baseline',
      nextStep: 'establish_baseline'
    },
    'RESET_STALE': {
      id: 'RESET_STALE',
      type: 'RESET',
      reason: 'Baseline is too old and unreliable - reset required',
      metadata: { resetType: 'full_reset', cause: 'stale_baseline' }
    },
    'FULL_VALIDATION_STALE': {
      id: 'FULL_VALIDATION_STALE',
      type: 'VALIDATION',
      strategy: 'full_validation_with_warning',
      reason: 'Baseline is old but proceeding with full validation',
      nextStep: 'establish_baseline'
    },
    'PROCEED_TO_CHANGES': {
      id: 'PROCEED_TO_CHANGES',
      type: 'VALIDATION',
      strategy: 'assess_changes',
      reason: 'Valid baseline found - assessing changes since baseline'
    }
  },
  
  defaultAction: 'PROCEED_TO_CHANGES'
};

// ============================================================================
// Change Volume Assessment Matrix
// ============================================================================

export const CHANGE_VOLUME_MATRIX: DecisionMatrix = {
  id: 'change_volume',
  description: 'Assess volume of changes since baseline and determine validation strategy',
  
  conditions: [
    {
      id: 'zero_changes',
      description: 'No changes since baseline',
      evaluate: 'context.changesSinceBaseline === 0',
      priority: 100
    },
    {
      id: 'minimal_changes',
      description: 'Very few changes - quick validation appropriate',
      evaluate: 'context.changesSinceBaseline > 0 && context.changesSinceBaseline <= context.thresholds.quickValidationLimit',
      priority: 90
    },
    {
      id: 'moderate_changes',
      description: 'Moderate changes - baseline validation appropriate',
      evaluate: 'context.changesSinceBaseline > context.thresholds.quickValidationLimit && context.changesSinceBaseline <= context.thresholds.baselineValidationLimit',
      priority: 80
    },
    {
      id: 'high_changes',
      description: 'High volume of changes - may exceed baseline validation capacity',
      evaluate: 'context.changesSinceBaseline > context.thresholds.baselineValidationLimit && context.changesSinceBaseline < context.thresholds.maxRecordsBeforeReset',
      priority: 70
    },
    {
      id: 'excessive_changes',
      description: 'Excessive changes - reset threshold exceeded',
      evaluate: 'context.changesSinceBaseline >= context.thresholds.maxRecordsBeforeReset',
      priority: 60
    }
  ],
  
  actions: {
    'SKIP_NO_CHANGES': {
      id: 'SKIP_NO_CHANGES',
      type: 'SKIP',
      reason: 'No changes since baseline - validation unnecessary',
      metadata: { updateLastValidation: true }
    },
    'QUICK_VALIDATION': {
      id: 'QUICK_VALIDATION',
      type: 'VALIDATION',
      strategy: 'quick_validation',
      reason: 'Minimal changes detected - performing quick validation'
    },
    'BASELINE_VALIDATION': {
      id: 'BASELINE_VALIDATION',
      type: 'VALIDATION',
      strategy: 'baseline_validation',
      reason: 'Moderate changes detected - performing baseline validation'
    },
    'FULL_VALIDATION_HIGH': {
      id: 'FULL_VALIDATION_HIGH',
      type: 'VALIDATION',
      strategy: 'full_validation',
      reason: 'High volume of changes - performing full validation for safety'
    },
    'RESET_EXCESSIVE': {
      id: 'RESET_EXCESSIVE',
      type: 'RESET',
      reason: 'Excessive changes exceed threshold - reset required for data integrity',
      metadata: { resetType: 'full_reset', cause: 'change_volume_exceeded' }
    }
  },
  
  defaultAction: 'BASELINE_VALIDATION'
};

// ============================================================================
// Validation Strategy Selection Matrix
// ============================================================================

export const VALIDATION_STRATEGY_MATRIX: DecisionMatrix = {
  id: 'validation_strategy',
  description: 'Select specific validation method based on context and capabilities',
  
  conditions: [
    {
      id: 'server_validation_available',
      description: 'Server validation is enabled and message sender is available',
      evaluate: 'context.config.enableServerValidation && context.hasServerValidation && context.hasMessageSender',
      priority: 100
    },
    {
      id: 'server_validation_configured_but_unavailable',
      description: 'Server validation is configured but service/sender unavailable',
      evaluate: 'context.config.enableServerValidation && (!context.hasServerValidation || !context.hasMessageSender)',
      priority: 90
    },
    {
      id: 'local_validation_only',
      description: 'Only local validation is available',
      evaluate: '!context.config.enableServerValidation',
      priority: 80
    }
  ],
  
  actions: {
    'SERVER_VALIDATION': {
      id: 'SERVER_VALIDATION',
      type: 'VALIDATION',
      strategy: 'server_validation',
      reason: 'Server validation available - using authoritative server-side validation'
    },
    'LOCAL_FALLBACK': {
      id: 'LOCAL_FALLBACK',
      type: 'VALIDATION',
      strategy: 'local_validation',
      reason: 'Server validation unavailable - falling back to local validation'
    },
    'LOCAL_VALIDATION': {
      id: 'LOCAL_VALIDATION',
      type: 'VALIDATION',
      strategy: 'local_validation',
      reason: 'Local validation configured - performing client-side validation'
    },
    'VALIDATION_ERROR': {
      id: 'VALIDATION_ERROR',
      type: 'ERROR',
      reason: 'No validation method available - cannot proceed',
      metadata: { recoverable: true, suggestedAction: 'retry_with_local' }
    }
  },
  
  defaultAction: 'LOCAL_FALLBACK'
};

// ============================================================================
// Rollback Action Matrix
// ============================================================================

export const ROLLBACK_ACTION_MATRIX: DecisionMatrix = {
  id: 'rollback_action',
  description: 'Handle server validation responses with rollback recommendations',
  
  conditions: [
    {
      id: 'validation_recommends_reset',
      description: 'Server validation recommends full reset',
      evaluate: 'context.validationResult?.recommendedAction === "reset"',
      priority: 100
    },
    {
      id: 'validation_recommends_catchup_with_rollback',
      description: 'Server validation recommends catchup with LSN rollback',
      evaluate: 'context.validationResult?.recommendedAction === "catchup" && context.validationResult?.rollbackToLSN',
      priority: 90
    },
    {
      id: 'validation_recommends_catchup_no_rollback',
      description: 'Server validation recommends catchup without rollback',
      evaluate: 'context.validationResult?.recommendedAction === "catchup" && !context.validationResult?.rollbackToLSN',
      priority: 80
    },
    {
      id: 'validation_successful',
      description: 'Validation passed successfully',
      evaluate: 'context.validationResult?.isValid === true',
      priority: 70
    }
  ],
  
  actions: {
    'EXECUTE_RESET': {
      id: 'EXECUTE_RESET',
      type: 'RESET',
      reason: 'Server validation recommends full reset - executing reset',
      metadata: { resetType: 'full_reset', cause: 'server_validation_recommendation' }
    },
    'EXECUTE_ROLLBACK_CATCHUP': {
      id: 'EXECUTE_ROLLBACK_CATCHUP',
      type: 'VALIDATION',
      strategy: 'rollback_catchup',
      reason: 'Server recommends rollback and catchup - executing partial rollback',
      metadata: { 
        requiresRollback: true,
        syncType: 'catchup_with_rollback'
      }
    },
    'EXECUTE_STANDARD_CATCHUP': {
      id: 'EXECUTE_STANDARD_CATCHUP',
      type: 'VALIDATION',
      strategy: 'standard_catchup',
      reason: 'Server recommends catchup - executing standard catchup sync',
      metadata: { 
        syncType: 'standard_catchup'
      }
    },
    'VALIDATION_PASSED': {
      id: 'VALIDATION_PASSED',
      type: 'SKIP',
      reason: 'Validation passed - no action required',
      metadata: { validationSuccessful: true }
    }
  },
  
  defaultAction: 'VALIDATION_PASSED'
};

// ============================================================================
// Complete Decision Pipeline
// ============================================================================

export const INTEGRITY_DECISION_PIPELINE = [
  PRE_VALIDATION_MATRIX,
  BASELINE_ASSESSMENT_MATRIX,
  CHANGE_VOLUME_MATRIX,
  VALIDATION_STRATEGY_MATRIX
] as const;

// Extended pipeline for handling validation responses
export const INTEGRITY_RESPONSE_PIPELINE = [
  ROLLBACK_ACTION_MATRIX
] as const;

// ============================================================================
// Decision Results
// ============================================================================

export interface DecisionResult {
  matrixId: string;
  conditionMatched: string | null;
  actionTaken: string;
  reason: string;
  strategy?: string;
  nextStep?: string;
  metadata?: Record<string, any>;
  shouldStop: boolean; // If true, stop pipeline processing
}

export interface ValidationDecision {
  finalAction: 'VALIDATION' | 'RESET' | 'SKIP' | 'ERROR' | 'RETRY';
  strategy?: string;
  reason: string;
  pipeline: DecisionResult[];
  context: ValidationContext;
  timestamp: number;
}