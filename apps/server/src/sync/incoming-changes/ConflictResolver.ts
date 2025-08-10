import { TableChange } from '@repo/sync-types';
import { SyncConfig } from '../../types/sync';
import { syncLogger } from '../../middleware/logger';

const MODULE_NAME = 'conflict-resolver';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ConflictDecision {
  shouldApply: boolean;
  reason: string;
  conflictingFields?: string[];
  mergeableFields?: string[];
  requiresMerge?: boolean;
}

/**
 * Handles CRDT conflict resolution and change validation
 * Current implementation uses timestamp-based resolution
 * Future: Field-level conflict resolution
 */
export class ConflictResolver {
  constructor(private config: SyncConfig) {}

  /**
   * Validate a table change before processing
   */
  validateChange(change: TableChange): ValidationResult {
    const errors: string[] = [];
    
    // Basic validation
    if (!change.table) {
      errors.push('Missing table name');
    }
    
    if (!change.operation || !['insert', 'update', 'delete'].includes(change.operation)) {
      errors.push('Invalid operation');
    }
    
    if (!change.data || typeof change.data !== 'object') {
      errors.push('Invalid data object');
    } else {
      const data = change.data as any;
      
      // Validate required fields
      if (!data.id) {
        errors.push('Missing required field: id');
      }
      
      if (!data.updatedAt) {
        errors.push('Missing required field: updatedAt');
      }
      
      // Validate timestamp format
      if (data.updatedAt && isNaN(Date.parse(data.updatedAt))) {
        errors.push('Invalid timestamp format for updatedAt');
      }
    }
    
    // Table-specific validation
    this.validateTableSpecificFields(change, errors);
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Determine if a change should be applied based on CRDT rules
   * Enhanced: Supports field-level conflict resolution for non-conflicting updates
   */
  shouldApplyChange(
    incoming: TableChange,
    existing?: any
  ): ConflictDecision {
    // If no existing record, always apply
    if (!existing) {
      return {
        shouldApply: true,
        reason: 'No existing record'
      };
    }

    const incomingData = incoming.data as any;
    
    // Enhanced: Check if this is a relationship-only update
    // Relationship-only updates contain only system metadata fields (id, clientId, updatedAt)
    // and should not be subject to CRDT conflict resolution since they don't modify entity content
    const dataKeys = Object.keys(incomingData).filter(key => key !== 'id');
    const isRelationshipOnlyUpdate = dataKeys.length <= 2 && 
      dataKeys.every(key => ['clientId', 'updatedAt', 'updated_at'].includes(key)) &&
      incoming.relationshipUpdates && incoming.relationshipUpdates.length > 0;
    
    if (isRelationshipOnlyUpdate) {
      syncLogger.info(`Detected relationship-only update - skipping CRDT conflict resolution`, {
        table: incoming.table,
        entityId: incomingData.id,
        hasEntityFields: dataKeys.length > 0,
        hasRelationshipUpdates: (incoming.relationshipUpdates?.length ?? 0) > 0,
        fieldCount: Object.keys(incomingData).length
      }, MODULE_NAME);
      
      return {
        shouldApply: true,
        reason: 'Relationship-only update (no entity content changes)'
      };
    }

    const incomingTimestamp = new Date(incoming.updatedAt);
    const existingTimestamp = new Date(existing.updatedAt || 0);

    syncLogger.debug(`CRDT timestamp comparison`, {
      table: incoming.table,
      entityId: incomingData.id,
      incomingTimestamp: incoming.updatedAt,
      incomingTimestampParsed: incomingTimestamp.toISOString(),
      existingTimestamp: existing.updatedAt,
      existingTimestampParsed: existing.updatedAt ? existingTimestamp.toISOString() : 'INVALID',
      incomingMs: incomingTimestamp.getTime(),
      existingMs: existing.updatedAt ? existingTimestamp.getTime() : 'INVALID',
      timeDiffMs: existing.updatedAt ? (incomingTimestamp.getTime() - existingTimestamp.getTime()) : 'N/A',
      incomingIsNewer: incomingTimestamp > existingTimestamp,
      incomingIsOlder: incomingTimestamp < existingTimestamp,
      timestampsEqual: incomingTimestamp.getTime() === existingTimestamp.getTime(),
      existingUpdatedAtRaw: existing.updatedAt,
      existingUpdatedAtType: typeof existing.updatedAt
    }, MODULE_NAME);

    // Enhanced: Try field-level conflict resolution first
    const fieldAnalysis = this.analyzeFieldLevelConflicts(incoming, existing);
    
    if (fieldAnalysis.resolutionStrategy === 'merge' && fieldAnalysis.mergeableFields.length > 0) {
      // Some fields can be merged even if incoming is older
      const hasConflicts = fieldAnalysis.conflictingFields.length > 0;
      
      if (hasConflicts) {
        return {
          shouldApply: true, // Apply with partial merge
          reason: `Partial merge: ${fieldAnalysis.mergeableFields.length} non-conflicting fields, ${fieldAnalysis.conflictingFields.length} conflicts`,
          conflictingFields: fieldAnalysis.conflictingFields,
          mergeableFields: fieldAnalysis.mergeableFields,
          requiresMerge: true
        };
      } else {
        return {
          shouldApply: true,
          reason: `Field-level merge: ${fieldAnalysis.mergeableFields.length} non-conflicting fields`,
          conflictingFields: [],
          mergeableFields: fieldAnalysis.mergeableFields,
          requiresMerge: true
        };
      }
    }

    // Fall back to simple timestamp-based CRDT (last-write-wins)
    if (incomingTimestamp > existingTimestamp) {
      return {
        shouldApply: true,
        reason: 'Incoming change is newer'
      };
    } else if (incomingTimestamp < existingTimestamp) {
      return {
        shouldApply: false,
        reason: 'Existing record is newer'
      };
    } else {
      // Timestamps are equal - use clientId as tiebreaker
      const incomingClientId = (incoming.data as any).clientId || '';
      const existingClientId = existing.clientId || '';
      
      syncLogger.debug(`CRDT clientId tiebreaker`, {
        table: incoming.table,
        entityId: incomingData.id,
        incomingClientId,
        existingClientId,
        incomingClientIdWins: incomingClientId > existingClientId,
        existingClientIdWins: existingClientId >= incomingClientId
      }, MODULE_NAME);
      
      if (incomingClientId > existingClientId) {
        return {
          shouldApply: true,
          reason: 'Timestamp tie broken by clientId'
        };
      } else {
        return {
          shouldApply: false,
          reason: 'Timestamp tie, existing clientId wins'
        };
      }
    }
  }

  /**
   * Analyze potential conflicts in a batch of changes
   */
  analyzeChangeConflicts(changes: TableChange[]): Array<{
    change: TableChange;
    conflictsWith: TableChange[];
    conflictType: 'duplicate_id' | 'timestamp_conflict' | 'dependency_cycle';
  }> {
    const conflicts: Array<{
      change: TableChange;
      conflictsWith: TableChange[];
      conflictType: 'duplicate_id' | 'timestamp_conflict' | 'dependency_cycle';
    }> = [];

    // Group changes by entity ID
    const changesByEntityId = new Map<string, TableChange[]>();
    
    for (const change of changes) {
      const entityId = (change.data as any).id;
      if (!changesByEntityId.has(entityId)) {
        changesByEntityId.set(entityId, []);
      }
      changesByEntityId.get(entityId)!.push(change);
    }

    // Check for conflicts within each entity
    for (const [entityId, entityChanges] of changesByEntityId) {
      if (entityChanges.length > 1) {
        // Multiple changes for the same entity - potential conflict
        for (let i = 0; i < entityChanges.length; i++) {
          const change = entityChanges[i];
          if (!change) continue;
          
          const conflictingChanges = entityChanges.filter((_, index) => index !== i);
          
          if (conflictingChanges.length > 0) {
            conflicts.push({
              change,
              conflictsWith: conflictingChanges,
              conflictType: 'duplicate_id'
            });
          }
        }
      }
    }

    // TODO: Add dependency cycle detection for task dependencies
    // TODO: Add more sophisticated conflict analysis

    return conflicts;
  }

  /**
   * Log conflict resolution decisions for debugging and monitoring
   */
  logConflictDecision(
    change: TableChange,
    decision: ConflictDecision,
    existing?: any
  ): void {
    if (!decision.shouldApply) {
      syncLogger.info(`CRDT Conflict: Change rejected`, {
        table: change.table,
        operation: change.operation,
        entityId: (change.data as any).id,
        reason: decision.reason,
        incomingTimestamp: change.updatedAt,
                  existingTimestamp: existing?.updatedAt,
        conflictingFields: decision.conflictingFields
      }, MODULE_NAME);
    } else {
      syncLogger.debug(`CRDT Resolution: Change accepted`, {
        table: change.table,
        operation: change.operation,
        entityId: (change.data as any).id,
        reason: decision.reason
      }, MODULE_NAME);
    }
  }

  /**
   * Validate table-specific fields and constraints
   */
  private validateTableSpecificFields(change: TableChange, errors: string[]): void {
    const data = change.data as any;

    // Business logic validations for specific tables
    // These are intentionally hardcoded as they represent core business rules
    // TODO: Consider moving to a validation configuration system
    switch (change.table) {
      case 'projects':
        if (change.operation !== 'delete' && !data.name) {
          errors.push('Projects require a name field');
        }
        break;

      case 'tasks':
        if (change.operation !== 'delete') {
          if (!data.title) {
            errors.push('Tasks require a title field');
          }
          if (!data.project_id) {
            errors.push('Tasks require a project_id field');
          }
        }
        break;

      case 'project_members':
        if (change.operation !== 'delete') {
          if (!data.project_id) {
            errors.push('Project members require a project_id field');
          }
          if (!data.user_id) {
            errors.push('Project members require a user_id field');
          }
        }
        break;


      case 'users':
        if (change.operation !== 'delete' && !data.email) {
          errors.push('Users require an email field');
        }
        break;

      case 'comments':
        if (change.operation !== 'delete') {
          if (!data.content) {
            errors.push('Comments require a content field');
          }
          if (!data.author_id) {
            errors.push('Comments require an author_id field');
          }
        }
        break;

      case 'entity_dependencies':
        if (change.operation !== 'delete') {
          if (!data.entity_type) {
            errors.push('Entity dependencies require an entity_type field');
          }
          if (!data.predecessor_id) {
            errors.push('Entity dependencies require a predecessor_id field');
          }
          if (!data.successor_id) {
            errors.push('Entity dependencies require a successor_id field');
          }
          if (data.predecessor_id === data.successor_id) {
            errors.push('Entity dependencies cannot have the same predecessor and successor');
          }
        }
        break;

      default:
        syncLogger.warn(`Unknown table for validation: ${change.table}`, {
          table: change.table,
          operation: change.operation
        }, MODULE_NAME);
    }
  }

  /**
   * Enhanced: Field-level conflict resolution
   * Allows non-conflicting updates to succeed even if they're older
   */
  private analyzeFieldLevelConflicts(
    incoming: TableChange,
    existing: any
  ): {
    conflictingFields: string[];
    mergeableFields: string[];
    resolutionStrategy: 'timestamp' | 'merge' | 'custom';
  } {
    const incomingData = incoming.data as any;
    const changeMetadata = incomingData.__changeMetadata;
    
    // If no change metadata, fall back to timestamp-based resolution
    if (!changeMetadata || !changeMetadata.changedFields) {
      return {
        conflictingFields: [],
        mergeableFields: [],
        resolutionStrategy: 'timestamp'
      };
    }
    
    const changedFields = changeMetadata.changedFields as string[];
    const conflictingFields: string[] = [];
    const mergeableFields: string[] = [];
    
    // Compare timestamps to see if incoming is older
    const incomingTimestamp = new Date(incoming.updatedAt);
    const existingTimestamp = new Date(existing.updatedAt || 0);
    const isIncomingOlder = incomingTimestamp < existingTimestamp;
    
    // If incoming is newer or equal, all fields are mergeable (no conflicts)
    if (!isIncomingOlder) {
      return {
        conflictingFields: [],
        mergeableFields: changedFields,
        resolutionStrategy: 'merge'
      };
    }
    
    // Incoming is older - check for field-level conflicts
    for (const fieldName of changedFields) {
      // Skip system fields that shouldn't cause conflicts
      if (['id', 'createdAt', 'clientId'].includes(fieldName)) {
        continue;
      }
      
      // Check if this field was modified since the incoming change's original timestamp
      const fieldConflictStrategy = this.getFieldConflictStrategy(incoming.table, fieldName);
      
      switch (fieldConflictStrategy) {
        case 'always_merge':
          // Fields like tags, arrays that can be merged
          mergeableFields.push(fieldName);
          break;
          
        case 'last_write_wins':
          // Fields where newer value should always win
          if (this.wasFieldModifiedSince(existing, fieldName, changeMetadata.originalUpdatedAt)) {
            conflictingFields.push(fieldName);
          } else {
            mergeableFields.push(fieldName);
          }
          break;
          
        case 'timestamp_wins':
        default:
          // Standard behavior - newer timestamp wins
          if (this.wasFieldModifiedSince(existing, fieldName, changeMetadata.originalUpdatedAt)) {
            conflictingFields.push(fieldName);
          } else {
            mergeableFields.push(fieldName);
          }
          break;
      }
    }
    
    // If any fields can be merged, use merge strategy
    if (mergeableFields.length > 0) {
      return {
        conflictingFields,
        mergeableFields,
        resolutionStrategy: 'merge'
      };
    }
    
    // All fields conflict, use timestamp resolution
    return {
      conflictingFields,
      mergeableFields: [],
      resolutionStrategy: 'timestamp'
    };
  }

  /**
   * Enhanced: Generate merged entity from conflicting changes
   * Supports partial non-conflicting updates even from older changes
   */
  public generateMergedEntity(
    incoming: TableChange,
    existing: any,
    analysis: {
      conflictingFields: string[];
      mergeableFields: string[];
      resolutionStrategy: 'timestamp' | 'merge' | 'custom';
    }
  ): any {
    if (analysis.resolutionStrategy !== 'merge' || analysis.mergeableFields.length === 0) {
      return null; // Can't merge
    }
    
    const incomingData = incoming.data as any;
    const mergedEntity = { ...existing }; // Start with existing entity
    
    // Apply only non-conflicting fields from incoming change
    for (const fieldName of analysis.mergeableFields) {
      if (fieldName in incomingData) {
        const fieldStrategy = this.getFieldConflictStrategy(incoming.table, fieldName);
        
        switch (fieldStrategy) {
          case 'always_merge':
            mergedEntity[fieldName] = this.mergeFieldValues(
              existing[fieldName],
              incomingData[fieldName],
              fieldName,
              incoming.table
            );
            break;
            
          default:
            // Direct assignment for non-conflicting fields
            mergedEntity[fieldName] = incomingData[fieldName];
            break;
        }
      }
    }
    
    // Update metadata to reflect the merge
    mergedEntity.updated_at = new Date().toISOString(); // Set new timestamp for merge
    mergedEntity.clientId = incomingData.clientId || existing.clientId;
    
    return mergedEntity;
  }
  
  /**
   * Determine conflict resolution strategy for specific field
   */
  private getFieldConflictStrategy(tableName: string, fieldName: string): 'always_merge' | 'last_write_wins' | 'timestamp_wins' {
    // Table-specific field strategies for conflict resolution
    // These are business logic rules, intentionally hardcoded
    // TODO: Consider moving to a conflict resolution configuration
    switch (tableName) {
      case 'tasks':
        switch (fieldName) {
          case 'tags':
            return 'always_merge'; // Arrays can often be merged
          case 'title':
          case 'description':
            return 'last_write_wins'; // Content should prefer newer
          case 'status':
          case 'priority':
            return 'last_write_wins'; // Status changes should prefer newer
          case 'dueDate':
          case 'startDate':
            return 'timestamp_wins'; // Dates can be overridden if no conflict
          default:
            return 'timestamp_wins';
        }
        
      case 'projects':
        switch (fieldName) {
          case 'name':
          case 'description':
            return 'last_write_wins';
          default:
            return 'timestamp_wins';
        }
        
      case 'users':
        switch (fieldName) {
          case 'name':
          case 'email':
            return 'last_write_wins';
          default:
            return 'timestamp_wins';
        }
        
      case 'entity_dependencies':
        switch (fieldName) {
          case 'type':
            return 'last_write_wins'; // Dependency type changes should prefer newer
          case 'lag_time':
          case 'lag_days':
            return 'timestamp_wins'; // Lag values can be overridden if no conflict
          default:
            return 'timestamp_wins';
        }
        
      default:
        return 'timestamp_wins';
    }
  }
  
  /**
   * Check if a field was modified since a given timestamp
   * This is a simplified version - in practice, you might want per-field timestamps
   */
  private wasFieldModifiedSince(existing: any, fieldName: string, sinceTimestamp: string): boolean {
    // For now, we assume if the entity was updated since the original timestamp,
    // then the field might have been modified
    const existingTimestamp = new Date(existing.updatedAt || 0);
    const sinceTime = new Date(sinceTimestamp);
    
    return existingTimestamp > sinceTime;
  }
  
  /**
   * Merge two field values using field-specific logic
   */
  private mergeFieldValues(existingValue: any, incomingValue: any, fieldName: string, tableName: string): any {
    // Handle array merging (e.g., tags)
    if (Array.isArray(existingValue) && Array.isArray(incomingValue)) {
      // Merge arrays, removing duplicates
      const mergedArray = [...existingValue];
      for (const item of incomingValue) {
        if (!mergedArray.includes(item)) {
          mergedArray.push(item);
        }
      }
      return mergedArray;
    }
    
    // For non-array fields, prefer the incoming value if it's different
    if (JSON.stringify(existingValue) !== JSON.stringify(incomingValue)) {
      return incomingValue;
    }
    
    return existingValue;
  }
} 
// Helper to ensure we always have a valid TableChange
function ensureTableChange(change: TableChange | undefined): TableChange {
  if (!change) {
    throw new Error('Invalid change object');
  }
  return change;
}
