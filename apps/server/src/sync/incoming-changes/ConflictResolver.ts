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
      
      if (!data.updated_at) {
        errors.push('Missing required field: updated_at');
      }
      
      // Validate timestamp format
      if (data.updated_at && isNaN(Date.parse(data.updated_at))) {
        errors.push('Invalid timestamp format for updated_at');
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
   * Current: Simple timestamp-based last-write-wins
   * Future: Field-level conflict resolution
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

    const incomingTimestamp = new Date(incoming.updated_at);
    const existingTimestamp = new Date(existing.updated_at);

    // Simple timestamp-based CRDT (last-write-wins)
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
      // Timestamps are equal - use client_id as tiebreaker
      const incomingClientId = (incoming.data as any).client_id || '';
      const existingClientId = existing.client_id || '';
      
      if (incomingClientId > existingClientId) {
        return {
          shouldApply: true,
          reason: 'Timestamp tie broken by client_id'
        };
      } else {
        return {
          shouldApply: false,
          reason: 'Timestamp tie, existing client_id wins'
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
        incomingTimestamp: change.updated_at,
        existingTimestamp: existing?.updated_at,
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

      case 'task_dependencies':
        if (change.operation !== 'delete') {
          if (!data.dependent_task_id) {
            errors.push('Task dependencies require a dependent_task_id field');
          }
          if (!data.dependency_task_id) {
            errors.push('Task dependencies require a dependency_task_id field');
          }
          if (data.dependent_task_id === data.dependency_task_id) {
            errors.push('Task cannot depend on itself');
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

      default:
        syncLogger.warn(`Unknown table for validation: ${change.table}`, {
          table: change.table,
          operation: change.operation
        }, MODULE_NAME);
    }
  }

  /**
   * Future: Field-level conflict resolution
   * This is a placeholder for enhanced CRDT resolution that can handle
   * partial updates and field-specific conflict strategies
   */
  private analyzeFieldLevelConflicts(
    incoming: TableChange,
    existing: any
  ): {
    conflictingFields: string[];
    mergeableFields: string[];
    resolutionStrategy: 'timestamp' | 'merge' | 'custom';
  } {
    // TODO: Implement field-level analysis
    // Different fields might have different conflict resolution strategies:
    // - Timestamps: last-write-wins
    // - Arrays: merge or set operations
    // - Numbers: could use CRDTs like counters
    // - Strings: last-write-wins or operational transforms
    
    return {
      conflictingFields: [],
      mergeableFields: [],
      resolutionStrategy: 'timestamp'
    };
  }

  /**
   * Future: Generate merged entity from conflicting changes
   * This would support partial non-conflicting updates
   */
  private generateMergedEntity(
    incoming: TableChange,
    existing: any,
    resolutionStrategy: any
  ): any {
    // TODO: Implement smart merging based on field-level strategies
    // For now, we use simple last-write-wins at the entity level
    return null;
  }
} 