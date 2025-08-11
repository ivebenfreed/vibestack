/**
 * Delete Safety Check
 * Prevents mass deletions by validating DELETE operations
 */

export class DeleteSafetyCheck {
  private static recentDeletes: Map<string, { count: number; timestamp: number }> = new Map();
  private static readonly WINDOW_MS = 60000; // 1 minute window
  private static readonly MAX_DELETES_PER_TABLE = 5; // Max deletes per table per minute

  /**
   * Check if a delete operation is safe to proceed
   * Prevents mass deletions by limiting delete rate
   */
  static checkDelete(tableName: string, recordId: string): { allowed: boolean; reason?: string } {
    const now = Date.now();
    const key = `${tableName}`;
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(recordId)) {
      return {
        allowed: false,
        reason: `Invalid UUID format: ${recordId}`
      };
    }

    // Get or create tracking entry for this table
    let tableDeletes = this.recentDeletes.get(key);
    
    // Clean up old entries
    if (tableDeletes && (now - tableDeletes.timestamp) > this.WINDOW_MS) {
      tableDeletes = undefined;
      this.recentDeletes.delete(key);
    }

    if (!tableDeletes) {
      // First delete for this table in the window
      this.recentDeletes.set(key, { count: 1, timestamp: now });
      return { allowed: true };
    }

    // Check if we're exceeding the rate limit
    if (tableDeletes.count >= this.MAX_DELETES_PER_TABLE) {
      console.error(`🚫 DELETE RATE LIMIT: Table ${tableName} has had ${tableDeletes.count} deletes in the last minute`);
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${tableDeletes.count} deletes in last minute for table ${tableName}`
      };
    }

    // Increment counter and allow
    tableDeletes.count++;
    return { allowed: true };
  }

  /**
   * Log a delete operation for monitoring
   */
  static logDelete(tableName: string, recordId: string, clientId?: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] DELETE LOG:`, {
      table: tableName,
      uuid: recordId,
      clientId: clientId || 'N/A'
    });

    // Also log to a file or external service if needed
    // This can be expanded to send alerts if suspicious patterns are detected
  }

  /**
   * Get statistics about recent deletes
   */
  static getStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    const now = Date.now();

    for (const [table, data] of this.recentDeletes.entries()) {
      if ((now - data.timestamp) <= this.WINDOW_MS) {
        stats[table] = {
          count: data.count,
          ageMs: now - data.timestamp
        };
      }
    }

    return stats;
  }
}