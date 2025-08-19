/**
 * DexieIntegrityService - Dexie-based Coordinator
 * 
 * This is the Dexie-based IntegrityService that coordinates the split services:
 * - DexieIntegrityValidator: Pure validation logic with Dexie
 * - DexieIntegrityReset: Reset operations with Dexie
 * 
 * Maintains the same interface for existing consumers but uses Dexie instead of PGLite.
 */

import type { IMessageSender } from './interfaces';

// Import the Dexie-based split services
import { DexieIntegrityValidator } from './integrity/DexieIntegrityValidator';
import { DexieIntegrityReset } from './integrity/DexieIntegrityReset';

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
  recommendedAction: 'none' | 'retry' | 'reset' | 'catchup';
  validationType?: string;
  resetReason?: string;
  serverResponse?: any;
  rollbackToLSN?: string;
  rollbackReason?: string;
}

export interface IntegrityResetResult {
  success: boolean;
  tablesCleared: string[];
  lsnReset: boolean;
  error?: string;
  resetType?: 'full_reset' | 'table_reset';
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
 * DexieIntegrityService - Coordinator Pattern with Dexie
 * 
 * This implementation delegates all operations to Dexie-based sub-services
 * while maintaining the same interface for existing consumers.
 */
export class DexieIntegrityService {
  private config: IntegrityServiceConfig;
  private callbacks: IntegrityServiceCallbacks = {};
  private messageSender: IMessageSender | null = null;
  private machineRef: any = null;

  // Sub-services (focused responsibilities)
  private validator: DexieIntegrityValidator;
  private reset: DexieIntegrityReset;

  constructor(config: IntegrityServiceConfig) {
    this.config = config;
    
    console.log('[DexieIntegrityService] Initializing Dexie-based coordinator...');

    // Initialize Dexie-based sub-services
    this.validator = new DexieIntegrityValidator({
      clientId: config.clientId,
      enableServerValidation: config.enableServerValidation,
      validationTimeoutMs: config.validationTimeoutMs,
      autoResetOnFailure: config.autoResetOnFailure
    });

    this.reset = new DexieIntegrityReset({
      clientId: config.clientId,
      autoResetOnFailure: config.autoResetOnFailure
    });

    console.log('[DexieIntegrityService] ✅ Dexie-based coordinator initialized');
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
    this.validator.setMessageSender(sender);
    console.log('[DexieIntegrityService] Message sender configured');
  }

  /**
   * Set machine reference for state machine integration
   */
  setMachineRef(machineRef: any): void {
    this.machineRef = machineRef;
    this.validator.setMachineRef(machineRef);
    this.reset.setMachineRef(machineRef);
    console.log('[DexieIntegrityService] Machine reference configured');
  }

  /**
   * Validate integrity (delegates to validator)
   */
  async validateIntegrity(reason: string = 'routine check'): Promise<IntegrityValidationResult> {
    console.log(`[DexieIntegrityService] Delegating validation to DexieIntegrityValidator: ${reason}`);
    
    try {
      const result = await this.validator.validateIntegrity(reason);
      
      // Check if reset is recommended and auto-reset is enabled
      if (result.recommendedAction === 'reset' && this.config.autoResetOnFailure) {
        console.log('[DexieIntegrityService] Auto-reset triggered by validation failure');
        await this.executeReset(result.resetReason || 'auto_reset_after_validation', 'table_reset');
      }
      
      return result;
    } catch (error) {
      console.error('[DexieIntegrityService] Validation error:', error);
      throw error;
    }
  }

  /**
   * Execute reset (delegates to reset service)
   */
  async executeReset(reason: string, resetType: 'full_reset' | 'table_reset' = 'full_reset'): Promise<IntegrityResetResult> {
    console.log(`[DexieIntegrityService] Delegating reset to DexieIntegrityReset: ${reason} (${resetType})`);
    
    try {
      const result = await this.reset.executeReset(reason, resetType);
      
      // If reset successful, clear baseline for re-establishment
      if (result.success) {
        await this.validator.establishBaseline('baseline_after_reset');
      }
      
      return result;
    } catch (error) {
      console.error('[DexieIntegrityService] Reset error:', error);
      throw error;
    }
  }

  /**
   * Establish baseline without validation (delegates to validator)
   */
  async establishBaseline(reason: string): Promise<void> {
    console.log(`[DexieIntegrityService] Delegating baseline establishment to DexieIntegrityValidator: ${reason}`);
    await this.validator.establishBaseline(reason);
  }

  /**
   * Handle validation response from server (delegates to validator)
   */
  async handleValidationResponse(message: any): Promise<IntegrityValidationResult> {
    console.log('[DexieIntegrityService] Delegating validation response to DexieIntegrityValidator');
    return await this.validator.handleValidationResponse(message);
  }

  /**
   * Generate local fingerprints (delegates to validator)
   */
  async generateLocalFingerprints(): Promise<Record<string, TableFingerprint>> {
    console.log('[DexieIntegrityService] Delegating fingerprint generation to DexieIntegrityValidator');
    return await this.validator.generateLocalFingerprints();
  }

  /**
   * Destroy service and cleanup
   */
  destroy(): void {
    console.log('[DexieIntegrityService] Destroying integrity service...');
    // Clean up any resources if needed
  }
}