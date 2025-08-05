/**
 * FingerprintGenerator - Pure fingerprint utilities
 * 
 * Extracted from the massive IntegrityService.ts (1,809 lines) to focus solely on 
 * fingerprint generation operations. This class handles:
 * - Table fingerprint generation
 * - Modified data fingerprints since timestamps
 * - Hash utilities for data integrity
 * - Record counting and sampling
 * 
 * Part of Phase 0: IntegrityService split for better maintainability
 */

import { NewPGliteDataSource } from '../../db/newtypeorm/NewDataSource';
import { 
  User, 
  Project, 
  Task, 
  Comment, 
  CLIENT_DOMAIN_TABLES,
} from '@repo/dataforge/client-entities';
import { MoreThan } from 'typeorm';

// Re-export types that fingerprint generator needs
export interface TableFingerprint {
  recordCount: number;
  lastUpdated: number;
  recordIdHash: string;
  recentDataHash: string;
}

export interface FingerprintGeneratorConfig {
  clientId: string;
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

export class FingerprintGenerator {
  private config: FingerprintGeneratorConfig;
  private dataSource: NewPGliteDataSource;

  constructor(config: FingerprintGeneratorConfig, dataSource: NewPGliteDataSource) {
    this.config = config;
    this.dataSource = dataSource;
    
    console.log('[FingerprintGenerator] Initialized with config:', config);
  }

  /**
   * Generate fingerprints for all critical tables
   */
  async generateAllFingerprints(): Promise<Record<string, TableFingerprint>> {
    const fingerprints: Record<string, TableFingerprint> = {};

    console.log('[FingerprintGenerator] Generating fingerprints for all critical tables...');

    for (const tableName of CRITICAL_TABLES) {
      try {
        fingerprints[tableName] = await this.generateTableFingerprint(tableName, this.dataSource);
      } catch (error) {
        console.error(`[FingerprintGenerator] Error generating fingerprint for ${tableName}:`, error);
        // Continue with other tables
        fingerprints[tableName] = {
          recordCount: 0,
          lastUpdated: 0,
          recordIdHash: '',
          recentDataHash: ''
        };
      }
    }

    console.log(`[FingerprintGenerator] Generated ${Object.keys(fingerprints).length} fingerprints`);
    return fingerprints;
  }

  /**
   * Generate fingerprints for data modified since a timestamp
   */
  async generateFingerprintsSinceTimestamp(sinceTimestamp: number): Promise<Record<string, TableFingerprint>> {
    const fingerprints: Record<string, TableFingerprint> = {};
    const sinceDate = new Date(sinceTimestamp);
    
    console.log(`[FingerprintGenerator] Generating fingerprints for data since: ${sinceDate.toISOString()}`);

    for (const tableName of CRITICAL_TABLES) {
      try {
        fingerprints[tableName] = await this.generateModifiedTableFingerprint(
          tableName, 
          this.dataSource, 
          sinceDate
        );
      } catch (error) {
        console.error(`[FingerprintGenerator] Error generating modified fingerprint for ${tableName}:`, error);
        // Continue with other tables
        fingerprints[tableName] = {
          recordCount: 0,
          lastUpdated: 0,
          recordIdHash: '',
          recentDataHash: ''
        };
      }
    }

    console.log(`[FingerprintGenerator] Generated ${Object.keys(fingerprints).length} fingerprints since timestamp`);
    return fingerprints;
  }

  /**
   * Generate fingerprint for a complete table
   */
  async generateTableFingerprint(tableName: string, dataSource?: any): Promise<TableFingerprint> {
    try {
      const sourceToUse = dataSource || this.dataSource;
      const entityClass = TABLE_TO_ENTITY_MAP[tableName];
      
      if (!entityClass) {
        console.warn(`[FingerprintGenerator] Unknown table: ${tableName}`);
        return {
          recordCount: 0,
          lastUpdated: 0,
          recordIdHash: '',
          recentDataHash: ''
        };
      }

      const repository = sourceToUse.getRepository(entityClass);
      
      // Get record count
      const recordCount = await repository.count();

      if (recordCount === 0) {
        return {
          recordCount: 0,
          lastUpdated: Date.now(),
          recordIdHash: '',
          recentDataHash: ''
        };
      }

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
      console.error(`[FingerprintGenerator] Error generating fingerprint for table ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Generate fingerprint for modified records in a table since a date
   */
  async generateModifiedTableFingerprint(
    tableName: string, 
    dataSource: any, 
    sinceDate: Date
  ): Promise<TableFingerprint> {
    try {
      const entityClass = TABLE_TO_ENTITY_MAP[tableName];
      if (!entityClass) {
        throw new Error(`No entity class found for table: ${tableName}`);
      }

      const repository = dataSource.getRepository(entityClass);
      
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
      const recordIdHash = this.hashArray(recordIds);
      
      // Hash of most recent 10 records (or all if less than 10)
      const recentRecords = modifiedRecords.slice(-10);
      const recentDataStr = recentRecords.map(record => 
        JSON.stringify(record, Object.keys(record).sort())
      ).join('|');
      const recentDataHash = this.hashData(recentDataStr);
      
      const lastUpdated = modifiedRecords[modifiedRecords.length - 1]?.updatedAt?.getTime() || Date.now();

      console.log(`[FingerprintGenerator] Generated modified fingerprint for ${tableName}: ${recordCount} records since ${sinceDate.toISOString()}`);

      return {
        recordCount,
        lastUpdated,
        recordIdHash,
        recentDataHash
      };

    } catch (error) {
      console.error(`[FingerprintGenerator] Error generating modified fingerprint for table ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Generate fingerprint for a specific table using advanced hashing
   */
  async generateAdvancedTableFingerprint(tableName: string): Promise<TableFingerprint> {
    try {
      const entityClass = TABLE_TO_ENTITY_MAP[tableName];
      if (!entityClass) {
        throw new Error(`No entity class found for table: ${tableName}`);
      }

      const repository = this.dataSource.getRepository(entityClass);
      
      // Get all records with full data
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

      // Generate hashes using crypto API for better security
      const recordIds = allRecords.map(record => record.id).sort();
      const recordIdHash = await this.generateCryptoHash(recordIds.join(','));
      
      // Hash of most recent 10 records
      const recentRecords = allRecords.slice(-10);
      const recentDataStr = recentRecords.map(record => 
        JSON.stringify(record, Object.keys(record).sort())
      ).join('|');
      const recentDataHash = await this.generateCryptoHash(recentDataStr);
      
      const lastUpdated = allRecords[allRecords.length - 1]?.updatedAt?.getTime() || Date.now();

      return {
        recordCount,
        lastUpdated,
        recordIdHash,
        recentDataHash
      };

    } catch (error) {
      console.error(`[FingerprintGenerator] Error generating advanced fingerprint for ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Get table statistics for fingerprint context
   */
  async getTableStats(tableName: string): Promise<{
    recordCount: number;
    lastUpdated: number;
    oldestRecord: number;
    avgRecordAge: number;
  }> {
    try {
      const entityClass = TABLE_TO_ENTITY_MAP[tableName];
      if (!entityClass) {
        throw new Error(`No entity class found for table: ${tableName}`);
      }

      const repository = this.dataSource.getRepository(entityClass);
      
      // Get count
      const recordCount = await repository.count();
      
      if (recordCount === 0) {
        return {
          recordCount: 0,
          lastUpdated: 0,
          oldestRecord: 0,
          avgRecordAge: 0
        };
      }

      // Get time-based stats
      const records = await repository.find({
        select: ['updatedAt', 'createdAt'],
        order: { updatedAt: 'DESC' }
      });

      const now = Date.now();
      const times = records.map(record => 
        record.updatedAt?.getTime() || record.createdAt?.getTime() || now
      );

      const lastUpdated = Math.max(...times);
      const oldestRecord = Math.min(...times);
      const avgRecordAge = times.reduce((sum, time) => sum + (now - time), 0) / times.length;

      return {
        recordCount,
        lastUpdated,
        oldestRecord,
        avgRecordAge
      };

    } catch (error) {
      console.error(`[FingerprintGenerator] Error getting table stats for ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Hash an array of items using simple hash function
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
   * Hash data using simple hash function (alternative to hashArray)
   */
  private hashData(data: string): string {
    let hash = 0;
    if (data.length === 0) return '';
    
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16);
  }

  /**
   * Generate hash using Web Crypto API for better security
   */
  private async generateCryptoHash(data: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.warn('[FingerprintGenerator] Crypto API not available, falling back to simple hash');
      return this.hashData(data);
    }
  }

  /**
   * Compare two fingerprints for differences
   */
  compareFingerprints(
    fingerprint1: TableFingerprint, 
    fingerprint2: TableFingerprint
  ): {
    identical: boolean;
    differences: string[];
    severity: 'none' | 'minor' | 'major';
  } {
    const differences: string[] = [];

    if (fingerprint1.recordCount !== fingerprint2.recordCount) {
      differences.push(`Record count mismatch: ${fingerprint1.recordCount} vs ${fingerprint2.recordCount}`);
    }

    if (fingerprint1.recordIdHash !== fingerprint2.recordIdHash) {
      differences.push(`Record ID hash mismatch`);
    }

    if (fingerprint1.recentDataHash !== fingerprint2.recentDataHash) {
      differences.push(`Recent data hash mismatch`);
    }

    const timeDiff = Math.abs(fingerprint1.lastUpdated - fingerprint2.lastUpdated);
    if (timeDiff > 60000) { // More than 1 minute difference
      differences.push(`Last updated time significant difference: ${timeDiff}ms`);
    }

    let severity: 'none' | 'minor' | 'major' = 'none';
    if (differences.length > 0) {
      // Major if record count or structure differs, minor if just timestamps
      severity = (fingerprint1.recordCount !== fingerprint2.recordCount || 
                 fingerprint1.recordIdHash !== fingerprint2.recordIdHash) ? 'major' : 'minor';
    }

    return {
      identical: differences.length === 0,
      differences,
      severity
    };
  }

  /**
   * Generate a summary fingerprint of all tables
   */
  async generateSummaryFingerprint(): Promise<{
    totalRecords: number;
    tablesCount: number;
    overallHash: string;
    lastActivity: number;
  }> {
    try {
      const allFingerprints = await this.generateAllFingerprints();
      
      const totalRecords = Object.values(allFingerprints)
        .reduce((sum, fp) => sum + fp.recordCount, 0);
      
      const tablesCount = Object.keys(allFingerprints).length;
      
      const lastActivity = Math.max(
        ...Object.values(allFingerprints).map(fp => fp.lastUpdated),
        0
      );
      
      // Create overall hash from all table hashes
      const allHashes = Object.entries(allFingerprints)
        .sort(([a], [b]) => a.localeCompare(b)) // Sort for consistency
        .map(([table, fp]) => `${table}:${fp.recordIdHash}:${fp.recentDataHash}`)
        .join('|');
      
      const overallHash = this.hashData(allHashes);

      return {
        totalRecords,
        tablesCount,
        overallHash,
        lastActivity
      };

    } catch (error) {
      console.error('[FingerprintGenerator] Error generating summary fingerprint:', error);
      throw error;
    }
  }
}