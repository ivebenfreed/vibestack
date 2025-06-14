/**
 * IntegrityManager - Server-side data integrity validation and reset management
 * 
 * Handles:
 * - Client data consistency validation
 * - Corruption detection and analysis
 * - Reset triggering and coordination
 * - Data fingerprinting for integrity checks
 */

import { syncLogger } from '../middleware/logger';
import { getDBClient } from '../lib/db';
import { getLatestChangeHistoryLSN, compareLSN } from '../lib/sync-common';
import type { MinimalContext } from '../types/hono';
import type { WebSocketHandler } from './types';
import type { TableChange } from '@repo/sync-types';

const MODULE_NAME = 'IntegrityManager';

export interface IntegrityValidationRequest {
  clientId: string;
  currentLSN: string;
  tableFingerprints: Record<string, TableFingerprint>;
  timestamp: number;
}

export interface TableFingerprint {
  recordCount: number;
  lastUpdated: number;
  recordIdHash: string; // Hash of all record IDs sorted
  recentDataHash: string; // Hash of most recent 10 records
}

export interface IntegrityValidationResult {
  isValid: boolean;
  issues: IntegrityIssue[];
  recommendedAction: 'none' | 'catchup' | 'reset';
  serverFingerprints: Record<string, TableFingerprint>;
  validationTimestamp: number;
}

export interface IntegrityIssue {
  type: 'record_count_mismatch' | 'missing_records' | 'extra_records' | 'data_corruption' | 'lsn_regression';
  table: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  details: any;
}

export interface ResetCommand {
  type: 'full_reset' | 'table_reset';
  reason: string;
  affectedTables?: string[];
  preserveUserData?: boolean;
}

/**
 * Server-side integrity management
 */
export class IntegrityManager {
  private context: MinimalContext;
  private messageHandler: WebSocketHandler;
  
  // Tables to validate for integrity
  private readonly CRITICAL_TABLES = ['users', 'projects', 'tasks', 'comments'];
  
  // Thresholds for determining action
  private readonly RESET_THRESHOLDS = {
    criticalIssues: 1,        // Any critical issue triggers reset
    highSeverityIssues: 3,    // 3+ high severity issues trigger reset
    mediumSeverityIssues: 10, // 10+ medium issues trigger reset
    recordCountDifferencePercent: 0.1 // 10% difference in record count
  };

  constructor(context: MinimalContext, messageHandler: WebSocketHandler) {
    this.context = context;
    this.messageHandler = messageHandler;
  }

  /**
   * Validate client integrity against server state
   * Now supports baseline validation with timestamp filtering
   */
  async validateClientIntegrity(request: IntegrityValidationRequest): Promise<IntegrityValidationResult> {
    syncLogger.info('Starting client integrity validation', {
      clientId: request.clientId,
      clientLSN: request.currentLSN,
      tableCount: Object.keys(request.tableFingerprints).length,
      validationType: (request as any).validationType,
      baselineTimestamp: (request as any).baselineTimestamp
    }, MODULE_NAME);

    try {
      // Check if this is a baseline validation request
      const isBaselineValidation = (request as any).validationType === 'baseline_incremental';
      const baselineTimestamp = (request as any).baselineTimestamp;
      
      if (isBaselineValidation && baselineTimestamp) {
        console.log(`[IntegrityManager] Processing baseline validation since ${new Date(baselineTimestamp).toISOString()}`);
        return await this.validateBaselineChanges(request as any);
      } else {
        // Standard full validation
        return await this.validateFullIntegrity(request);
      }

    } catch (error) {
      syncLogger.error('Error during integrity validation', {
        clientId: request.clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);

      throw new Error(`Integrity validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Standard full integrity validation (refactored from original logic)
   */
  private async validateFullIntegrity(request: IntegrityValidationRequest): Promise<IntegrityValidationResult> {
    // Generate expected server fingerprints
    const serverFingerprints = await this.generateServerFingerprints(request.clientId, request.currentLSN);
    
    // Compare fingerprints and identify issues
    const issues = await this.compareFingerprints(request.tableFingerprints, serverFingerprints);
    
    // Determine recommended action
    const recommendedAction = this.determineAction(issues);
    
    const result: IntegrityValidationResult = {
      isValid: issues.length === 0,
      issues,
      recommendedAction,
      serverFingerprints,
      validationTimestamp: Date.now()
    };

    syncLogger.info('Client integrity validation completed', {
      clientId: request.clientId,
      isValid: result.isValid,
      issueCount: issues.length,
      recommendedAction: result.recommendedAction
    }, MODULE_NAME);

    return result;
  }

  /**
   * Validate baseline changes (only records modified since timestamp)
   */
  private async validateBaselineChanges(request: {
    clientId: string;
    currentLSN: string;
    tableFingerprints: Record<string, TableFingerprint>;
    baselineTimestamp: number;
    recordCount: number;
    timestamp: number;
  }): Promise<IntegrityValidationResult> {
    
    syncLogger.info('Starting baseline validation', {
      clientId: request.clientId,
      baselineTimestamp: new Date(request.baselineTimestamp).toISOString(),
      recordCount: request.recordCount,
      modifiedTables: Object.keys(request.tableFingerprints).length
    }, MODULE_NAME);

    // Generate server fingerprints for the same baseline period
    const serverFingerprints = await this.generateServerBaselineFingerprints(
      request.clientId, 
      request.baselineTimestamp
    );
    
    // Compare baseline fingerprints
    const issues = await this.compareBaselineFingerprints(
      request.tableFingerprints, 
      serverFingerprints,
      request.baselineTimestamp
    );
    
    // Determine recommended action for baseline validation
    const recommendedAction = this.determineBaselineAction(issues, request.recordCount);
    
    const result: IntegrityValidationResult = {
      isValid: issues.length === 0,
      issues,
      recommendedAction,
      serverFingerprints,
      validationTimestamp: Date.now()
    };

    syncLogger.info('Baseline validation completed', {
      clientId: request.clientId,
      isValid: result.isValid,
      issueCount: issues.length,
      recommendedAction: result.recommendedAction,
      baselineAge: Date.now() - request.baselineTimestamp
    }, MODULE_NAME);

    return result;
  }

  /**
   * Generate server-side fingerprints for comparison
   */
  private async generateServerFingerprints(
    clientId: string, 
    clientLSN: string
  ): Promise<Record<string, TableFingerprint>> {
    const fingerprints: Record<string, TableFingerprint> = {};
    const dbClient = getDBClient(this.context);

    try {
      await dbClient.connect();

      for (const tableName of this.CRITICAL_TABLES) {
        fingerprints[tableName] = await this.generateTableFingerprint(
          dbClient,
          tableName,
          clientId,
          clientLSN
        );
      }

      return fingerprints;

    } finally {
      try {
        await dbClient.end();
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Generate fingerprint for a specific table
   */
  private async generateTableFingerprint(
    dbClient: any,
    tableName: string,
    clientId: string,
    clientLSN: string
  ): Promise<TableFingerprint> {
    try {
      syncLogger.info('Generating server fingerprint', {
        tableName,
        clientId,
        clientLSN
      }, MODULE_NAME);

      // Get record count (include ALL records - server should validate what client should have)
      const countResult = await dbClient.query(`
        SELECT COUNT(*) as count
        FROM "${tableName}"
      `);
      
      const recordCount = parseInt(countResult.rows[0]?.count || '0');
      syncLogger.debug('Server record count', {
        tableName,
        recordCount
      }, MODULE_NAME);

      // Get all record IDs for hash calculation (include ALL records)
      const idsResult = await dbClient.query(`
        SELECT id 
        FROM "${tableName}"
        ORDER BY id ASC
      `);
      
      const recordIds = idsResult.rows.map((row: any) => row.id);
      const recordIdHash = this.hashArray(recordIds);
      syncLogger.debug('Server record ID hash', {
        tableName,
        recordIdCount: recordIds.length,
        recordIdHash,
        sampleIds: recordIds.slice(0, 5)
      }, MODULE_NAME);

      // Get recent records for data integrity hash (include ALL records)
      const recentResult = await dbClient.query(`
        SELECT id, updated_at, created_at
        FROM "${tableName}"
        ORDER BY COALESCE(updated_at, created_at) DESC
        LIMIT 10
      `);

      const recentData = recentResult.rows.map((row: any) => {
        const timestamp = row.updated_at || row.created_at;
        const timestampMs = timestamp ? new Date(timestamp).getTime() : 0;
        return `${row.id}:${timestampMs}`;
      });
      const recentDataHash = this.hashArray(recentData);
      syncLogger.debug('Server recent data hash', {
        tableName,
        recentDataCount: recentData.length,
        recentDataHash,
        sampleData: recentData.slice(0, 3),
        allData: recentData.length <= 10 ? recentData : `${recentData.slice(0, 5)}... (${recentData.length} total)`
      }, MODULE_NAME);

      // Get last updated timestamp
      const lastUpdated = recentResult.rows[0] ? 
        new Date(recentResult.rows[0].updated_at || recentResult.rows[0].created_at).getTime() : 0;

      const fingerprint = {
        recordCount,
        lastUpdated,
        recordIdHash,
        recentDataHash
      };

      syncLogger.info('Server fingerprint generated', {
        tableName,
        fingerprint
      }, MODULE_NAME);

      return fingerprint;

    } catch (error) {
      syncLogger.error('Error generating table fingerprint', {
        tableName,
        clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);

      // Return empty fingerprint on error
      return {
        recordCount: 0,
        lastUpdated: 0,
        recordIdHash: '',
        recentDataHash: ''
      };
    }
  }

  /**
   * Compare client and server fingerprints to identify issues
   */
  private async compareFingerprints(
    clientFingerprints: Record<string, TableFingerprint>,
    serverFingerprints: Record<string, TableFingerprint>
  ): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    syncLogger.info('Starting fingerprint comparison', {
      clientTables: Object.keys(clientFingerprints),
      serverTables: Object.keys(serverFingerprints),
      criticalTables: this.CRITICAL_TABLES
    }, MODULE_NAME);

    for (const tableName of this.CRITICAL_TABLES) {
      const clientFp = clientFingerprints[tableName];
      const serverFp = serverFingerprints[tableName];

      syncLogger.debug('Comparing table fingerprints', {
        tableName,
        clientFp,
        serverFp
      }, MODULE_NAME);

      if (!clientFp) {
        syncLogger.warn('Client missing fingerprint', { tableName }, MODULE_NAME);
        issues.push({
          type: 'missing_records',
          table: tableName,
          severity: 'high',
          description: `Client missing fingerprint for table ${tableName}`,
          details: { missingTable: tableName }
        });
        continue;
      }

      if (!serverFp) {
        syncLogger.warn('Server missing fingerprint', { tableName }, MODULE_NAME);
        issues.push({
          type: 'extra_records',
          table: tableName,
          severity: 'medium',
          description: `Server has no data for table ${tableName}`,
          details: { extraTable: tableName }
        });
        continue;
      }

      // Check record count differences
      const countDifference = Math.abs(clientFp.recordCount - serverFp.recordCount);
      const countDifferencePercent = serverFp.recordCount > 0 ? 
        countDifference / serverFp.recordCount : 
        (countDifference > 0 ? 1 : 0);

      syncLogger.debug('Record count comparison', {
        tableName,
        clientCount: clientFp.recordCount,
        serverCount: serverFp.recordCount,
        difference: countDifference,
        differencePercent: countDifferencePercent,
        threshold: this.RESET_THRESHOLDS.recordCountDifferencePercent
      }, MODULE_NAME);

      if (countDifferencePercent > this.RESET_THRESHOLDS.recordCountDifferencePercent) {
        syncLogger.warn('Record count mismatch detected', {
          tableName,
          clientCount: clientFp.recordCount,
          serverCount: serverFp.recordCount,
          differencePercent: countDifferencePercent
        }, MODULE_NAME);
        
        issues.push({
          type: 'record_count_mismatch',
          table: tableName,
          severity: countDifferencePercent > 0.5 ? 'critical' : 'high',
          description: `Record count mismatch in ${tableName}: client has ${clientFp.recordCount}, server expects ${serverFp.recordCount}`,
          details: {
            clientCount: clientFp.recordCount,
            serverCount: serverFp.recordCount,
            difference: countDifference,
            differencePercent: countDifferencePercent
          }
        });
      }

      // Check record ID hash differences (missing/extra records)
      syncLogger.debug('Record ID hash comparison', {
        tableName,
        clientHash: clientFp.recordIdHash,
        serverHash: serverFp.recordIdHash,
        matches: clientFp.recordIdHash === serverFp.recordIdHash
      }, MODULE_NAME);

      if (clientFp.recordIdHash !== serverFp.recordIdHash) {
        syncLogger.warn('Record ID hash mismatch detected', {
          tableName,
          clientHash: clientFp.recordIdHash,
          serverHash: serverFp.recordIdHash
        }, MODULE_NAME);
        
        issues.push({
          type: 'missing_records',
          table: tableName,
          severity: 'high',
          description: `Record set mismatch in ${tableName}: client has different records than expected`,
          details: {
            clientHash: clientFp.recordIdHash,
            serverHash: serverFp.recordIdHash
          }
        });
      }

      // Check recent data hash differences (data corruption)
      syncLogger.debug('Recent data hash comparison', {
        tableName,
        clientHash: clientFp.recentDataHash,
        serverHash: serverFp.recentDataHash,
        matches: clientFp.recentDataHash === serverFp.recentDataHash
      }, MODULE_NAME);

      if (clientFp.recentDataHash !== serverFp.recentDataHash) {
        syncLogger.warn('Recent data hash mismatch detected', {
          tableName,
          clientHash: clientFp.recentDataHash,
          serverHash: serverFp.recentDataHash
        }, MODULE_NAME);
        
        issues.push({
          type: 'data_corruption',
          table: tableName,
          severity: 'medium',
          description: `Data integrity issue in ${tableName}: recent records differ from expected`,
          details: {
            clientHash: clientFp.recentDataHash,
            serverHash: serverFp.recentDataHash
          }
        });
      }
    }

    return issues;
  }

  /**
   * Determine recommended action based on issues found
   */
  private determineAction(issues: IntegrityIssue[]): 'none' | 'catchup' | 'reset' {
    if (issues.length === 0) {
      return 'none';
    }

    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const highCount = issues.filter(i => i.severity === 'high').length;
    const mediumCount = issues.filter(i => i.severity === 'medium').length;

    if (criticalCount >= this.RESET_THRESHOLDS.criticalIssues ||
        highCount >= this.RESET_THRESHOLDS.highSeverityIssues ||
        mediumCount >= this.RESET_THRESHOLDS.mediumSeverityIssues) {
      return 'reset';
    }

    // For minor issues, catchup might be sufficient
    if (highCount > 0 || mediumCount > 0) {
      return 'catchup';
    }

    return 'none';
  }

  /**
   * Trigger a full reset for a client
   */
  async triggerClientReset(
    clientId: string, 
    reason: string, 
    command: ResetCommand
  ): Promise<void> {
    syncLogger.warn('Triggering client reset', {
      clientId,
      reason,
      resetType: command.type,
      affectedTables: command.affectedTables
    }, MODULE_NAME);

    try {
      // Send reset command to client
      await this.messageHandler.send({
        type: 'srv_integrity_reset',
        clientId,
        messageId: `reset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        resetCommand: command,
        reason
      } as any);

      syncLogger.info('Reset command sent to client', {
        clientId,
        resetType: command.type
      }, MODULE_NAME);

    } catch (error) {
      syncLogger.error('Failed to send reset command to client', {
        clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);

      throw new Error(`Failed to trigger client reset: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create hash of array elements (using same algorithm as client)
   */
  private hashArray(items: any[]): string {
    const content = items.join('|');
    
    // Use same simple hash function as client for consistency
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
   * Quick integrity check during heartbeat
   */
  async quickIntegrityCheck(clientId: string, clientLSN: string): Promise<{
    hasIssues: boolean;
    recommendedAction: 'none' | 'validate' | 'reset';
  }> {
    try {
      // Quick check - just compare LSN and basic metrics
      const serverLSN = await getLatestChangeHistoryLSN(this.context);
      const lsnComparison = compareLSN(clientLSN, serverLSN || '0/0');
      
      // If client is significantly behind, recommend validation
      if (lsnComparison < 0) {
        const clientDecimal = this.lsnToDecimal(clientLSN);
        const serverDecimal = this.lsnToDecimal(serverLSN || '0/0');
        const gap = serverDecimal - clientDecimal;
        
        // If gap is huge (>100MB), might indicate corruption
        if (gap > 100 * 1024 * 1024) {
          return {
            hasIssues: true,
            recommendedAction: 'reset'
          };
        }
        
        // Medium gap - validate
        if (gap > 50 * 1024 * 1024) {
          return {
            hasIssues: true,
            recommendedAction: 'validate'
          };
        }
      }
      
      return {
        hasIssues: false,
        recommendedAction: 'none'
      };

    } catch (error) {
      syncLogger.error('Quick integrity check failed', {
        clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);

      return {
        hasIssues: true,
        recommendedAction: 'validate'
      };
    }
  }

  private lsnToDecimal(lsn: string): number {
    const [major, minor] = lsn.split('/');
    return parseInt(major, 16) * 0x1000000 + parseInt(minor, 16);
  }



  /**
   * Generate server fingerprints for baseline validation (only modified records)
   */
  private async generateServerBaselineFingerprints(
    clientId: string, 
    baselineTimestamp: number
  ): Promise<Record<string, TableFingerprint>> {
    const fingerprints: Record<string, TableFingerprint> = {};
    const dbClient = getDBClient(this.context);

    try {
      await dbClient.connect();

      syncLogger.info('Generating server baseline fingerprints', {
        clientId,
        baselineTimestamp: new Date(baselineTimestamp).toISOString(),
        tables: this.CRITICAL_TABLES
      }, MODULE_NAME);

      for (const tableName of this.CRITICAL_TABLES) {
        fingerprints[tableName] = await this.generateServerBaselineTableFingerprint(
          dbClient,
          tableName,
          baselineTimestamp
        );
      }

      return fingerprints;

    } finally {
      try {
        await dbClient.end();
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Generate server fingerprint for records modified since baseline
   */
  private async generateServerBaselineTableFingerprint(
    dbClient: any,
    tableName: string,
    baselineTimestamp: number
  ): Promise<TableFingerprint> {
    try {
      syncLogger.debug('Generating server baseline fingerprint', {
        tableName,
        baselineTimestamp: new Date(baselineTimestamp).toISOString()
      }, MODULE_NAME);

      // Get count of records modified since baseline
      const countResult = await dbClient.query(`
        SELECT COUNT(*) as count
        FROM "${tableName}"
        WHERE updated_at > $1
      `, [new Date(baselineTimestamp).toISOString()]);
      
      const recordCount = parseInt(countResult.rows[0]?.count || '0');
      
      if (recordCount === 0) {
        syncLogger.debug('No server modifications since baseline', {
          tableName,
          baselineTimestamp: new Date(baselineTimestamp).toISOString()
        }, MODULE_NAME);
        
        return {
          recordCount: 0,
          lastUpdated: 0,
          recordIdHash: '',
          recentDataHash: ''
        };
      }

      syncLogger.debug('Server baseline record count', {
        tableName,
        recordCount,
        baselineTimestamp: new Date(baselineTimestamp).toISOString()
      }, MODULE_NAME);

      // Get modified record IDs for hash calculation
      const idsResult = await dbClient.query(`
        SELECT id 
        FROM "${tableName}"
        WHERE updated_at > $1
        ORDER BY id ASC
      `, [new Date(baselineTimestamp).toISOString()]);
      
      const recordIds = idsResult.rows.map((row: any) => row.id);
      const recordIdHash = this.hashArray(recordIds);

      // Get recent modified records for data integrity hash
      const recentResult = await dbClient.query(`
        SELECT id, updated_at, created_at
        FROM "${tableName}"
        WHERE updated_at > $1
        ORDER BY COALESCE(updated_at, created_at) DESC
        LIMIT 10
      `, [new Date(baselineTimestamp).toISOString()]);

      const recentData = recentResult.rows.map((row: any) => {
        const timestamp = row.updated_at || row.created_at;
        const timestampMs = timestamp ? new Date(timestamp).getTime() : 0;
        return `${row.id}:${timestampMs}`;
      });
      const recentDataHash = this.hashArray(recentData);

      // Get last updated timestamp of modified records
      const lastUpdated = recentResult.rows[0] ? 
        new Date(recentResult.rows[0].updated_at || recentResult.rows[0].created_at).getTime() : 0;

      const fingerprint = {
        recordCount,
        lastUpdated,
        recordIdHash,
        recentDataHash
      };

      syncLogger.debug('Server baseline fingerprint generated', {
        tableName,
        fingerprint
      }, MODULE_NAME);

      return fingerprint;

    } catch (error) {
      syncLogger.error('Error generating server baseline fingerprint', {
        tableName,
        baselineTimestamp: new Date(baselineTimestamp).toISOString(),
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);

      return {
        recordCount: 0,
        lastUpdated: 0,
        recordIdHash: '',
        recentDataHash: ''
      };
    }
  }

  /**
   * Compare baseline fingerprints with enhanced logging
   */
  private async compareBaselineFingerprints(
    clientFingerprints: Record<string, TableFingerprint>,
    serverFingerprints: Record<string, TableFingerprint>,
    baselineTimestamp: number
  ): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    syncLogger.info('Starting baseline fingerprint comparison', {
      clientTables: Object.keys(clientFingerprints),
      serverTables: Object.keys(serverFingerprints),
      baselineTimestamp: new Date(baselineTimestamp).toISOString()
    }, MODULE_NAME);

    // Get all tables that have modifications (client or server)
    const allModifiedTables = new Set([
      ...Object.keys(clientFingerprints),
      ...Object.keys(serverFingerprints)
    ]);

    for (const tableName of allModifiedTables) {
      const clientFp = clientFingerprints[tableName];
      const serverFp = serverFingerprints[tableName];

      syncLogger.debug('Comparing baseline table fingerprints', {
        tableName,
        clientModified: !!clientFp,
        serverModified: !!serverFp,
        clientCount: clientFp?.recordCount || 0,
        serverCount: serverFp?.recordCount || 0
      }, MODULE_NAME);

      // Check for table-level mismatches
      if (!clientFp && serverFp && serverFp.recordCount > 0) {
        issues.push({
          type: 'missing_records',
          table: tableName,
          severity: 'high',
          description: `Client missing ${serverFp.recordCount} records modified since baseline in ${tableName}`,
          details: { 
            serverModifications: serverFp.recordCount,
            baselineTimestamp
          }
        });
        continue;
      }

      if (clientFp && !serverFp && clientFp.recordCount > 0) {
        issues.push({
          type: 'extra_records',
          table: tableName,
          severity: 'medium',
          description: `Client has ${clientFp.recordCount} modifications in ${tableName} not present on server`,
          details: { 
            clientModifications: clientFp.recordCount,
            baselineTimestamp
          }
        });
        continue;
      }

      // Compare records when both have modifications
      if (clientFp && serverFp) {
        const recordCountIssues = this.compareRecordCounts(tableName, clientFp, serverFp, baselineTimestamp);
        const hashIssues = this.compareHashes(tableName, clientFp, serverFp, baselineTimestamp);
        
        issues.push(...recordCountIssues, ...hashIssues);
      }
    }

    return issues;
  }

  /**
   * Helper method to compare record counts for baseline validation
   */
  private compareRecordCounts(
    tableName: string, 
    clientFp: TableFingerprint, 
    serverFp: TableFingerprint,
    baselineTimestamp: number
  ): IntegrityIssue[] {
    const issues: IntegrityIssue[] = [];
    
    const countDifference = Math.abs(clientFp.recordCount - serverFp.recordCount);
    const countDifferencePercent = serverFp.recordCount > 0 ? 
      countDifference / serverFp.recordCount : 
      (countDifference > 0 ? 1 : 0);

    if (countDifferencePercent > 0.1) { // 10% threshold for baseline validation
      issues.push({
        type: 'record_count_mismatch',
        table: tableName,
        severity: countDifferencePercent > 0.5 ? 'critical' : 'high',
        description: `Baseline record count mismatch in ${tableName}: client ${clientFp.recordCount}, server ${serverFp.recordCount}`,
        details: {
          clientCount: clientFp.recordCount,
          serverCount: serverFp.recordCount,
          difference: countDifference,
          differencePercent: countDifferencePercent,
          baselineTimestamp
        }
      });
    }

    return issues;
  }

  /**
   * Helper method to compare hashes for baseline validation
   */
  private compareHashes(
    tableName: string, 
    clientFp: TableFingerprint, 
    serverFp: TableFingerprint,
    baselineTimestamp: number
  ): IntegrityIssue[] {
    const issues: IntegrityIssue[] = [];

    if (clientFp.recordIdHash !== serverFp.recordIdHash) {
      issues.push({
        type: 'missing_records',
        table: tableName,
        severity: 'high',
        description: `Baseline record set mismatch in ${tableName}`,
        details: {
          clientHash: clientFp.recordIdHash,
          serverHash: serverFp.recordIdHash,
          baselineTimestamp
        }
      });
    }

    if (clientFp.recentDataHash !== serverFp.recentDataHash) {
      issues.push({
        type: 'data_corruption',
        table: tableName,
        severity: 'medium',
        description: `Baseline data integrity issue in ${tableName}`,
        details: {
          clientHash: clientFp.recentDataHash,
          serverHash: serverFp.recentDataHash,
          baselineTimestamp
        }
      });
    }

    return issues;
  }

  /**
   * Determine action for baseline validation
   */
  private determineBaselineAction(issues: IntegrityIssue[], recordCount: number): 'none' | 'catchup' | 'reset' {
    if (issues.length === 0) {
      return 'none';
    }

    // If record count is very high, recommend reset even for minor issues
    if (recordCount > 10000) {
      return 'reset';
    }

    const criticalIssues = issues.filter(issue => issue.severity === 'critical').length;
    const highIssues = issues.filter(issue => issue.severity === 'high').length;

    if (criticalIssues > 0 || highIssues > 2) {
      return 'reset';
    } else if (highIssues > 0) {
      return 'catchup';
    } else {
      return 'none';
    }
  }
} 