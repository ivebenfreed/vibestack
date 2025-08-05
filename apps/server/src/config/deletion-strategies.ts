import type { DeletionStrategy } from '../lib/universal-entity-deleter';

/**
 * Configuration for entity deletion strategies across the application.
 * This allows customizing how relationships are handled when deleting entities.
 */

/**
 * Default deletion strategies for common entities
 */
export const DEFAULT_DELETION_STRATEGIES = {
  /** Default strategy for all entities unless overridden */
  default: {
    foreignKeyStrategy: 'SET_NULL',
    junctionStrategy: 'CASCADE'
  } as DeletionStrategy,

  /** Strategy when deleting users */
  userDeletion: {
    tasks: {
      foreignKeyStrategy: 'SET_NULL', // Unassign tasks
      junctionStrategy: 'CASCADE'
    },
    projects: {
      foreignKeyStrategy: 'TRANSFER_OWNERSHIP', // Transfer to another admin
      junctionStrategy: 'CASCADE'
    },
    comments: {
      foreignKeyStrategy: 'SET_NULL', // Anonymize comments
      junctionStrategy: 'CASCADE'
    }
  } as Record<string, DeletionStrategy>,

  /** Strategy when deleting projects */
  projectDeletion: {
    tasks: {
      foreignKeyStrategy: 'CASCADE', // Delete all tasks in the project
      junctionStrategy: 'CASCADE'
    },
    comments: {
      foreignKeyStrategy: 'CASCADE', // Delete all project comments
      junctionStrategy: 'CASCADE'
    }
  } as Record<string, DeletionStrategy>,

  /** Strategy when deleting tasks */
  taskDeletion: {
    comments: {
      foreignKeyStrategy: 'CASCADE', // Delete task comments
      junctionStrategy: 'CASCADE'
    },
    entity_dependencies: {
      foreignKeyStrategy: 'CASCADE', // Delete entity dependencies when task is deleted
      junctionStrategy: 'CASCADE'
    }
  } as Record<string, DeletionStrategy>
} as const;

/**
 * Business rules for deletion operations
 */
export const DELETION_BUSINESS_RULES = {
  /** Entities that should prevent deletion if they have certain relationships */
  restrictionRules: [
    {
      entity: 'users',
      restrictIf: [
        {
          relatedEntity: 'projects',
          field: 'ownerId',
          condition: 'NO_OTHER_ADMIN_EXISTS',
          message: 'Cannot delete the last admin user who owns projects'
        }
      ]
    }
  ],

  /** Entities that require special handling */
  specialHandling: [
    {
      entity: 'users',
      type: 'REQUIRE_TRANSFER_TARGET',
      affectedEntities: ['projects'],
      message: 'User owns projects - specify transfer target'
    }
  ]
} as const;

/**
 * Audit configuration for deletion operations
 */
export const DELETION_AUDIT_CONFIG = {
  /** Always log these entity deletions */
  alwaysAudit: ['users', 'projects'],
  
  /** Log details for these operations */
  detailedLogging: ['TRANSFER', 'CASCADE'],
  
  /** Include relationship counts in audit logs */
  includeRelationshipCounts: true,
  
  /** Retention period for deletion audit logs (in days) */
  auditRetentionDays: 365
} as const;

/**
 * Performance configuration for deletion operations
 */
export const DELETION_PERFORMANCE_CONFIG = {
  /** Maximum records to process in a single batch */
  batchSize: 1000,
  
  /** Timeout for deletion operations (in milliseconds) */
  operationTimeout: 300000, // 5 minutes
  
  /** Enable parallel processing for independent operations */
  enableParallelProcessing: true,
  
  /** Maximum parallel operations */
  maxParallelOperations: 5
} as const;

/**
 * Helper function to get deletion strategy for a specific scenario
 */
export function getDeletionStrategy(
  entityType: 'users' | 'projects' | 'tasks' | 'entity_dependencies',
  customStrategies?: Record<string, DeletionStrategy>
): Record<string, DeletionStrategy> {
  switch (entityType) {
    case 'users':
      return { ...DEFAULT_DELETION_STRATEGIES.userDeletion, ...customStrategies };
    case 'projects':
      return { ...DEFAULT_DELETION_STRATEGIES.projectDeletion, ...customStrategies };
    case 'tasks':
      return { ...DEFAULT_DELETION_STRATEGIES.taskDeletion, ...customStrategies };
    case 'entity_dependencies':
      return { default: DEFAULT_DELETION_STRATEGIES.default, ...customStrategies };
    default:
      return { default: DEFAULT_DELETION_STRATEGIES.default, ...customStrategies };
  }
}

/**
 * Helper function to validate deletion strategy configuration
 */
export function validateDeletionStrategy(
  strategy: Record<string, DeletionStrategy>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [entity, config] of Object.entries(strategy)) {
    // Validate TRANSFER_OWNERSHIP has transferTarget
    if (config.foreignKeyStrategy === 'TRANSFER_OWNERSHIP' && !config.transferTarget) {
      errors.push(`Entity '${entity}' uses TRANSFER_OWNERSHIP but no transferTarget specified`);
    }

    // Validate strategy values
    const validForeignKeyStrategies = ['SET_NULL', 'CASCADE', 'TRANSFER_OWNERSHIP', 'RESTRICT'];
    if (!validForeignKeyStrategies.includes(config.foreignKeyStrategy)) {
      errors.push(`Entity '${entity}' has invalid foreignKeyStrategy: ${config.foreignKeyStrategy}`);
    }

    const validJunctionStrategies = ['CASCADE', 'RESTRICT'];
    if (!validJunctionStrategies.includes(config.junctionStrategy)) {
      errors.push(`Entity '${entity}' has invalid junctionStrategy: ${config.junctionStrategy}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Helper function to create safe deletion strategies based on environment
 */
export function createSafeDeletionStrategy(
  environment: 'development' | 'staging' | 'production'
): Record<string, DeletionStrategy> {
  switch (environment) {
    case 'development':
      // More permissive in development
      return {
        default: {
          foreignKeyStrategy: 'CASCADE',
          junctionStrategy: 'CASCADE'
        }
      };

    case 'staging':
      // Balanced approach for testing
      return {
        default: {
          foreignKeyStrategy: 'SET_NULL',
          junctionStrategy: 'CASCADE'
        }
      };

    case 'production':
      // Most conservative in production
      return {
        default: {
          foreignKeyStrategy: 'RESTRICT',
          junctionStrategy: 'RESTRICT'
        }
      };

    default:
      return { default: DEFAULT_DELETION_STRATEGIES.default };
  }
}