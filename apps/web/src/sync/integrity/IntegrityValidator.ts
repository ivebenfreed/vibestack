/**
 * IntegrityValidator - Pure validation logic
 * 
 * Extracted from the massive IntegrityService.ts (1,809 lines) to focus solely on 
 * integrity validation operations. This class handles:
 * - Baseline validation with timestamp thresholds
 * - Full validation workflows
 * - Server-based validation requests
 * - Local validation fallbacks
 * - Empty database detection
 * 
 * Part of Phase 0: IntegrityService split for better maintainability
 */

import { NewPGliteDataSource } from '../../db/newtypeorm/NewDataSource';
import type { IMessageSender } from '../interfaces';
import { 
  User, 
  Project, 
  Task, 
  Comment, 
  CLIENT_DOMAIN_TABLES,
} from '@repo/dataforge/client-entities';
import { MoreThan } from 'typeorm';

// Re-export types that validator needs
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

export interface IntegrityValidationConfig {
  clientId: string;
  enableServerValidation: boolean;
  validationTimeoutMs: number;
  autoResetOnFailure: boolean;
}

export interface IntegrityValidationCallbacks {
  onValidationStarted?: (reason: string) => void;
  onValidationCompleted?: (result: IntegrityValidationResult) => void;
  onValidationError?: (error: Error, reason?: string) => void;
}

// Map table names to entity classes
const TABLE_TO_ENTITY_MAP: Record<string, any> = {
  'users': User,
  'projects': Project,
  'tasks': Task,
  'comments': Comment,
};

// Get clean table names (without quotes) from CLIENT_DOMAIN_TABLES
const CRITICAL_TABLES = CLIENT_DOMAIN_TABLES.map(table => table.replace(/"/g, ''));

export class IntegrityValidator {
  private config: IntegrityValidationConfig;
  private dataSource: NewPGliteDataSource;
  private callbacks: IntegrityValidationCallbacks = {};
  private messageSender: IMessageSender | null = null;
  
  // Machine reference for event-driven communication
  private machineRef: any = null;
  
  // Validation state
  private pendingValidations = new Map<string, {
    resolve: (result: IntegrityValidationResult) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  constructor(config: IntegrityValidationConfig, dataSource: NewPGliteDataSource) {
    this.config = config;
    this.dataSource = dataSource;
    
    console.log('[IntegrityValidator] Initialized with config:', config);
    
    // Load persisted baseline
    const baseline = this.loadBaseline();
    console.log('[IntegrityValidator] Loaded baseline:', baseline);
  }

  /**
   * Load integrity baseline from localStorage
   */
  private loadBaseline(): any {
    try {
      const stored = localStorage.getItem('integrity-baseline');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('[IntegrityValidator] Failed to load baseline:', error);
      localStorage.removeItem('integrity-baseline');
    }
    return null;
  }

  /**
   * Save integrity baseline to localStorage
   */
  private saveBaseline(baseline: any): void {
    try {
      localStorage.setItem('integrity-baseline', JSON.stringify(baseline));
      console.log('[IntegrityValidator] 💾 Baseline saved:', baseline);
    } catch (error) {
      console.warn('[IntegrityValidator] Failed to save baseline:', error);
    }
  }

  /**
   * Establish baseline without validation (used after initial sync)
   */
  async establishBaseline(reason: string): Promise<void> {
    try {
      console.log(`[IntegrityValidator] Establishing baseline: ${reason}`);
      
      // Create baseline with current timestamp
      const newBaseline = {
        lastInitialSyncCompletedAt: new Date().toISOString(),
        lastValidationTime: Date.now(),
        isEstablished: true,
        maxRecordsBeforeReset: 100000, // Default threshold
        reason: reason
      };
      
      this.saveBaseline(newBaseline);
      console.log('[IntegrityValidator] ✅ Baseline established without validation');
      
    } catch (error) {
      console.error('[IntegrityValidator] Failed to establish baseline:', error);
      throw error;
    }
  }

  /**
   * Set callbacks for validation events
   */
  setCallbacks(callbacks: IntegrityValidationCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Set message sender for server communication
   */
  setMessageSender(sender: IMessageSender): void {
    this.messageSender = sender;
    console.log('[IntegrityValidator] Message sender configured');
  }

  /**
   * Set machine reference for event-driven communication
   */
  setMachineRef(machineRef: any): void {
    this.machineRef = machineRef;
    console.log('[IntegrityValidator] Machine reference set for event-driven communication');
  }

  /**
   * Main validation method - validates integrity with baseline approach
   */
  async validateIntegrity(reason: string = 'routine check'): Promise<IntegrityValidationResult> {
    try {
      console.log(`[IntegrityValidator] Starting integrity validation: ${reason}`);
      
      this.callbacks.onValidationStarted?.(reason);

      // Step 1: Detect empty database conditions that cause false positives
      const emptyDatabaseCheck = await this.checkForEmptyDatabase();
      if (emptyDatabaseCheck.isEmpty) {
        console.log(`[IntegrityValidator] 🔄 EMPTY DATABASE DETECTED - SKIPPING VALIDATION`);
        console.log(`[IntegrityValidator] 🔄 Reason: ${emptyDatabaseCheck.reason}`);
        console.log(`[IntegrityValidator] 🔄 Total records across all tables: ${emptyDatabaseCheck.totalRecords}`);
        console.log(`[IntegrityValidator] 🔄 This prevents false positives when database is empty after reset`);
        
        return {
          isValid: true,
          issues: [],
          recommendedAction: 'none',
          validationType: 'skipped_empty_database',
          resetReason: `Skipped: ${emptyDatabaseCheck.reason}`
        };
      }

      // Step 2: Load and check if we have a valid baseline
      const baseline = this.loadBaseline();
      const hasValidBaseline = baseline?.lastInitialSyncCompletedAt !== null && baseline?.lastInitialSyncCompletedAt !== undefined;
      console.log(`[IntegrityValidator] 🔍 BASELINE CHECK:`, {
        hasValidBaseline,
        baselineValue: baseline?.lastInitialSyncCompletedAt,
        baselineType: typeof baseline?.lastInitialSyncCompletedAt,
        isNull: baseline?.lastInitialSyncCompletedAt === null,
        isUndefined: baseline?.lastInitialSyncCompletedAt === undefined,
        shouldDoFullValidation: !hasValidBaseline
      });

      if (!hasValidBaseline) {
        console.log('[IntegrityValidator] No baseline timestamp - performing full validation');
        return await this.performFullValidation(`${reason} (establish baseline)`);
      }

      // Step 3: Count records changed since baseline timestamp
      const recordCount = await this.countRecordsSinceBaseline(baseline.lastInitialSyncCompletedAt);
      
      // Step 4: Check against threshold
      if (recordCount.totalChanges > baseline.maxRecordsBeforeReset) {
        console.log(`[IntegrityValidator] 📊 Threshold exceeded: ${recordCount.totalChanges} records (max: ${baseline.maxRecordsBeforeReset})`);
        console.log(`[IntegrityValidator] Baseline was: ${new Date(baseline.lastInitialSyncCompletedAt).toISOString()}`);
        
        return this.createThresholdExceededResult(recordCount, baseline);
      }

      // Step 5: Within threshold - validate using server validation or local validation
      console.log(`[IntegrityValidator] ✅ Within threshold: ${recordCount.totalChanges} records, proceeding with validation`);

      if (this.config.enableServerValidation && this.messageSender) {
        // Server-based validation with baseline
        console.log('[IntegrityValidator] Performing server-based baseline validation');
        const serverResult = await this.requestBaselineServerValidation(baseline.lastInitialSyncCompletedAt, recordCount);
        
        console.log(`[IntegrityValidator] Baseline validation completed:`, { 
          isValid: serverResult.isValid, 
          issueCount: serverResult.issues.length,
          recommendedAction: serverResult.recommendedAction
        });
        
        return serverResult;
      } else {
        // Local validation fallback
        console.log('[IntegrityValidator] Performing local validation (server validation disabled or no message sender)');
        return await this.performLocalValidation();
      }

    } catch (error) {
      console.error('[IntegrityValidator] Validation error:', error);
      this.callbacks.onValidationError?.(error as Error, reason);
      throw error;
    }
  }

  /**
   * Check for empty database conditions
   */
  private async checkForEmptyDatabase(): Promise<{ isEmpty: boolean; reason: string; totalRecords: number }> {
    try {
      let totalRecords = 0;
      const tableResults: Record<string, number> = {};

      for (const tableName of CRITICAL_TABLES) {
        const EntityClass = TABLE_TO_ENTITY_MAP[tableName];
        if (!EntityClass) {
          console.warn(`[IntegrityValidator] No entity class found for table: ${tableName}`);
          continue;
        }

        const repository = this.dataSource.getRepository(EntityClass);
        const count = await repository.count();
        tableResults[tableName] = count;
        totalRecords += count;
      }

      console.log(`[IntegrityValidator] Empty database check:`, {
        totalRecords,
        tableBreakdown: tableResults
      });

      // Consider database empty if total records across all critical tables is 0
      if (totalRecords === 0) {
        return {
          isEmpty: true,
          reason: 'No records in any critical tables',
          totalRecords
        };
      }

      return {
        isEmpty: false,
        reason: 'Database has records',
        totalRecords
      };

    } catch (error) {
      console.error('[IntegrityValidator] Error checking for empty database:', error);
      // If we can't check, assume not empty to be safe
      return {
        isEmpty: false,
        reason: 'Error checking database state',
        totalRecords: -1
      };
    }
  }

  /**
   * Count records changed since baseline timestamp
   */
  private async countRecordsSinceBaseline(baselineTimestamp: number): Promise<{
    totalChanges: number;
    tableBreakdown: Record<string, number>;
  }> {
    try {
      const sinceDate = new Date(baselineTimestamp);
      let totalChanges = 0;
      const tableBreakdown: Record<string, number> = {};

      console.log(`[IntegrityValidator] Counting records changed since: ${sinceDate.toISOString()}`);

      for (const tableName of CRITICAL_TABLES) {
        const EntityClass = TABLE_TO_ENTITY_MAP[tableName];
        if (!EntityClass) continue;

        const repository = this.dataSource.getRepository(EntityClass);
        const count = await repository.count({
          where: {
            updatedAt: MoreThan(sinceDate)
          }
        });

        tableBreakdown[tableName] = count;
        totalChanges += count;
      }

      console.log(`[IntegrityValidator] Record count since baseline:`, {
        baselineDate: sinceDate.toISOString(),
        totalChanges,
        tableBreakdown
      });

      return { totalChanges, tableBreakdown };

    } catch (error) {
      console.error('[IntegrityValidator] Error counting records since baseline:', error);
      throw error;
    }
  }

  /**
   * Request baseline server validation
   */
  private async requestBaselineServerValidation(
    baselineTimestamp: number,
    recordCount: { totalChanges: number; tableBreakdown: Record<string, number> }
  ): Promise<IntegrityValidationResult> {
    
    return new Promise(async (resolve, reject) => {
      try {
        console.log('[IntegrityValidator] Requesting baseline server validation...');
        
        // Generate fingerprints for modified data since baseline
        const fingerprints = await this.generateFingerprintsSinceTimestamp(baselineTimestamp);
        
        const validationId = crypto.randomUUID();
        const timeout = setTimeout(() => {
          this.pendingValidations.delete(validationId);
          console.warn('[IntegrityValidator] Baseline validation timeout');
          reject(new Error('Baseline validation timeout'));
        }, this.config.validationTimeoutMs);

        // Store pending validation
        this.pendingValidations.set(validationId, { resolve, reject, timeout });

        const validationRequest: IntegrityValidationRequest = {
          clientId: this.config.clientId,
          fingerprints,
          baselineTimestamp,
          sinceTimestamp: baselineTimestamp,
          recordCount
        };

        // Send baseline validation request
        console.log('[IntegrityValidator] 🔍 DEBUG: About to send validation request', {
          hasMessageSender: !!this.messageSender,
          messageSenderType: this.messageSender?.constructor?.name,
          validationId,
          requestSize: JSON.stringify(validationRequest).length
        });

        this.messageSender!.send({
          type: 'clt_integrity_baseline_validation',
          validationId,
          ...validationRequest
        });

        console.log('[IntegrityValidator] ✅ Baseline validation request sent successfully');

      } catch (error) {
        console.error('[IntegrityValidator] Error requesting baseline server validation:', error);
        reject(error);
      }
    });
  }

  /**
   * Generate fingerprints for data since a timestamp
   */
  private async generateFingerprintsSinceTimestamp(sinceTimestamp: number): Promise<Record<string, TableFingerprint>> {
    const fingerprints: Record<string, TableFingerprint> = {};
    const sinceDate = new Date(sinceTimestamp);
    
    console.log(`[IntegrityValidator] Generating fingerprints for data since: ${sinceDate.toISOString()}`);

    for (const tableName of CRITICAL_TABLES) {
      try {
        fingerprints[tableName] = await this.generateModifiedTableFingerprint(
          tableName, 
          this.dataSource, 
          sinceDate
        );
      } catch (error) {
        console.error(`[IntegrityValidator] Error generating fingerprint for ${tableName}:`, error);
        // Continue with other tables
      }
    }

    console.log(`[IntegrityValidator] Generated ${Object.keys(fingerprints).length} fingerprints since baseline`);
    return fingerprints;
  }

  /**
   * Generate fingerprint for modified records in a table since a date
   */
  private async generateModifiedTableFingerprint(
    tableName: string, 
    dataSource: any, 
    sinceDate: Date
  ): Promise<TableFingerprint> {
    const EntityClass = TABLE_TO_ENTITY_MAP[tableName];
    if (!EntityClass) {
      throw new Error(`No entity class found for table: ${tableName}`);
    }

    const repository = dataSource.getRepository(EntityClass);
    
    // Get modified records since the date
    const modifiedRecords = await repository.find({
      where: {
        updatedAt: MoreThan(sinceDate)
      },
      order: { updatedAt: 'ASC' }
    });

    const recordCount = modifiedRecords.length;
    
    if (recordCount === 0) {
      return {
        recordCount: 0,
        lastUpdated: Date.now(),
        recordIdHash: '',
        recentDataHash: ''
      };
    }

    // Generate hashes
    const recordIds = modifiedRecords.map(record => record.id).sort();
    const recordIdHash = await this.generateHash(recordIds.join(','));
    
    // Hash of most recent 10 records
    const recentRecords = modifiedRecords.slice(-10);
    const recentDataStr = recentRecords.map(record => 
      JSON.stringify(record, Object.keys(record).sort())
    ).join('|');
    const recentDataHash = await this.generateHash(recentDataStr);
    
    const lastUpdated = modifiedRecords[modifiedRecords.length - 1]?.updatedAt?.getTime() || Date.now();

    return {
      recordCount,
      lastUpdated,
      recordIdHash,
      recentDataHash
    };
  }

  /**
   * Perform full validation (when no baseline available)
   */
  private async performFullValidation(reason: string): Promise<IntegrityValidationResult> {
    console.log(`[IntegrityValidator] Performing full validation: ${reason}`);

    if (this.config.enableServerValidation && this.messageSender) {
      return await this.requestServerValidation();
    } else {
      console.log('[IntegrityValidator] Server validation disabled, performing local validation');
      return await this.performLocalValidation();
    }
  }

  /**
   * Request full server validation
   */
  private async requestServerValidation(): Promise<IntegrityValidationResult> {
    
    return new Promise(async (resolve, reject) => {
      try {
        console.log('[IntegrityValidator] Requesting full server validation...');
        
        const fingerprints = await this.generateLocalFingerprints();
        
        const validationId = crypto.randomUUID();
        const timeout = setTimeout(() => {
          this.pendingValidations.delete(validationId);
          console.warn('[IntegrityValidator] Full validation timeout');
          reject(new Error('Full validation timeout'));
        }, this.config.validationTimeoutMs);

        this.pendingValidations.set(validationId, { resolve, reject, timeout });

        const validationRequest: IntegrityValidationRequest = {
          clientId: this.config.clientId,
          fingerprints
        };

        this.messageSender!.send({
          type: 'clt_integrity_validation',
          validationId,
          ...validationRequest
        });

        console.log('[IntegrityValidator] Full validation request sent');

      } catch (error) {
        console.error('[IntegrityValidator] Error requesting server validation:', error);
        reject(error);
      }
    });
  }

  /**
   * Perform local validation as fallback
   */
  private async performLocalValidation(): Promise<IntegrityValidationResult> {
    try {
      console.log('[IntegrityValidator] Performing local integrity validation...');

      // Basic local validation - check for obvious inconsistencies
      const fingerprints = await this.generateLocalFingerprints();
      const issues: any[] = [];

      // Check if any tables are completely empty (might indicate issues)
      for (const [tableName, fingerprint] of Object.entries(fingerprints)) {
        if (fingerprint.recordCount === 0) {
          console.warn(`[IntegrityValidator] Warning: Table ${tableName} is empty`);
          // This might be valid, so don't treat as error
        }
      }

      console.log('[IntegrityValidator] Local validation completed:', {
        tablesChecked: Object.keys(fingerprints).length,
        issuesFound: issues.length
      });

      // If validation successful, establish baseline
      if (issues.length === 0) {
        const newBaseline = {
          lastInitialSyncCompletedAt: new Date().toISOString(),
          lastValidationTime: Date.now(),
          isEstablished: true,
          maxRecordsBeforeReset: 100000, // Default threshold
          reason: 'successful_local_validation'
        };
        
        this.saveBaseline(newBaseline);
        console.log('[IntegrityValidator] ✅ Baseline established after successful validation');
      }

      return {
        isValid: issues.length === 0,
        issues,
        recommendedAction: issues.length === 0 ? 'none' : 'retry',
        validationType: 'local_validation'
      };

    } catch (error) {
      console.error('[IntegrityValidator] Local validation error:', error);
      return {
        isValid: false,
        issues: [{ type: 'local_validation_error', message: error instanceof Error ? error.message : 'Unknown error' }],
        recommendedAction: 'retry',
        validationType: 'local_validation_error'
      };
    }
  }

  /**
   * Generate local fingerprints for all tables
   */
  async generateLocalFingerprints(): Promise<Record<string, TableFingerprint>> {
    const fingerprints: Record<string, TableFingerprint> = {};

    console.log('[IntegrityValidator] Generating local fingerprints for all tables...');

    for (const tableName of CRITICAL_TABLES) {
      try {
        fingerprints[tableName] = await this.generateTableFingerprint(tableName, this.dataSource);
      } catch (error) {
        console.error(`[IntegrityValidator] Error generating fingerprint for ${tableName}:`, error);
        // Continue with other tables
      }
    }

    console.log(`[IntegrityValidator] Generated ${Object.keys(fingerprints).length} local fingerprints`);
    return fingerprints;
  }

  /**
   * Generate fingerprint for a complete table
   */
  private async generateTableFingerprint(tableName: string, dataSource: any): Promise<TableFingerprint> {
    const EntityClass = TABLE_TO_ENTITY_MAP[tableName];
    if (!EntityClass) {
      throw new Error(`No entity class found for table: ${tableName}`);
    }

    const repository = dataSource.getRepository(EntityClass);
    
    // Get all records
    const allRecords = await repository.find({
      order: { updatedAt: 'ASC' }
    });

    const recordCount = allRecords.length;
    
    if (recordCount === 0) {
      return {
        recordCount: 0,
        lastUpdated: Date.now(),
        recordIdHash: '',
        recentDataHash: ''
      };
    }

    // Generate hashes
    const recordIds = allRecords.map(record => record.id).sort();
    const recordIdHash = await this.generateHash(recordIds.join(','));
    
    // Hash of most recent 10 records
    const recentRecords = allRecords.slice(-10);
    const recentDataStr = recentRecords.map(record => 
      JSON.stringify(record, Object.keys(record).sort())
    ).join('|');
    const recentDataHash = await this.generateHash(recentDataStr);
    
    const lastUpdated = allRecords[allRecords.length - 1]?.updatedAt?.getTime() || Date.now();

    return {
      recordCount,
      lastUpdated,
      recordIdHash,
      recentDataHash
    };
  }

  /**
   * Handle validation response from server
   */
  async handleValidationResponse(message: any): Promise<IntegrityValidationResult> {
    console.log('[IntegrityValidator] Received validation response from server:', message);
    
    const result: IntegrityValidationResult = {
      isValid: message.isValid,
      issues: message.issues || [],
      recommendedAction: this.mapRecommendedAction(message.recommendedAction),
      serverResponse: message
    };
    
    // Log validation result analysis
    console.log('[IntegrityValidator] 🔍 Validation result analysis:', {
      isValid: result.isValid,
      issueCount: result.issues.length,
      recommendedAction: result.recommendedAction
    });
    
    // Resolve any pending validation promises
    for (const [key, pending] of this.pendingValidations) {
      console.log(`[IntegrityValidator] Resolving pending validation: ${key}`);
      clearTimeout(pending.timeout);
      this.pendingValidations.delete(key);
      pending.resolve(result);
    }
    
    // Trigger callback
    this.callbacks.onValidationCompleted?.(result);
    
    // Send event to machine if available
    this.sendEventToMachine({ type: 'INTEGRITY_VALIDATION_COMPLETED', result });
    
    console.log('[IntegrityValidator] Validation response processed');
    return result;
  }

  /**
   * Create result for threshold exceeded scenario
   */
  private createThresholdExceededResult(recordCount: any, baseline: any): IntegrityValidationResult {
    return {
      isValid: false,
      issues: [{
        type: 'threshold_exceeded',
        message: `Record changes (${recordCount.totalChanges}) exceed threshold (${baseline.maxRecordsBeforeReset})`,
        recordCount: recordCount.totalChanges,
        threshold: baseline.maxRecordsBeforeReset,
        tableBreakdown: recordCount.tableBreakdown
      }],
      recommendedAction: 'reset',
      validationType: 'baseline_threshold',
      resetReason: `Threshold exceeded: ${recordCount.totalChanges} > ${baseline.maxRecordsBeforeReset}`
    };
  }

  /**
   * Generate hash for data
   */
  private async generateHash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Map server recommended action to our action type
   */
  private mapRecommendedAction(serverAction: any): 'none' | 'retry' | 'reset' {
    if (!serverAction) return 'none';
    
    const action = String(serverAction).toLowerCase();
    if (action.includes('reset')) return 'reset';
    if (action.includes('retry')) return 'retry';
    return 'none';
  }

  /**
   * Send event to state machine
   */
  private sendEventToMachine(event: any): void {
    if (this.machineRef) {
      try {
        this.machineRef.send(event);
        console.log('[IntegrityValidator] Event sent to machine:', event.type);
      } catch (error) {
        console.warn('[IntegrityValidator] Failed to send event to machine:', error);
      }
    }
  }
}