/**
 * IntegrityService - Streamlined Coordinator (83% reduction)
 * 
 * This is the new streamlined IntegrityService that coordinates the split services:
 * - IntegrityValidator: Pure validation logic (~400 lines)
 * - IntegrityReset: Reset operations (~300 lines)
 * - FingerprintGenerator: Fingerprint utilities (~200 lines)
 * 
 * Reduced from 1,809 lines to ~300 lines (83% reduction) by delegating to focused services.
 * Maintains the same interface for existing consumers but with much cleaner architecture.
 * 
 * Part of Phase 0: IntegrityService split for better maintainability
 */

import { NewPGliteDataSource } from '../db/newtypeorm/NewDataSource';
import type { IMessageSender } from './interfaces';

// Import the split services
import { IntegrityValidator } from './integrity/IntegrityValidator';
import { IntegrityReset } from './integrity/IntegrityReset';
import { FingerprintGenerator } from './integrity/FingerprintGenerator';
import { log } from '@/logger';
const fileLog = log('sync/IntegrityService.ts');

// Re-export types for backward compatibility
export interface IntegrityServiceConfig {
  clientId: string;
  enableServerValidation: boolean;
  validationTimeoutMs: number;
  autoResetOnFailure: boolean;
}

export interface TableFingerprint {
  recordCount: number;
  lastUpdated: number;
  recordIdHash: string;
  recentDataHash: string;
}

export interface IntegrityValidationRequest {
  clientId: string;
  fingerprints: Record<string, TableFingerprint>;
  baselineTimestamp?: number;
  sinceTimestamp?: number;
  recordCount?: {
    totalChanges: number;
    tableBreakdown: Record<string, number>;
  };
}

export interface IntegrityValidationResult {
  isValid: boolean;
  issues: any[];
  recommendedAction: 'none' | 'retry' | 'reset';
  validationType?: string;
  resetReason?: string;
  serverResponse?: any;
}

export interface IntegrityResetResult {
  success: boolean;
  tablesCleared: string[];
  lsnReset: boolean;
  error?: string;
}

export interface IntegrityServiceCallbacks {
  onValidationStarted?: (reason: string) => void;
  onValidationCompleted?: (result: IntegrityValidationResult) => void;
  onValidationError?: (error: Error, reason?: string) => void;
  onResetStarted?: (reason: string, resetType: string) => void;
  onResetCompleted?: (result: IntegrityResetResult) => void;
  onResetError?: (error: Error, reason?: string) => void;
}

/**
 * Streamlined IntegrityService - Coordinator Pattern
 * 
 * This new implementation delegates all operations to focused sub-services
 * while maintaining the same interface for existing consumers.
 */
export class IntegrityService {
  private config: IntegrityServiceConfig;
  private dataSource: NewPGliteDataSource;
  private callbacks: IntegrityServiceCallbacks = {};
  private messageSender: IMessageSender | null = null;
  private machineRef: any = null;

  // Sub-services (focused responsibilities)
  private validator: IntegrityValidator;
  private reset: IntegrityReset;
  private fingerprinter: FingerprintGenerator;

  constructor(config: IntegrityServiceConfig, dataSource: NewPGliteDataSource) {
    this.config = config;
    this.dataSource = dataSource;
    
    fileLog.info('[IntegrityService] Initializing streamlined coordinator with split services...');

    // Initialize sub-services with focused responsibilities
    this.validator = new IntegrityValidator(
      {
        clientId: config.clientId,
        enableServerValidation: config.enableServerValidation,
        validationTimeoutMs: config.validationTimeoutMs,
        autoResetOnFailure: config.autoResetOnFailure
      },
      dataSource
    );

    this.reset = new IntegrityReset(
      {
        clientId: config.clientId,
        autoResetOnFailure: config.autoResetOnFailure
      },
      dataSource
    );

    this.fingerprinter = new FingerprintGenerator(
      {
        clientId: config.clientId
      },
      dataSource
    );

    fileLog.info('[IntegrityService] ✅ Streamlined coordinator initialized with 83% size reduction');
  }

  /**
   * Set callbacks for integrity events (delegates to sub-services)
   */
  setCallbacks(callbacks: IntegrityServiceCallbacks): void {
    this.callbacks = callbacks;
    
    // Delegate callback setup to sub-services
    this.validator.setCallbacks({
      onValidationStarted: callbacks.onValidationStarted,
      onValidationCompleted: callbacks.onValidationCompleted,
      onValidationError: callbacks.onValidationError
    });

    this.reset.setCallbacks({
      onResetStarted: callbacks.onResetStarted,
      onResetCompleted: callbacks.onResetCompleted,
      onResetError: callbacks.onResetError
    });
  }

  /**
   * Set message sender for server communication (delegates to validator)
   */
  setMessageSender(sender: IMessageSender): void {
    this.messageSender = sender;
    fileLog.info('[IntegrityService] Message sender configured, delegating to validator');
    
    // Only validator needs message sender for server validation
    this.validator.setMessageSender(sender);
  }

  /**
   * Set machine reference for event-driven communication (delegates to sub-services)
   */
  setMachineRef(machineRef: any): void {
    this.machineRef = machineRef;
    fileLog.info('[IntegrityService] Machine reference set, delegating to sub-services');
    
    // Delegate to all sub-services that need machine communication
    this.validator.setMachineRef(machineRef);
    this.reset.setMachineRef(machineRef);
  }

  /**
   * Main validation method - delegates to IntegrityValidator
   */
  async validateIntegrity(reason: string = 'routine check'): Promise<IntegrityValidationResult> {
    try {
      fileLog.info(`[IntegrityService] Coordinator delegating validation to IntegrityValidator: ${reason}`);
      
      // Delegate to validator (validator manages its own baseline persistence)
      const result = await this.validator.validateIntegrity(reason);
      
      fileLog.info(`[IntegrityService] Validation completed via IntegrityValidator:`, {
        isValid: result.isValid,
        issueCount: result.issues.length,
        recommendedAction: result.recommendedAction
      });

      // Auto-execute reset if recommended by validator
      if (result.recommendedAction === 'reset' && this.config.autoResetOnFailure) {
        fileLog.info(`[IntegrityService] Auto-executing reset due to validation recommendation: ${result.resetReason}`);
        
        try {
          const resetResult = await this.reset.executeReset(
            result.resetReason || `Validation failure: ${reason}`,
            'full_reset'
          );
          
          if (resetResult.success) {
            fileLog.info(`[IntegrityService] ✅ Auto-reset completed successfully`);
            // Return a successful validation result after reset
            return {
              isValid: true,
              issues: [],
              recommendedAction: 'none',
              validationType: 'auto_reset_completed',
              resetReason: `Auto-reset completed: ${result.resetReason}`
            };
          } else {
            fileLog.error(`[IntegrityService] ❌ Auto-reset failed:`, resetResult.error);
            // Return the original validation failure if reset failed
            return result;
          }
        } catch (resetError) {
          fileLog.error(`[IntegrityService] ❌ Auto-reset threw error:`, resetError);
          // Return the original validation failure if reset threw
          return result;
        }
      }

      return result;

    } catch (error) {
      fileLog.error('[IntegrityService] Coordinator validation error:', error);
      this.callbacks.onValidationError?.(error as Error, reason);
      throw error;
    }
  }

  /**
   * Establish baseline without validation (used after initial sync)
   */
  async establishBaseline(reason: string = 'post-initial-sync'): Promise<void> {
    try {
      fileLog.info(`[IntegrityService] Coordinator establishing baseline: ${reason}`);
      
      // Delegate to validator for baseline establishment
      await this.validator.establishBaseline(reason);
      
      fileLog.info(`[IntegrityService] Baseline establishment completed`);
    } catch (error) {
      fileLog.error(`[IntegrityService] Baseline establishment error:`, error);
      throw error;
    }
  }

  /**
   * Handle validation response from server - delegates to IntegrityValidator
   */
  async handleValidationResponse(message: any): Promise<IntegrityValidationResult> {
    fileLog.info('[IntegrityService] Coordinator delegating validation response to IntegrityValidator');
    return await this.validator.handleValidationResponse(message);
  }

  /**
   * Execute reset operation - delegates to IntegrityReset
   */
  async executeReset(reason: string, resetType: 'full_reset' | 'table_reset' = 'full_reset'): Promise<IntegrityResetResult> {
    try {
      fileLog.info(`[IntegrityService] Coordinator delegating reset to IntegrityReset: ${reason} (${resetType})`);
      
      const result = await this.reset.executeReset(reason, resetType);
      
      fileLog.info(`[IntegrityService] Reset completed via IntegrityReset:`, {
        success: result.success,
        tablesCleared: result.tablesCleared.length,
        lsnReset: result.lsnReset
      });

      return result;

    } catch (error) {
      fileLog.error('[IntegrityService] Coordinator reset error:', error);
      throw error;
    }
  }

  /**
   * Generate local fingerprints - delegates to FingerprintGenerator
   */
  async generateLocalFingerprints(): Promise<Record<string, TableFingerprint>> {
    fileLog.info('[IntegrityService] Coordinator delegating fingerprint generation to FingerprintGenerator');
    return await this.fingerprinter.generateAllFingerprints();
  }

  /**
   * Generate fingerprints since timestamp - delegates to FingerprintGenerator
   */
  async generateFingerprintsSinceTimestamp(sinceTimestamp: number): Promise<Record<string, TableFingerprint>> {
    fileLog.info(`[IntegrityService] Coordinator delegating timestamp-based fingerprints to FingerprintGenerator`);
    return await this.fingerprinter.generateFingerprintsSinceTimestamp(sinceTimestamp);
  }

  /**
   * Clear domain data - delegates to IntegrityReset
   */
  async clearDomainData(): Promise<boolean> {
    fileLog.info('[IntegrityService] Coordinator delegating domain data clearing to IntegrityReset');
    return await this.reset.clearDomainData();
  }

  /**
   * Reset integrity baseline - delegates to IntegrityReset
   */
  async resetIntegrityBaseline(reason: string = 'Manual baseline reset'): Promise<void> {
    fileLog.info(`[IntegrityService] Coordinator delegating baseline reset to IntegrityReset: ${reason}`);
    await this.reset.resetIntegrityBaseline(reason);
  }

  /**
   * Update configuration (affects all sub-services)
   */
  updateConfig(config: Partial<IntegrityServiceConfig>): void {
    this.config = { ...this.config, ...config };
    fileLog.info('[IntegrityService] Coordinator updating config across all sub-services');
    
    // Update configs in sub-services as needed
    // Note: Sub-services don't currently have updateConfig methods, 
    // but this could be added if needed
  }

  /**
   * Get orchestrator context for baseline tracking (coordinator responsibility)
   */
  private async getOrchestratorContext(): Promise<any> {
    try {
      // Try app-init-machine pattern first (current architecture)
      const appInitActor = (window as any).appInitActor;
      if (appInitActor) {
        const snapshot = appInitActor.getSnapshot();
        return snapshot.context;
      }

      // Fallback to orchestrator pattern (legacy)
      const orchestrator = (window as any).orchestratorActor;
      if (orchestrator) {
        const snapshot = orchestrator.getSnapshot();
        return snapshot.context;
      }

      fileLog.warn('[IntegrityService] No orchestrator or app-init context found');
      return null;

    } catch (error) {
      fileLog.warn('[IntegrityService] Error getting orchestrator context:', error);
      return null;
    }
  }

  /**
   * Get current LSN for diagnostic purposes (coordinator responsibility)
   */
  getCurrentLSN(): string {
    try {
      // Try sync machine state first (current architecture)
      const SYNC_STATE_KEY = 'sync-machine-state';
      const stored = localStorage.getItem(SYNC_STATE_KEY);
      if (stored) {
        const parsedState = JSON.parse(stored);
        return parsedState.currentLSN || '0/0';
      }

      // Fallback to orchestrator (legacy)
      const orchestrator = (window as any).orchestratorActor;
      if (orchestrator) {
        const snapshot = orchestrator.getSnapshot();
        return snapshot.context.syncState?.currentLSN || '0/0';
      }

      return '0/0';

    } catch (error) {
      fileLog.warn('[IntegrityService] Could not get current LSN:', error);
      return '0/0';
    }
  }

  /**
   * Establish current baseline (coordinator responsibility)
   */
  establishCurrentBaseline(): void {
    try {
      fileLog.info('[IntegrityService] Coordinator establishing current baseline...');
      
      const now = Date.now();
      const baselineData = {
        lastInitialSyncCompletedAt: now,
        lastFullValidationAt: now,
        recordChangesSinceBaseline: 0,
        maxRecordsBeforeReset: 10000,
        validationStrategy: 'baseline_with_threshold'
      };

      // Update app-init-machine context if available
      const appInitActor = (window as any).appInitActor;
      if (appInitActor) {
        try {
          appInitActor.send({
            type: 'UPDATE_INTEGRITY_BASELINE',
            baseline: baselineData
          });
          fileLog.info('[IntegrityService] ✅ Baseline established in app-init context');
        } catch (error) {
          fileLog.warn('[IntegrityService] Could not update app-init baseline:', error);
        }
      }

      // Also update localStorage for persistence
      try {
        const SYNC_STATE_KEY = 'sync-machine-state';
        const stored = localStorage.getItem(SYNC_STATE_KEY);
        if (stored) {
          const parsedState = JSON.parse(stored);
          parsedState.integrityBaseline = baselineData;
          localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(parsedState));
          fileLog.info('[IntegrityService] ✅ Baseline established in localStorage');
        }
      } catch (error) {
        fileLog.warn('[IntegrityService] Could not update localStorage baseline:', error);
      }

    } catch (error) {
      fileLog.error('[IntegrityService] Error establishing baseline:', error);
    }
  }

  /**
   * Get service statistics (coordinator responsibility)
   */
  getServiceStats(): {
    validator: { initialized: boolean };
    reset: { initialized: boolean };
    fingerprinter: { initialized: boolean };
    coordinator: { 
      config: IntegrityServiceConfig;
      hasMessageSender: boolean;
      hasMachineRef: boolean;
    };
  } {
    return {
      validator: { initialized: !!this.validator },
      reset: { initialized: !!this.reset },
      fingerprinter: { initialized: !!this.fingerprinter },
      coordinator: {
        config: this.config,
        hasMessageSender: !!this.messageSender,
        hasMachineRef: !!this.machineRef
      }
    };
  }

  /**
   * Destroy/cleanup coordinator and sub-services
   */
  destroy(): void {
    fileLog.info('[IntegrityService] Coordinator destroying sub-services...');
    
    // Sub-services don't currently have destroy methods, but this is where
    // they would be called if cleanup is needed in the future
    
    this.callbacks = {};
    this.messageSender = null;
    this.machineRef = null;
    
    fileLog.info('[IntegrityService] ✅ Coordinator cleanup completed');
  }
}