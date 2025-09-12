/**
 * SimpleIntegrityValidator - Simplified validation that just resets on failure
 * 
 * Much simpler approach:
 * 1. Check if database is empty -> establish baseline
 * 2. Check if we have baseline -> validate against it
 * 3. If validation fails -> reset and re-sync
 * 
 * No complex decision trees, just simple pass/fail/reset logic.
 */

// import { db, CLIENT_DOMAIN_TABLES } from '@repo/dataforge/dexie-schema'; // DEPRECATED - no longer needed
import { isDatabaseEmpty, clearDomainDataOnly } from '../../db/dexie-storage';
import { syncLogger } from '../utils/SyncLogger';
import type { Table } from 'dexie';

export interface SimpleValidationResult {
  isValid: boolean;
  action: 'none' | 'establish_baseline' | 'reset';
  reason: string;
}

export class SimpleIntegrityValidator {
  private clientId: string;
  
  constructor(clientId: string) {
    this.clientId = clientId;
    syncLogger.info('validation', 'SimpleIntegrityValidator initialized');
  }

  /**
   * Simple validation logic:
   * 1. If empty database -> establish baseline after initial sync
   * 2. If has baseline -> quick validation
   * 3. If validation fails -> reset
   */
  async validate(): Promise<SimpleValidationResult> {
    try {
      syncLogger.info('validation', 'Starting simple integrity validation');
      
      // Check if database is empty
      const isEmpty = await isDatabaseEmpty();
      if (isEmpty) {
        syncLogger.info('validation', 'Database is empty - will establish baseline after initial sync');
        return {
          isValid: true,
          action: 'establish_baseline',
          reason: 'Empty database - baseline will be established after initial sync'
        };
      }

      // Check if we have a baseline
      const baseline = this.loadBaseline();
      if (!baseline) {
        syncLogger.info('validation', 'No baseline found - establishing new baseline');
        await this.establishBaseline('no_previous_baseline');
        return {
          isValid: true,
          action: 'establish_baseline',
          reason: 'No baseline existed - established new one'
        };
      }

      // Simple validation: Check if data has changed dramatically since baseline
      const currentStats = await this.getCurrentStats();
      const isValid = this.compareWithBaseline(baseline, currentStats);

      if (!isValid) {
        syncLogger.warn('validation', 'Validation failed - will reset', {
          baseline,
          current: currentStats
        });
        return {
          isValid: false,
          action: 'reset',
          reason: 'Data inconsistency detected - reset required'
        };
      }

      syncLogger.info('validation', 'Validation passed');
      return {
        isValid: true,
        action: 'none',
        reason: 'Validation successful'
      };

    } catch (error) {
      syncLogger.error('validation', 'Validation error - will reset', error);
      return {
        isValid: false,
        action: 'reset',
        reason: `Validation error: ${error}`
      };
    }
  }

  /**
   * Establish a new baseline with current database stats
   */
  async establishBaseline(reason: string): Promise<void> {
    const stats = await this.getCurrentStats();
    const baseline = {
      timestamp: Date.now(),
      reason,
      stats,
      clientId: this.clientId
    };
    
    localStorage.setItem('integrity-baseline-simple', JSON.stringify(baseline));
    syncLogger.info('validation', 'Baseline established', baseline);
  }

  /**
   * Load baseline from localStorage
   */
  private loadBaseline(): any {
    try {
      const stored = localStorage.getItem('integrity-baseline-simple');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      syncLogger.warn('validation', 'Failed to load baseline', error);
      return null;
    }
  }

  /**
   * Get current database statistics
   */
  private async getCurrentStats(): Promise<Record<string, number>> {
    const stats: Record<string, number> = {};
    let total = 0;

    for (const tableName of CLIENT_DOMAIN_TABLES) {
      const table = db[tableName] as Table;
      if (table) {
        const count = await table.count();
        stats[tableName] = count;
        total += count;
      }
    }

    stats.total = total;
    return stats;
  }

  /**
   * Simple comparison: just check if record counts are reasonable
   */
  private compareWithBaseline(baseline: any, current: Record<string, number>): boolean {
    // If baseline is too old (>24 hours), consider it invalid
    const dayInMs = 24 * 60 * 60 * 1000;
    if (Date.now() - baseline.timestamp > dayInMs) {
      syncLogger.info('validation', 'Baseline is too old');
      return false;
    }

    // If total records differ by more than 50%, something is wrong
    const baselineTotal = baseline.stats.total || 0;
    const currentTotal = current.total || 0;
    
    if (baselineTotal === 0 && currentTotal > 0) {
      // Normal case: started with empty, now has data
      return true;
    }
    
    if (baselineTotal > 0 && currentTotal === 0) {
      // Data loss - definitely invalid
      syncLogger.warn('validation', 'Data loss detected');
      return false;
    }

    // Check for dramatic changes (more than 50% difference)
    const percentChange = Math.abs(currentTotal - baselineTotal) / Math.max(baselineTotal, 1);
    if (percentChange > 0.5) {
      syncLogger.warn('validation', 'Dramatic data change detected', {
        baseline: baselineTotal,
        current: currentTotal,
        percentChange
      });
      return false;
    }

    return true;
  }

  /**
   * Reset the database and clear baseline
   */
  async reset(): Promise<void> {
    syncLogger.info('validation', 'Performing integrity reset');
    
    // Clear domain data only (preserve system tables)
    await clearDomainDataOnly();
    
    // Clear baseline so we establish a new one after re-sync
    localStorage.removeItem('integrity-baseline-simple');
    
    syncLogger.info('validation', 'Reset completed');
  }
}