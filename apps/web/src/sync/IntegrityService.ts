/**
 * IntegrityService - Service-based integrity validation and reset
 * 
 * Part of the new service-based sync architecture.
 * Provides integrity validation, reset operations, and fingerprint generation
 * in a stateless service pattern that can be coordinated by XState machines.
 */

import { NewPGliteDataSource } from '../db/newtypeorm/NewDataSource';
import type { IMessageSender } from './interfaces';
import { getGlobalDataSourceSync, waitForGlobalDataSource } from '../db/global-datasource';
import { 
  User, 
  Project, 
  Task, 
  Comment, 
  CLIENT_DOMAIN_TABLES,
} from '@repo/dataforge/client-entities';
import { clearDomainDataOnly } from '../db/storage';
import { liveChangesManager } from '../lib/live-changes-manager';
import { MoreThan } from 'typeorm';
import { getGlobalServices } from '../state-machines/machines/sync-machine-v2';

// Map table names to entity classes
const TABLE_TO_ENTITY_MAP: Record<string, any> = {
  'users': User,
  'projects': Project,
  'tasks': Task,
  'comments': Comment,
};

// Get clean table names (without quotes) from CLIENT_DOMAIN_TABLES
const CRITICAL_TABLES = CLIENT_DOMAIN_TABLES.map(table => table.replace(/"/g, ''));

export interface IntegrityServiceConfig {
  clientId: string;
  enableServerValidation: boolean;
  validationTimeoutMs: number;
  autoResetOnFailure: boolean;
}

export interface TableFingerprint {
  recordCount: number;
  lastUpdated: number;
  recordIdHash: string; // Hash of all record IDs sorted
  recentDataHash: string; // Hash of most recent 10 records
}

export interface IntegrityValidationRequest {
  clientId: string;
  currentLSN: string;
  tableFingerprints: Record<string, TableFingerprint>;
  timestamp: number;
}

export interface IntegrityValidationResult {
  /** 
   * Whether NO integrity issues were found. 
   * NOTE: This means "no issues detected", NOT "validation completed successfully".
   * The validation process itself can complete successfully while finding issues.
   */
  isValid: boolean;
  
  /** Array of integrity issues found during validation */
  issues: any[];
  
  /** 
   * Recommended action based on validation results:
   * - 'none': No action needed (only when isValid=true AND issues.length=0)
   * - 'reset': Serious issues found, full reset recommended
   * - 'retry': Temporary issues, retry validation recommended
   */
  recommendedAction: 'none' | 'reset' | 'retry';
  
  fingerprints?: Record<string, any>;
  serverResponse?: any;
  validationType?: string;
  resetReason?: string;
  recordsValidated?: number;
  baselineTimestamp?: number;
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
  onValidationError?: (error: Error, context?: string) => void;
  onResetStarted?: (reason: string, resetType: 'full_reset' | 'table_reset') => void;
  onResetProgress?: (progress: number) => void;
  onResetCompleted?: (result: IntegrityResetResult) => void;
  onResetError?: (error: Error, context?: string) => void;
}

/**
 * Service-based integrity management
 */
export class IntegrityService {
  private config: IntegrityServiceConfig;
  private dataSource: NewPGliteDataSource;
  private callbacks: IntegrityServiceCallbacks = {};
  private messageSender: IMessageSender | null = null;
  
  // Machine reference for event-driven communication
  private machineRef: any = null;
  
  // Validation state
  private pendingValidations = new Map<string, {
    resolve: (result: IntegrityValidationResult) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  constructor(config: IntegrityServiceConfig, dataSource: NewPGliteDataSource) {
    this.config = config;
    this.dataSource = dataSource;
    
    console.log('[IntegrityService] Initialized with config:', config);
  }

  /**
   * Set callbacks for integrity events
   */
  setCallbacks(callbacks: IntegrityServiceCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Set message sender for server communication
   */
  setMessageSender(sender: IMessageSender): void {
    this.messageSender = sender;
    console.log('[IntegrityService] Message sender configured');
  }

  /**
   * Set machine reference for event-driven communication
   */
  setMachineRef(machineRef: any): void {
    this.machineRef = machineRef;
    console.log('[IntegrityService] Machine reference set for event-driven communication');
  }

  /**
   * Handle validation response from server
   */
  async handleValidationResponse(message: any): Promise<IntegrityValidationResult> {
    console.log('[IntegrityService] Received validation response from server:', message);
    
    const result: IntegrityValidationResult = {
      isValid: message.isValid,
      issues: message.issues || [],
      recommendedAction: this.mapRecommendedAction(message.recommendedAction),
      serverResponse: message
    };
    
    // ✅ ENHANCED: Log validation result analysis
    console.log('[IntegrityService] 🔍 Validation result analysis:', {
      isValid: result.isValid,
      issueCount: result.issues.length,
      recommendedAction: result.recommendedAction,
      shouldProceedToLiveSync: result.isValid && result.issues.length === 0 && result.recommendedAction === 'none',
      shouldTriggerReset: !result.isValid && (result.recommendedAction === 'reset' || result.recommendedAction === 'none'),
      shouldRetry: !result.isValid && result.recommendedAction === 'retry'
    });
    
    if (!result.isValid) {
      console.warn('[IntegrityService] ⚠️ INTEGRITY ISSUES DETECTED:');
      console.warn(`[IntegrityService] - Issues found: ${result.issues.length}`);
      console.warn(`[IntegrityService] - Recommended action: ${result.recommendedAction}`);
      
      if (result.issues.length > 0) {
        result.issues.forEach((issue: any, index: number) => {
          console.warn(`[IntegrityService] Issue ${index + 1}:`, issue);
        });
      }
      
      // ✅ CLARIFY: What will happen next based on recommended action
      if (result.recommendedAction === 'reset') {
        console.warn('[IntegrityService] 🚨 SYNC MACHINE WILL TRIGGER RESET due to recommendedAction=reset');
      } else if (result.recommendedAction === 'retry') {
        console.warn('[IntegrityService] 🔄 SYNC MACHINE WILL RETRY VALIDATION due to recommendedAction=retry');
      } else if (result.recommendedAction === 'none') {
        console.error('[IntegrityService] 🚨 CRITICAL: SYNC MACHINE WILL FORCE RESET due to issues with no clear resolution (recommendedAction=none)');
      }
    } else {
      console.log('[IntegrityService] ✅ No integrity issues detected - sync machine will proceed to live sync');
    }
    
    // Resolve any pending validation promises (resolve all pending since we only expect one at a time)
    for (const [key, pending] of this.pendingValidations) {
      console.log(`[IntegrityService] Resolving pending validation: ${key}`);
      clearTimeout(pending.timeout);
      this.pendingValidations.delete(key);
      pending.resolve(result);
    }
    
    // Trigger callback
    this.callbacks.onValidationCompleted?.(result);
    
    // ✅ NEW: Send event to machine for ongoing validations
    this.sendEventToMachine({ type: 'INTEGRITY_VALIDATION_COMPLETED', result });
    
    console.log('[IntegrityService] Validation response processed and sent to sync machine');
    return result;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<IntegrityServiceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Validate integrity - can be called from XState actors
   * Now uses combined baseline timestamp + record count threshold approach
   */
  async validateIntegrity(reason: string = 'routine check'): Promise<IntegrityValidationResult> {
    try {
      console.log(`[IntegrityService] Starting integrity validation: ${reason}`);
      
      this.callbacks.onValidationStarted?.(reason);

      // ✅ NEW: Detect empty database conditions that cause false positives
      const emptyDatabaseCheck = await this.checkForEmptyDatabase();
      if (emptyDatabaseCheck.isEmpty) {
        console.log(`[IntegrityService] 🔄 EMPTY DATABASE DETECTED - SKIPPING VALIDATION`);
        console.log(`[IntegrityService] 🔄 Reason: ${emptyDatabaseCheck.reason}`);
        console.log(`[IntegrityService] 🔄 Total records across all tables: ${emptyDatabaseCheck.totalRecords}`);
        console.log(`[IntegrityService] 🔄 This prevents false positives when database is empty after reset`);
        
        return {
          isValid: true,
          issues: [],
          recommendedAction: 'none',
          validationType: 'skipped_empty_database',
          resetReason: `Skipped: ${emptyDatabaseCheck.reason}`
        };
      }

      // Get orchestrator context for baseline tracking
      const context = await this.getOrchestratorContext();
      const baseline = context?.integrityBaseline;

      console.log(`[IntegrityService] 🔍 DEBUG: Context lookup result:`, {
        contextFound: !!context,
        baselineFound: !!baseline,
        lastInitialSyncCompletedAt: baseline?.lastInitialSyncCompletedAt,
        lastInitialSyncTime: baseline?.lastInitialSyncCompletedAt ? new Date(baseline.lastInitialSyncCompletedAt).toISOString() : 'NULL',
        maxRecordsBeforeReset: baseline?.maxRecordsBeforeReset,
        recordChangesSinceBaseline: baseline?.recordChangesSinceBaseline
      });

      // 🔍 CRITICAL DEBUG: Check exactly what baseline value we have
      const hasValidBaseline = baseline?.lastInitialSyncCompletedAt !== null && baseline?.lastInitialSyncCompletedAt !== undefined;
      console.log(`[IntegrityService] 🔍 BASELINE CHECK:`, {
        hasValidBaseline,
        baselineValue: baseline?.lastInitialSyncCompletedAt,
        baselineType: typeof baseline?.lastInitialSyncCompletedAt,
        isNull: baseline?.lastInitialSyncCompletedAt === null,
        isUndefined: baseline?.lastInitialSyncCompletedAt === undefined,
        shouldDoFullValidation: !hasValidBaseline
      });

      if (!hasValidBaseline) {
        console.log('[IntegrityService] No baseline timestamp - performing full validation');
        console.log(`[IntegrityService] 🔍 DEBUG: Why no baseline?`, {
          noContext: !context,
          noBaseline: !baseline,
          noTimestamp: baseline && !baseline.lastInitialSyncCompletedAt,
          baselineValue: baseline?.lastInitialSyncCompletedAt
        });
        
        // 🔥 NEW: For existing systems that haven't established a baseline yet,
        // establish one now based on the current state (this validation becomes the baseline)
        const currentLSN = this.getCurrentLSN();
        if (currentLSN !== '0/0') {
          console.log(`[IntegrityService] 🆕 System with LSN ${currentLSN} has no baseline - establishing baseline now`);
          this.establishCurrentBaseline();
          
          // Proceed with full validation for this first time, but future validations will use baseline
          console.log('[IntegrityService] Performing one-time full validation to establish baseline');
        }
        
        return await this.performFullValidation(`${reason} (establish baseline)`);
      }

      // Step 1: Count records changed since baseline timestamp
      const recordCount = await this.countRecordsSinceBaseline(baseline.lastInitialSyncCompletedAt);
      
      // Step 2: Check against threshold
      if (recordCount.totalChanges > baseline.maxRecordsBeforeReset) {
        console.log(`[IntegrityService] 📊 Threshold exceeded: ${recordCount.totalChanges} records (max: ${baseline.maxRecordsBeforeReset})`);
        console.log(`[IntegrityService] Baseline was: ${new Date(baseline.lastInitialSyncCompletedAt).toISOString()}`);
        
        return this.triggerThresholdReset(recordCount, baseline);
      }

      // Step 3: Within threshold - validate using server validation or local validation
      console.log(`[IntegrityService] ✅ Within threshold: ${recordCount.totalChanges} records, proceeding with validation`);

      if (this.config.enableServerValidation && this.messageSender) {
        // Server-based validation with baseline
        console.log('[IntegrityService] Performing server-based baseline validation');
        const serverResult = await this.requestBaselineServerValidation(baseline.lastInitialSyncCompletedAt, recordCount);
        
        console.log(`[IntegrityService] Baseline validation completed:`, { 
          isValid: serverResult.isValid, 
          issueCount: serverResult.issues.length,
          recommendedAction: serverResult.recommendedAction
        });
        
        if (!serverResult.isValid && serverResult.issues.length > 0) {
          console.warn(`[IntegrityService] 🚨 INTEGRITY ISSUES DETECTED (${serverResult.issues.length}):`);
          serverResult.issues.forEach((issue: any, index: number) => {
            console.warn(`[IntegrityService] Issue ${index + 1}:`, issue);
          });
        }

        this.callbacks.onValidationCompleted?.(serverResult);
        return serverResult;
      } else {
        // Local validation
        console.log('[IntegrityService] Performing local integrity validation');
        return await this.performLocalValidation();
      }

    } catch (error) {
      console.error('[IntegrityService] Integrity validation failed:', error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      
      this.callbacks.onValidationError?.(errorObj, reason);
      
      return {
        isValid: false,
        issues: [{ type: 'error', message: errorObj.message }],
        recommendedAction: 'retry'
      };
    }
  }

  /**
   * Count records modified since baseline timestamp
   */
  private async countRecordsSinceBaseline(baselineTimestamp: number): Promise<{
    totalChanges: number;
    tableBreakdown: Record<string, number>;
    baselineAge: string;
  }> {
    
    let totalChanges = 0;
    const tableBreakdown: Record<string, number> = {};
    const baselineAge = this.formatAge(Date.now() - baselineTimestamp);
    
    console.log(`[IntegrityService] Counting changes since ${new Date(baselineTimestamp).toISOString()} (${baselineAge} ago)`);
    
    // Fast count queries using baseline timestamp
    for (const tableName of CRITICAL_TABLES) {
      try {
        const repository = this.dataSource.getRepository(TABLE_TO_ENTITY_MAP[tableName]);
        
        const count = await repository.count({
          where: {
            updatedAt: MoreThan(new Date(baselineTimestamp))
          }
        });
        
        tableBreakdown[tableName] = count;
        totalChanges += count;
        
        if (count > 0) {
          console.log(`[IntegrityService] ${tableName}: ${count} changes since baseline`);
        }
        
      } catch (error) {
        console.warn(`[IntegrityService] Could not count ${tableName}:`, error);
        tableBreakdown[tableName] = 0;
      }
    }
    
    console.log(`[IntegrityService] Total changes since baseline: ${totalChanges}`);
    
    return {
      totalChanges,
      tableBreakdown,
      baselineAge
    };
  }

  /**
   * Trigger reset when threshold exceeded
   */
  private triggerThresholdReset(
    recordCount: any, 
    baseline: any
  ): IntegrityValidationResult {
    
    const resetReason = `Record threshold exceeded: ${recordCount.totalChanges} changes since ${new Date(baseline.lastInitialSyncCompletedAt).toISOString()} (max: ${baseline.maxRecordsBeforeReset})`;
    
    // Notify orchestrator to trigger reset
    this.notifyOrchestratorResetRequired(resetReason, 'record_threshold');
    
    return {
      isValid: false,
      issues: [{
        type: 'record_threshold_exceeded',
        message: resetReason,
        severity: 'medium',
        details: {
          totalChanges: recordCount.totalChanges,
          threshold: baseline.maxRecordsBeforeReset,
          baselineTimestamp: baseline.lastInitialSyncCompletedAt,
          baselineAge: recordCount.baselineAge,
          tableBreakdown: recordCount.tableBreakdown
        }
      }],
      recommendedAction: 'reset',
      validationType: 'baseline_threshold_exceeded',
      resetReason
    };
  }

  /**
   * Request server validation for baseline changes
   */
  private async requestBaselineServerValidation(
    baselineTimestamp: number,
    recordCount: any
  ): Promise<IntegrityValidationResult> {
    if (!this.messageSender) {
      throw new Error('Message sender not configured');
    }

    return new Promise(async (resolve, reject) => {
      const validationKey = `baseline_${this.config.clientId}_${Date.now()}`;
      
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingValidations.delete(validationKey);
        console.warn('[IntegrityService] Baseline validation request timed out');
        resolve({
          isValid: true, // Default to valid on timeout
          issues: [],
          recommendedAction: 'none'
        });
      }, this.config.validationTimeoutMs || 10000);

      // Store pending validation
      this.pendingValidations.set(validationKey, { resolve, reject, timeout });

      try {
        // Generate fingerprints for all tables
        const fingerprints = await this.generateFingerprintsSinceTimestamp(baselineTimestamp);

        // Check if any tables have actual modifications
        const hasModifications = Object.values(fingerprints).some(fp => fp.recordCount > 0);
        if (!hasModifications) {
          console.log('[IntegrityService] No modifications detected since baseline - returning early without server validation');
          clearTimeout(timeout);
          this.pendingValidations.delete(validationKey);
          resolve({
            isValid: true,
            issues: [],
            recommendedAction: 'none',
            validationType: 'baseline_incremental_clean',
            recordsValidated: 0,
            baselineTimestamp,
            fingerprints // Include empty fingerprints for consistency
          });
          return;
        }

        // 🔍 DETAILED LOGGING: Show exactly what we're sending to server
        console.log('[IntegrityService] 📊 DETAILED FINGERPRINT ANALYSIS:');
        console.log(`[IntegrityService] Baseline timestamp: ${new Date(baselineTimestamp).toISOString()}`);
        console.log(`[IntegrityService] Record changes since baseline: ${recordCount.totalChanges}`);
        
        for (const [tableName, fp] of Object.entries(fingerprints)) {
          console.log(`[IntegrityService]   ${tableName}:`, {
            recordCount: fp.recordCount,
            recordIdHash: fp.recordIdHash,
            recentDataHash: fp.recentDataHash,
            lastUpdated: fp.lastUpdated ? new Date(fp.lastUpdated).toISOString() : 'none'
          });
        }

        // Send baseline validation request to server
        const validationRequest = {
          clientId: this.config.clientId,
          currentLSN: this.getCurrentLSN(),
          tableFingerprints: fingerprints,
          validationType: 'baseline_incremental',
          baselineTimestamp,
          recordCount: recordCount.totalChanges,
          timestamp: Date.now()
        };

        console.log('[IntegrityService] 📤 SENDING TO SERVER:', JSON.stringify(validationRequest, null, 2));

        this.messageSender!.send({
          type: 'clt_integrity_validation',
          ...validationRequest
        });

        console.log('[IntegrityService] Baseline validation request sent to server');

      } catch (error) {
        clearTimeout(timeout);
        this.pendingValidations.delete(validationKey);
        reject(error);
      }
    });
  }

  /**
   * Generate fingerprints for all tables
   */
  private async generateFingerprintsSinceTimestamp(sinceTimestamp: number): Promise<Record<string, TableFingerprint>> {
    console.log('[IntegrityService] Generating fingerprints for records modified since baseline');
    const fingerprints: Record<string, TableFingerprint> = {};

    try {
      const dataSource = await waitForGlobalDataSource();

      for (const tableName of CRITICAL_TABLES) {
        const modifiedFingerprint = await this.generateModifiedTableFingerprint(tableName, sinceTimestamp, dataSource);
        
        // 🔥 FIXED: Include ALL tables in baseline validation, not just modified ones
        // This prevents "missing fingerprint" errors that cause integrity check loops
        fingerprints[tableName] = modifiedFingerprint;
        
        // 🔍 DEBUG: Show what we found for each table
        console.log(`[IntegrityService] 🔍 Table ${tableName} since ${new Date(sinceTimestamp).toISOString()}:`, {
          recordCount: modifiedFingerprint.recordCount,
          recordIdHash: modifiedFingerprint.recordIdHash,
          lastUpdated: modifiedFingerprint.lastUpdated ? new Date(modifiedFingerprint.lastUpdated).toISOString() : 'none'
        });
      }

      const modifiedTablesCount = Object.values(fingerprints).filter(fp => fp.recordCount > 0).length;
      console.log('[IntegrityService] Generated fingerprints for', Object.keys(fingerprints).length, 'total tables,', modifiedTablesCount, 'with modifications');
      return fingerprints;

    } catch (error) {
      console.error('[IntegrityService] Error generating baseline fingerprints:', error);
      throw new Error(`Failed to generate baseline fingerprints: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate fingerprint for records modified since timestamp
   */
  private async generateModifiedTableFingerprint(
    tableName: string, 
    sinceTimestamp: number, 
    dataSource: any
  ): Promise<TableFingerprint> {
    try {
      const entityClass = TABLE_TO_ENTITY_MAP[tableName];
      if (!entityClass) {
        console.warn(`[IntegrityService] Unknown table: ${tableName}`);
        return {
          recordCount: 0,
          lastUpdated: 0,
          recordIdHash: '',
          recentDataHash: ''
        };
      }

      const repository = dataSource.getRepository(entityClass);
      
      // Get count of modified records
      const recordCount = await repository.count({
        where: {
          updatedAt: MoreThan(new Date(sinceTimestamp))
        }
      });

      if (recordCount === 0) {
        return {
          recordCount: 0,
          lastUpdated: 0,
          recordIdHash: '',
          recentDataHash: ''
        };
      }

      // Get modified record IDs for hash calculation
      const modifiedRecords = await repository.find({
        where: {
          updatedAt: MoreThan(new Date(sinceTimestamp))
        },
        select: ['id'],
        order: { id: 'ASC' }
      });
      
      const recordIds = modifiedRecords.map((record: any) => record.id);
      const recordIdHash = this.hashArray(recordIds);

      // Get recent modified records for data integrity hash
      const recentRecords = await repository.find({
        where: {
          updatedAt: MoreThan(new Date(sinceTimestamp))
        },
        select: ['id', 'updatedAt', 'createdAt'],
        order: { updatedAt: 'DESC' },
        take: 10
      });

      const recentData = recentRecords.map((record: any) => 
        `${record.id}:${record.updatedAt?.getTime() || record.createdAt?.getTime() || 0}`
      );
      const recentDataHash = this.hashArray(recentData);

      // Get last updated timestamp
      const lastUpdated = recentRecords[0] ? 
        (recentRecords[0].updatedAt?.getTime() || recentRecords[0].createdAt?.getTime() || 0) : 0;

      return {
        recordCount,
        lastUpdated,
        recordIdHash,
        recentDataHash
      };

    } catch (error) {
      console.error(`[IntegrityService] Error generating modified fingerprint for ${tableName}:`, error);
      
      return {
        recordCount: 0,
        lastUpdated: 0,
        recordIdHash: '',
        recentDataHash: ''
      };
    }
  }

  /**
   * Get orchestrator context for baseline tracking
   */
  private async getOrchestratorContext(): Promise<any> {
    try {
      // Single source of truth: orchestrator persistent context
      if (typeof window !== 'undefined' && (window as any).orchestratorActor) {
        const orchestratorActor = (window as any).orchestratorActor;
        const orchestratorSnapshot = orchestratorActor.getSnapshot();
        if (orchestratorSnapshot?.context) {
          console.log('[IntegrityService] 🎯 Found orchestrator context with baseline:', {
            lastInitialSyncCompletedAt: orchestratorSnapshot.context.integrityBaseline?.lastInitialSyncCompletedAt,
            maxRecordsBeforeReset: orchestratorSnapshot.context.integrityBaseline?.maxRecordsBeforeReset,
            recordChangesSinceBaseline: orchestratorSnapshot.context.integrityBaseline?.recordChangesSinceBaseline
          });
          return orchestratorSnapshot.context;
        }
      }
      
      console.warn('[IntegrityService] ⚠️ No orchestrator context found');
      return null;
    } catch (error) {
      console.error('[IntegrityService] ❌ Error accessing orchestrator context:', error);
      return null;
    }
  }

  /**
   * Notify orchestrator of reset requirement
   */
  private notifyOrchestratorResetRequired(reason: string, triggerType: string): void {
    try {
      const orchestrator = (window as any).orchestratorActor;
      if (orchestrator) {
        orchestrator.send({
          type: 'INTEGRITY_RESET_REQUIRED',
          reason,
          triggerType,
          resetType: 'full_reset'
        });
      }
    } catch (error) {
      console.warn('[IntegrityService] Could not notify orchestrator:', error);
    }
  }

  /**
   * Perform full validation (fallback)
   */
  private async performFullValidation(reason: string): Promise<IntegrityValidationResult> {
    let result: IntegrityValidationResult;
    
    if (this.config.enableServerValidation && this.messageSender) {
      result = await this.requestServerValidation();
    } else {
      result = await this.performLocalValidation();
    }
    
    // 🔥 FIXED: Only advance baseline if validation passed AND no issues were found
    const currentLSN = this.getCurrentLSN();
    const shouldAdvanceBaseline = result.isValid && 
                                 result.issues.length === 0 && 
                                 result.recommendedAction === 'none' &&
                                 currentLSN !== '0/0' && 
                                 reason.includes('baseline');
                                 
    if (shouldAdvanceBaseline) {
      console.log(`[IntegrityService] ✅ Full validation passed with zero issues - establishing new baseline`);
      await this.establishCurrentBaseline();
      
      // Add a small delay to allow baseline to be set before validation completes
      await new Promise(resolve => setTimeout(resolve, 50));
    } else if (result.isValid && result.issues.length > 0) {
      console.log(`[IntegrityService] ⚠️ Validation marked valid but found ${result.issues.length} issues - NOT advancing baseline`);
    } else if (result.recommendedAction !== 'none') {
      console.log(`[IntegrityService] ⚠️ Validation recommends '${result.recommendedAction}' - NOT advancing baseline`);
    }
    
    return result;
  }

  /**
   * Request server validation (original method for full validation)
   */
  private async requestServerValidation(): Promise<IntegrityValidationResult> {
    if (!this.messageSender) {
      throw new Error('Message sender not configured');
    }

    return new Promise(async (resolve, reject) => {
      const validationKey = `${this.config.clientId}_${Date.now()}`;
      
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingValidations.delete(validationKey);
        console.warn('[IntegrityService] Validation request timed out');
        resolve({
          isValid: true, // Default to valid on timeout
          issues: [],
          recommendedAction: 'none'
        });
      }, this.config.validationTimeoutMs || 10000);

      // Store pending validation
      this.pendingValidations.set(validationKey, { resolve, reject, timeout });

      try {
        // Generate local fingerprints (full validation)
        const tableFingerprints = await this.generateLocalFingerprints();

        // Send validation request to server
        const validationRequest: IntegrityValidationRequest = {
          clientId: this.config.clientId,
          currentLSN: this.getCurrentLSN(),
          tableFingerprints,
          timestamp: Date.now()
        };

                 this.messageSender!.send({
           type: 'clt_integrity_validation',
           ...validationRequest
         });

        console.log('[IntegrityService] Integrity validation request sent to server');

      } catch (error) {
        clearTimeout(timeout);
        this.pendingValidations.delete(validationKey);
        reject(error);
      }
    });
  }

  /**
   * Format age duration for logging
   */
  private formatAge(ageMs: number): string {
    const hours = Math.floor(ageMs / (1000 * 60 * 60));
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }

  /**
   * Execute integrity reset - can be called from XState actors
   */
  async executeReset(reason: string, resetType: 'full_reset' | 'table_reset' = 'full_reset'): Promise<IntegrityResetResult> {
    try {
      console.log(`[IntegrityService] Starting integrity reset: ${reason} (${resetType})`);
      
      this.callbacks.onResetStarted?.(reason, resetType);

      // ✅ CRITICAL: Disconnect BEFORE reset to avoid sending messages over stale connections
      console.log('[IntegrityService] 🔌 Phase 1: Disconnecting services before reset...');
      await this.disconnectAllServices();

      // ✅ MISSING: Support different reset types
      let result: IntegrityResetResult;
      if (resetType === 'full_reset') {
        result = await this.executeFullReset(reason);
      } else if (resetType === 'table_reset') {
        result = await this.executeTableReset(reason);
      } else {
        throw new Error(`Unknown reset type: ${resetType}`);
      }

      console.log(`[IntegrityService] Integrity reset completed:`, result);

      this.callbacks.onResetCompleted?.(result);
      return result;

    } catch (error) {
      console.error('[IntegrityService] Integrity reset failed:', error);
      const errorObj = error instanceof Error ? error : new Error(String(error));
      
      this.callbacks.onResetError?.(errorObj, reason);
      
      return {
        success: false,
        tablesCleared: [],
        lsnReset: false,
        error: errorObj.message
      };
    }
  }

  /**
   * Execute full reset - enhanced with connection management and verification
   */
  private async executeFullReset(reason: string): Promise<IntegrityResetResult> {
    console.warn('[IntegrityService] Executing full reset:', reason);

    const result: IntegrityResetResult = {
      success: false,
      tablesCleared: [],
      lsnReset: false
    };

    try {
      // 1. Reset LSN to trigger full sync (disconnection already happened in executeReset)
      this.resetLSN();
      result.lsnReset = true;
      console.log('[IntegrityService] ✅ LSN reset to 0/0');

      // 2. Pause live changes processing
      try {
        const liveChangesStats = liveChangesManager.getStats();
        if (liveChangesStats.status === 'active') {
          console.log('[IntegrityService] ⏸️ Pausing live changes processing during reset...');
          liveChangesManager.pause();
        } else {
          console.log(`[IntegrityService] Live changes manager not active (${liveChangesStats.status}) - skipping pause`);
        }
      } catch (liveChangesError) {
        console.warn('[IntegrityService] Could not pause live changes manager:', liveChangesError);
      }

      // 3. Clear domain data using robust storage functions
      console.log('[IntegrityService] 🗑️ Using storage.ts functions for reliable table clearing...');
      const clearSuccess = await clearDomainDataOnly();
      
      if (clearSuccess) {
        result.tablesCleared = [...CRITICAL_TABLES];
        console.log(`[IntegrityService] ✅ Successfully cleared tables using storage functions:`, result.tablesCleared);
        
        // ✅ MISSING: Verify tables are actually empty
        console.log('[IntegrityService] 🔍 Verifying tables are empty...');
        await this.verifyTablesEmpty();
      } else {
        console.error('[IntegrityService] ❌ Storage function failed to clear tables');
      }

      result.success = clearSuccess;
      
      console.log('[IntegrityService] ✅ Full reset completed successfully', result);
      
      // ✅ FIXED: Reset baseline after successful reset to prevent validation loops
      if (result.success) {
        await this.resetIntegrityBaseline('Post-reset baseline reset');
        console.log('[IntegrityService] 🔄 Baseline reset - next validation will start fresh');
        
        await this.reEnableAutoReconnect();
        console.log('[IntegrityService] 🔄 Auto-reconnect re-enabled - sync machines will handle reconnection automatically');
      }

      return result;

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      console.error('[IntegrityService] ❌ Full reset failed:', error);
      return result;
    } finally {
      // Always resume live changes processing, even if clearing failed
      try {
        const liveChangesStats = liveChangesManager.getStats();
        if (liveChangesStats.status === 'active' && liveChangesStats.isPaused) {
          console.log('[IntegrityService] ▶️ Resuming live changes processing...');
          liveChangesManager.resume();
        } else {
          console.log(`[IntegrityService] Live changes manager not in paused state (status: ${liveChangesStats.status}, paused: ${liveChangesStats.isPaused}) - skipping resume`);
        }
      } catch (liveChangesError) {
        console.warn('[IntegrityService] Could not resume live changes manager:', liveChangesError);
      }
    }
  }

  /**
   * Perform comprehensive local validation without requiring message sender
   */
  private async performLocalValidation(): Promise<IntegrityValidationResult> {
    const issues: any[] = [];

    try {
      // Check data source availability
      if (!this.dataSource || !this.dataSource.isInitialized) {
        issues.push({ type: 'local', message: 'Data source not available or not initialized' });
      }

      // Check if essential tables exist and are accessible
      if (this.dataSource && this.dataSource.isInitialized) {
        for (const tableName of CRITICAL_TABLES) {
          try {
            const entityClass = TABLE_TO_ENTITY_MAP[tableName];
            if (!entityClass) continue;
            
            const repository = this.dataSource.getRepository(entityClass);
            const count = await repository.count();
            
            if (count < 0) {
              issues.push({ type: 'local', message: `Invalid record count for table ${tableName}: ${count}` });
            }
            
            console.log(`[IntegrityService] Table ${tableName}: ${count} records`);
          } catch (error) {
            issues.push({ 
              type: 'local', 
              message: `Cannot access table ${tableName}: ${error instanceof Error ? error.message : String(error)}` 
            });
          }
        }
      }

      const isValid = issues.length === 0;
      const recommendedAction = isValid ? 'none' : (issues.length > 2 ? 'reset' : 'retry');

      return {
        isValid,
        issues,
        recommendedAction
      };

    } catch (error) {
      const errorIssue = { 
        type: 'local', 
        message: `Local validation failed: ${error instanceof Error ? error.message : String(error)}` 
      };
      
      return {
        isValid: false,
        issues: [errorIssue],
        recommendedAction: 'retry'
      };
    }
  }

  /**
   * Generate local fingerprints for validation
   */
  async generateLocalFingerprints(): Promise<Record<string, TableFingerprint>> {
    console.log('[IntegrityService] Generating local fingerprints for integrity check');
    const fingerprints: Record<string, TableFingerprint> = {};

    try {
      const dataSource = await waitForGlobalDataSource();

      for (const tableName of CRITICAL_TABLES) {
        fingerprints[tableName] = await this.generateTableFingerprint(tableName, dataSource);
      }

      console.log('[IntegrityService] Generated fingerprints for', Object.keys(fingerprints).length, 'tables');
      return fingerprints;

    } catch (error) {
      console.error('[IntegrityService] Error generating local fingerprints:', error);
      throw new Error(`Failed to generate local fingerprints: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate fingerprint for a specific table
   */
  private async generateTableFingerprint(tableName: string, dataSource: any): Promise<TableFingerprint> {
    try {
      const entityClass = TABLE_TO_ENTITY_MAP[tableName];
      if (!entityClass) {
        console.warn(`[IntegrityService] Unknown table: ${tableName}`);
        return {
          recordCount: 0,
          lastUpdated: 0,
          recordIdHash: '',
          recentDataHash: ''
        };
      }

      const repository = dataSource.getRepository(entityClass);
      
      // Get record count
      const recordCount = await repository.count();

      // Get all record IDs for hash calculation
      const allRecords = await repository.find({
        select: ['id'],
        order: { id: 'ASC' }
      });
      
      const recordIds = allRecords.map((record: any) => record.id);
      const recordIdHash = this.hashArray(recordIds);

      // Get recent records for data integrity hash
      const recentRecords = await repository.find({
        select: ['id', 'updatedAt', 'createdAt'],
        order: { updatedAt: 'DESC' },
        take: 10
      });

      const recentData = recentRecords.map((record: any) => 
        `${record.id}:${record.updatedAt?.getTime() || record.createdAt?.getTime() || 0}`
      );
      const recentDataHash = this.hashArray(recentData);

      // Get last updated timestamp
      const lastUpdated = recentRecords[0] ? 
        (recentRecords[0].updatedAt?.getTime() || recentRecords[0].createdAt?.getTime() || 0) : 0;

      return {
        recordCount,
        lastUpdated,
        recordIdHash,
        recentDataHash
      };

    } catch (error) {
      console.error(`[IntegrityService] Error generating fingerprint for ${tableName}:`, error);
      
      return {
        recordCount: 0,
        lastUpdated: 0,
        recordIdHash: '',
        recentDataHash: ''
      };
    }
  }

  /**
   * Create hash of array elements
   */
  private hashArray(items: any[]): string {
    const content = items.join('|');
    
    // Simple hash function for client-side use
    let hash = 0;
    if (content.length === 0) return '';
    
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16);
  }

  /**
   * Get current LSN from orchestrator
   */
  private getCurrentLSN(): string {
    try {
      const orchestrator = (window as any).orchestratorActor;
      if (orchestrator) {
        const snapshot = orchestrator.getSnapshot();
        return snapshot.context.syncState?.currentLSN || '0/0';
      }
    } catch (error) {
      console.warn('[IntegrityService] Could not get LSN from orchestrator:', error);
    }
    return '0/0';
  }

  /**
   * Reset LSN via orchestrator
   */
  private resetLSN(): void {
    try {
      const orchestrator = (window as any).orchestratorActor;
      if (orchestrator) {
        orchestrator.send({ type: 'LSN_UPDATE', lsn: '0/0' });
      }
    } catch (error) {
      console.warn('[IntegrityService] Could not reset LSN via orchestrator:', error);
    }
  }

  /**
   * Check if integrity service is ready
   */
  isReady(): boolean {
    return this.dataSource.isInitialized && !!this.messageSender;
  }

  /**
   * Map server recommended action to our action types
   */
  private mapRecommendedAction(serverAction: string): 'none' | 'reset' | 'retry' {
    switch (serverAction) {
      case 'reset':
      case 'full_reset':
        return 'reset';
      case 'retry':
        return 'retry';
      default:
        return 'none';
    }
  }

  /**
   * Cleanup service resources
   */
  destroy(): void {
    console.log('[IntegrityService] Destroying service');
    
    // Clear any pending validations
    for (const [key, pending] of this.pendingValidations) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Service destroyed'));
    }
    this.pendingValidations.clear();
    
    this.callbacks = {};
    this.messageSender = null;
    this.machineRef = null;  // ✅ Clear machine reference
  }

  /**
   * Establish baseline for existing systems that haven't gone through new baseline process
   */
  private async establishCurrentBaseline(): Promise<void> {
    try {
      console.log('[IntegrityService] 🆕 Establishing baseline for existing system');
      
      // Send baseline directly to orchestrator (single source of truth)
      const now = Date.now();
      await this.sendBaselineToOrchestrator({
        lastInitialSyncCompletedAt: now,
        lastFullValidationAt: now,
        recordChangesSinceBaseline: 0,
        tableChangeCounts: {},
        lastCountUpdateAt: now
      });
      
      console.log('[IntegrityService] ✅ Baseline established in orchestrator');
    } catch (error) {
      console.error('[IntegrityService] ❌ Failed to establish baseline:', error);
    }
  }

  /**
   * Send baseline update to orchestrator for persistence
   */
  private async sendBaselineToOrchestrator(baseline: {
    lastInitialSyncCompletedAt: number | null;
    lastFullValidationAt: number | null;
    recordChangesSinceBaseline: number;
    tableChangeCounts: Record<string, number>;
    lastCountUpdateAt: number | null;
  }): Promise<void> {
    try {
      if (typeof window !== 'undefined' && (window as any).orchestratorActor) {
        const orchestratorActor = (window as any).orchestratorActor;
        orchestratorActor.send({
          type: 'INTEGRITY_BASELINE_UPDATE',
          baseline
        });
        console.log('[IntegrityService] 📡 Sent baseline update to orchestrator for persistence:', baseline);
        
        // 🔥 CRITICAL FIX: Force localStorage persistence immediately
        // The orchestrator state is persisted to localStorage but there might be a delay.
        // For baseline resets, we need immediate persistence to prevent old baseline being restored on reload.
        await new Promise(resolve => setTimeout(resolve, 50)); // Allow time for orchestrator to process
        
        // Force persistence by triggering a state snapshot (the subscription handles localStorage saving)
        const currentSnapshot = orchestratorActor.getSnapshot();
        console.log('[IntegrityService] 🔄 Forced orchestrator state persistence for baseline update');
        
      } else {
        console.warn('[IntegrityService] ⚠️ Orchestrator actor not available for baseline persistence');
      }
    } catch (error) {
      console.error('[IntegrityService] ❌ Failed to send baseline to orchestrator:', error);
    }
  }

  /**
   * Update baseline record count when changes are processed
   */
  async updateBaselineRecordCount(changeCount: number): Promise<void> {
    try {
      const context = await this.getOrchestratorContext();
      const baseline = context?.integrityBaseline;
      
      if (baseline && changeCount > 0) {
        await this.sendBaselineToOrchestrator({
          ...baseline,
          recordChangesSinceBaseline: baseline.recordChangesSinceBaseline + changeCount,
          lastCountUpdateAt: Date.now()
        });
        console.log(`[IntegrityService] 📊 Updated baseline record count: +${changeCount} (total: ${baseline.recordChangesSinceBaseline + changeCount})`);
      }
    } catch (error) {
      console.error('[IntegrityService] ❌ Failed to update baseline record count:', error);
    }
  }

  /**
   * ✅ NEW: Reset integrity baseline to force full validation
   */
  async resetIntegrityBaseline(reason: string = 'Manual baseline reset'): Promise<void> {
    try {
      console.log(`[IntegrityService] 🔄 Resetting integrity baseline: ${reason}`);
      
      const resetBaseline = {
        lastInitialSyncCompletedAt: null, // Force full validation
        lastFullValidationAt: null,
        recordChangesSinceBaseline: 0,
        tableChangeCounts: {},
        lastCountUpdateAt: Date.now()
      };
      
      console.log(`[IntegrityService] 🔄 SETTING BASELINE TO:`, resetBaseline);
      
      // Reset baseline to force full validation next time
      await this.sendBaselineToOrchestrator(resetBaseline);
      
      console.log('[IntegrityService] ✅ Integrity baseline reset - next validation will be full comparison');
      
      // 🔍 VERIFY: Check if the baseline was actually set
      setTimeout(async () => {
        const context = await this.getOrchestratorContext();
        console.log(`[IntegrityService] 🔍 VERIFICATION: Baseline after reset:`, {
          lastInitialSyncCompletedAt: context?.integrityBaseline?.lastInitialSyncCompletedAt,
          isNull: context?.integrityBaseline?.lastInitialSyncCompletedAt === null
        });
      }, 100);
      
    } catch (error) {
      console.error('[IntegrityService] ❌ Failed to reset integrity baseline:', error);
      throw error;
    }
  }

  // ✅ NEW: Simple event-driven validation method
  startValidation(params: { reason: string; clientId: string; currentLSN: string }): void {
    console.log(`[IntegrityService] 🚀 Starting validation: ${params.reason}`);
    
    // ✅ MISSING: Send validation started event
    this.sendEventToMachine({ 
      type: 'INTEGRITY_VALIDATION_STARTED', 
      reason: params.reason 
    });
    
    // Run validation asynchronously and send events back to machine
    this.validateIntegrity(params.reason)
      .then((result) => {
        console.log(`[IntegrityService] ✅ Validation completed, sending INTEGRITY_VALIDATION_COMPLETED`);
        this.sendEventToMachine({ type: 'INTEGRITY_VALIDATION_COMPLETED', result });
      })
      .catch((error) => {
        console.error(`[IntegrityService] ❌ Validation failed, sending INTEGRITY_VALIDATION_FAILED:`, error);
        this.sendEventToMachine({ type: 'INTEGRITY_VALIDATION_FAILED', error });
      });
  }

  // ✅ NEW: Simple event-driven reset method
  startReset(params: { reason: string; resetType: 'full_reset' | 'table_reset'; clientId: string }): void {
    console.log(`[IntegrityService] 🚀 Starting reset: ${params.reason} (${params.resetType})`);
    
    // ✅ MISSING: Send reset started event
    this.sendEventToMachine({ 
      type: 'INTEGRITY_RESET_STARTED', 
      reason: params.reason,
      resetType: params.resetType
    });
    
    // Run reset asynchronously and send events back to machine
    this.executeReset(params.reason, params.resetType)
      .then((result) => {
        console.log(`[IntegrityService] ✅ Reset completed, sending INTEGRITY_RESET_COMPLETED`);
        this.sendEventToMachine({ type: 'INTEGRITY_RESET_COMPLETED', result });
      })
      .catch((error) => {
        console.error(`[IntegrityService] ❌ Reset failed, sending INTEGRITY_RESET_ERROR:`, error);
        this.sendEventToMachine({ type: 'INTEGRITY_RESET_ERROR', error });
      });
  }

  // ✅ NEW: Send events back to machine
  private sendEventToMachine(event: any): void {
    if (this.machineRef && typeof this.machineRef.send === 'function') {
      try {
        this.machineRef.send(event);
        console.log(`[IntegrityService] 📤 Sent event to machine: ${event.type}`);
      } catch (error) {
        console.error(`[IntegrityService] ❌ Failed to send event to machine:`, error);
      }
    } else {
      console.warn(`[IntegrityService] ⚠️ No machine reference available, cannot send event: ${event.type}`);
    }
  }

  /**
   * ✅ MISSING: Execute table-specific reset
   */
  private async executeTableReset(reason: string): Promise<IntegrityResetResult> {
    console.log('[IntegrityService] Executing table reset:', reason);

    const result: IntegrityResetResult = {
      success: false,
      tablesCleared: [],
      lsnReset: false
    };

    try {
      console.log('[IntegrityService] Table-specific reset using storage functions...');
      
      // For partial table resets, we'll use clearDomainDataOnly since it's more reliable
      // than trying to selectively clear tables with foreign key constraints
      console.warn('[IntegrityService] Partial table reset not supported with storage functions - clearing domain tables only');
      
      // Pause live changes processing
      try {
        const liveChangesStats = liveChangesManager.getStats();
        if (liveChangesStats.status === 'active') {
          console.log('[IntegrityService] ⏸️ Pausing live changes processing during table reset...');
          liveChangesManager.pause();
        } else {
          console.log(`[IntegrityService] Live changes manager not active (${liveChangesStats.status}) - skipping pause`);
        }
      } catch (liveChangesError) {
        console.warn('[IntegrityService] Could not pause live changes manager:', liveChangesError);
      }
      
      const clearSuccess = await clearDomainDataOnly();
      
      if (clearSuccess) {
        result.tablesCleared = [...CRITICAL_TABLES];
        console.log(`[IntegrityService] ✅ Successfully cleared tables using storage functions:`, result.tablesCleared);
      } else {
        console.error('[IntegrityService] ❌ Storage function failed to clear tables');
      }

      result.success = clearSuccess;
      return result;

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      console.error('[IntegrityService] ❌ Table reset failed:', error);
      return result;
    } finally {
      // Always resume live changes processing, even if clearing failed
      try {
        const liveChangesStats = liveChangesManager.getStats();
        if (liveChangesStats.status === 'active' && liveChangesStats.isPaused) {
          console.log('[IntegrityService] ▶️ Resuming live changes processing...');
          liveChangesManager.resume();
        } else {
          console.log(`[IntegrityService] Live changes manager not in paused state (status: ${liveChangesStats.status}, paused: ${liveChangesStats.isPaused}) - skipping resume`);
        }
      } catch (liveChangesError) {
        console.warn('[IntegrityService] Could not resume live changes manager:', liveChangesError);
      }
    }
  }

  /**
   * ✅ MISSING: Get sync manager from global service registry
   */
  private getSyncManager(): any {
    try {
      // Access sync manager through global service registry or orchestrator
      const orchestrator = (window as any).orchestratorActor;
      if (orchestrator) {
        const snapshot = orchestrator.getSnapshot();
        return snapshot.context.syncManager || null;
      }
    } catch (error) {
      console.warn('[IntegrityService] Could not get sync manager:', error);
    }
    return null;
  }

  /**
   * ✅ MISSING: Disconnect sync manager with retry logic
   */
  private async disconnectSyncManager(syncManager: any): Promise<void> {
    try {
      syncManager.disconnect();
      
      // Wait for disconnection to complete
      let disconnectAttempts = 0;
      const maxDisconnectAttempts = 10;
      while (syncManager.isConnected() && disconnectAttempts < maxDisconnectAttempts) {
        await new Promise(resolve => setTimeout(resolve, 200));
        disconnectAttempts++;
      }
      
      if (syncManager.isConnected()) {
        console.warn('[IntegrityService] ⚠️ Warning: Still connected after disconnect attempts, proceeding anyway');
      } else {
        console.log('[IntegrityService] ✅ Successfully disconnected from sync');
      }
    } catch (error) {
      console.warn('[IntegrityService] Error during sync manager disconnect:', error);
    }
  }

  /**
   * ✅ MISSING: Verify tables are actually empty after clearing
   */
  private async verifyTablesEmpty(): Promise<void> {
    try {
      if (this.dataSource && this.dataSource.isInitialized) {
        for (const tableName of CRITICAL_TABLES) {
          try {
            const entityClass = TABLE_TO_ENTITY_MAP[tableName];
            if (entityClass) {
              const repository = this.dataSource.getRepository(entityClass);
              const count = await repository.count();
              if (count > 0) {
                console.warn(`[IntegrityService] ⚠️ Table ${tableName} still has ${count} records after clearing`);
              } else {
                console.log(`[IntegrityService] ✅ Verified table ${tableName} is empty`);
              }
            }
          } catch (verifyError) {
            console.warn(`[IntegrityService] Could not verify table ${tableName} is empty:`, verifyError);
          }
        }
      }
    } catch (dsError) {
      console.warn('[IntegrityService] Could not verify table clearing due to datasource error:', dsError);
    }
  }

  /**
   * ✅ MISSING: Trigger automatic reconnection after reset
   */
  private async triggerAutoReconnection(syncManager: any): Promise<void> {
    setTimeout(() => {
      try {
        console.log('[IntegrityService] 🔄 All database cleanup completed - triggering fresh connection for initial sync...');
        
        if (syncManager && syncManager.getAutoConnect && syncManager.getAutoConnect()) {
          syncManager.connect().then(() => {
            console.log('[IntegrityService] ✅ Fresh connection established - should trigger initial sync with LSN 0/0');
          }).catch((connectError: any) => {
            console.warn('[IntegrityService] Failed to establish fresh connection:', connectError);
          });
        } else {
          console.log('[IntegrityService] Auto-connect disabled - manual reconnection required');
        }
      } catch (reconnectError) {
        console.warn('[IntegrityService] Failed to trigger fresh connection, but reset was successful:', reconnectError);
      }
    }, 1000); // Longer delay to ensure both state machine processing AND database cleanup complete
  }
  
  /**
   * ✅ MISSING: Handle server-initiated reset commands
   */
 async handleServerResetCommand(message: any): Promise<void> {
    console.warn('[IntegrityService] 🚨 Received reset command from server', message);

    const resetCommand = message.resetCommand || message;
    const reason = message.reason || 'Server-initiated reset';

    try {
      let result: any;

      if (resetCommand.type === 'full_reset') {
        result = await this.executeReset(reason, 'full_reset');
      } else if (resetCommand.type === 'table_reset') {
        result = await this.executeReset(reason, 'table_reset');
      } else {
        throw new Error(`Unknown reset type: ${resetCommand.type}`);
      }

      // ✅ MISSING: Send acknowledgment to server
      if (this.messageSender) {
        this.messageSender.send({
          type: 'clt_integrity_reset_ack',
          success: result.success,
          result,
          inReplyTo: message.messageId
        });
      }

      // ✅ MISSING: Send completion event to machine
      this.sendEventToMachine({ 
        type: 'SERVER_INTEGRITY_RESET_COMPLETED', 
        result, 
        command: resetCommand 
      });

    } catch (error) {
      console.error('[IntegrityService] ❌ Error executing server reset command:', error);

      // Send error acknowledgment
      if (this.messageSender) {
        this.messageSender.send({
          type: 'clt_integrity_reset_ack',
          success: false,
          error: error instanceof Error ? error.message : String(error),
          inReplyTo: message.messageId
        });
      }
      
      // Send error event to machine
      this.sendEventToMachine({ 
        type: 'INTEGRITY_RESET_ERROR', 
        error: error instanceof Error ? error : new Error(String(error))
      });
    }
  }

  /**
   * Disconnect all services cleanly before reset
   * CRITICAL: Must happen BEFORE database reset to avoid sending messages over stale connections
   */
  private async disconnectAllServices(): Promise<void> {
    let wasConnected = false;
    
    try {
      console.log('[IntegrityService] 🔌 Starting comprehensive service disconnection...');
      
      // Step 1: Disable auto-reconnect on all systems to prevent interference
      await this.disableAllAutoReconnect();
      
      // Step 2: Disconnect sync machine v2 services (orchestrator-managed)
      const services = getGlobalServices();
      if (services?.webSocketService) {
        wasConnected = services.webSocketService.isConnected();
        if (wasConnected) {
          console.log('[IntegrityService] 🔌 Disconnecting SyncMachineV2 WebSocketService...');
          await services.webSocketService.disconnect();
          
          // Wait for disconnection to fully propagate
          await this.waitForServiceDisconnection(services.webSocketService, 'SyncMachineV2');
        }
      }
      
      // Step 3: Disconnect legacy SyncManager (used by debug page)
      await this.disconnectLegacySyncManager();
      
      // Step 4: Send orchestrator event to ensure clean state
      await this.notifyOrchestratorOfDisconnection();
      
      // Step 5: Final wait for all systems to stabilize
      console.log('[IntegrityService] ⏳ Waiting for all sync systems to stabilize...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!wasConnected) {
        console.log('[IntegrityService] No active connections found');
      } else {
        console.log('[IntegrityService] ✅ All sync systems disconnected successfully');
      }
      
    } catch (error) {
      console.warn('[IntegrityService] Error during comprehensive service disconnection:', error);
      // Continue with reset even if disconnection fails
    }
  }

  /**
   * Disable auto-reconnect on all sync systems
   */
  private async disableAllAutoReconnect(): Promise<void> {
    try {
      console.log('[IntegrityService] 🚫 Disabling auto-reconnect on all sync systems...');
      
      // Disable on legacy SyncManager
      const { SyncManager } = await import('./SyncManager');
      const syncManager = SyncManager.getInstance();
      if (syncManager) {
        syncManager.setAutoConnect(false);
        console.log('[IntegrityService] ✅ Disabled auto-reconnect on SyncManager');
      }
      
      // Disable on orchestrator level
      const orchestrator = (window as any).orchestratorActor;
      if (orchestrator) {
        orchestrator.send({ 
          type: 'DISABLE_AUTO_RECONNECT_FOR_RESET',
          reason: 'integrity_reset_in_progress' 
        });
        console.log('[IntegrityService] ✅ Disabled auto-reconnect on Orchestrator');
      }
      
    } catch (error) {
      console.warn('[IntegrityService] Could not disable auto-reconnect:', error);
    }
  }

  /**
   * Wait for a service to fully disconnect with timeout
   */
  private async waitForServiceDisconnection(service: any, serviceName: string): Promise<void> {
    let disconnectAttempts = 0;
    const maxDisconnectAttempts = 25; // 5 seconds max
    
    while (service.isConnected() && disconnectAttempts < maxDisconnectAttempts) {
      await new Promise(resolve => setTimeout(resolve, 200));
      disconnectAttempts++;
      
      if (disconnectAttempts % 5 === 0) {
        console.log(`[IntegrityService] ⏳ ${serviceName} still disconnecting... (${disconnectAttempts * 200}ms)`);
      }
    }
    
    if (service.isConnected()) {
      console.warn(`[IntegrityService] ⚠️ Warning: ${serviceName} still connected after ${disconnectAttempts * 200}ms, proceeding anyway`);
    } else {
      console.log(`[IntegrityService] ✅ ${serviceName} disconnected after ${disconnectAttempts * 200}ms`);
    }
  }

  /**
   * Disconnect legacy SyncManager system
   */
  private async disconnectLegacySyncManager(): Promise<void> {
    try {
      const { SyncManager } = await import('./SyncManager');
      const syncManager = SyncManager.getInstance();
      
      if (syncManager?.isConnected?.()) {
        console.log('[IntegrityService] 🔌 Disconnecting legacy SyncManager...');
        syncManager.disconnect();
        
        // Wait for legacy disconnection
        let disconnectAttempts = 0;
        const maxDisconnectAttempts = 15;
        
        while (syncManager.isConnected() && disconnectAttempts < maxDisconnectAttempts) {
          await new Promise(resolve => setTimeout(resolve, 200));
          disconnectAttempts++;
        }
        
        if (syncManager.isConnected()) {
          console.warn('[IntegrityService] ⚠️ Warning: Legacy SyncManager still connected, proceeding anyway');
        } else {
          console.log('[IntegrityService] ✅ Legacy SyncManager disconnected successfully');
        }
      } else {
        console.log('[IntegrityService] Legacy SyncManager not connected');
      }
    } catch (error) {
      console.warn('[IntegrityService] Error disconnecting legacy SyncManager:', error);
    }
  }

  /**
   * Notify orchestrator of intentional disconnection
   */
  private async notifyOrchestratorOfDisconnection(): Promise<void> {
    try {
      const orchestrator = (window as any).orchestratorActor;
      if (orchestrator) {
        orchestrator.send({ 
          type: 'INTEGRITY_RESET_DISCONNECTION_COMPLETE',
          timestamp: Date.now()
        });
        console.log('[IntegrityService] 📤 Notified orchestrator of disconnection completion');
      }
    } catch (error) {
      console.warn('[IntegrityService] Could not notify orchestrator of disconnection:', error);
    }
  }

  /**
   * Re-enable auto-reconnect after successful reset
   */
  private async reEnableAutoReconnect(): Promise<void> {
    try {
      console.log('[IntegrityService] 🔄 Re-enabling auto-reconnect after reset...');
      
      // Re-enable on legacy SyncManager
      const { SyncManager } = await import('./SyncManager');
      const syncManager = SyncManager.getInstance();
      if (syncManager) {
        syncManager.setAutoConnect(true);
        console.log('[IntegrityService] ✅ Re-enabled auto-reconnect on SyncManager');
      }
      
      // Re-enable on orchestrator level
      const orchestrator = (window as any).orchestratorActor;
      if (orchestrator) {
        orchestrator.send({ 
          type: 'ENABLE_AUTO_RECONNECT_AFTER_RESET',
          reason: 'integrity_reset_completed' 
        });
        console.log('[IntegrityService] ✅ Re-enabled auto-reconnect on Orchestrator');
      }
      
    } catch (error) {
      console.warn('[IntegrityService] Could not re-enable auto-reconnect:', error);
    }
  }

  /**
   * ✅ NEW: Check if database is empty to prevent false positive validations
   */
  private async checkForEmptyDatabase(): Promise<{
    isEmpty: boolean;
    reason: string;
    totalRecords: number;
    tableBreakdown: Record<string, number>;
  }> {
    let totalRecords = 0;
    const tableBreakdown: Record<string, number> = {};
    
    try {
      // Count total records across all critical tables
      for (const tableName of CRITICAL_TABLES) {
        try {
          const repository = this.dataSource.getRepository(TABLE_TO_ENTITY_MAP[tableName]);
          const count = await repository.count();
          tableBreakdown[tableName] = count;
          totalRecords += count;
        } catch (error) {
          console.warn(`[IntegrityService] Could not count ${tableName} for empty check:`, error);
          tableBreakdown[tableName] = 0;
        }
      }
      
      // Check various empty conditions
      const currentLSN = this.getCurrentLSN();
      
      // Condition 1: LSN is 0/0 (fresh start or post-reset)
      if (currentLSN === '0/0') {
        return {
          isEmpty: true,
          reason: `Fresh database state (LSN: ${currentLSN})`,
          totalRecords,
          tableBreakdown
        };
      }
      
      // Condition 2: All critical tables are completely empty
      if (totalRecords === 0) {
        return {
          isEmpty: true,
          reason: 'All critical tables are empty',
          totalRecords,
          tableBreakdown
        };
      }
      
      // Condition 3: Multiple tables are empty (likely post-reset)
      const emptyTables = CRITICAL_TABLES.filter(table => tableBreakdown[table] === 0);
      if (emptyTables.length >= CRITICAL_TABLES.length - 1) { // All but one table empty
        return {
          isEmpty: true,
          reason: `${emptyTables.length}/${CRITICAL_TABLES.length} critical tables are empty (${emptyTables.join(', ')})`,
          totalRecords,
          tableBreakdown
        };
      }
      
      // Condition 4: Very low record count (likely incomplete sync)
      if (totalRecords < 10) {
        return {
          isEmpty: true,
          reason: `Very low record count (${totalRecords} total records) - likely incomplete sync`,
          totalRecords,
          tableBreakdown
        };
      }
      
      // Database has sufficient data for validation
      return {
        isEmpty: false,
        reason: 'Database has sufficient data for integrity validation',
        totalRecords,
        tableBreakdown
      };
      
    } catch (error) {
      console.error('[IntegrityService] Error checking for empty database:', error);
      // Default to allowing validation if check fails
      return {
        isEmpty: false,
        reason: `Empty check failed: ${error instanceof Error ? error.message : String(error)}`,
        totalRecords,
        tableBreakdown
      };
    }
  }
} 