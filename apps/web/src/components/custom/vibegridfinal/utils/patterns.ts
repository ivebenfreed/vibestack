/**
 * VibeGridFinal Pattern Enforcement Utilities
 * 
 * Factory functions and validators for ensuring proper DirectUsagePattern usage
 */

import type { BaseEntity, DirectUsagePattern, RelationshipDataProvider } from '../types'
import type { ColumnDef } from '@tanstack/react-table'

/**
 * Factory function to create properly configured DirectUsagePattern
 */
export function createDirectUsagePattern<TEntity extends BaseEntity>(config: {
  useBalancedSelector: () => TEntity[]
  useRelationshipSelectors?: () => Record<string, Array<{ id: string; name?: string; [key: string]: any }>>
  handleSave: (entityId: string, columnId: string, value: any) => Promise<void>
  handleBulkAction?: (selectedIds: string[], action: string) => Promise<void>
  columns: ColumnDef<TEntity>[]
  relationshipData: RelationshipDataProvider
  tableId: string
  enablePersistence?: boolean
}): DirectUsagePattern<TEntity> {
  return {
    ...config,
    __architecturalPattern: 'DIRECT_USAGE_FLATTENED' as const,
    __performanceTarget: '<100ms' as const,
  }
}

/**
 * Validation function to ensure proper usage patterns
 */
export function validateDirectUsagePattern<TEntity extends BaseEntity>(
  pattern: DirectUsagePattern<TEntity>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Validate balanced selector
  if (!pattern.useBalancedSelector) {
    errors.push('Missing useBalancedSelector - required for proper reactivity')
  }
  
  // Validate business logic handlers
  if (!pattern.handleSave) {
    errors.push('Missing handleSave - required for domain integration')
  }
  
  // Validate column configuration
  if (!pattern.columns || pattern.columns.length === 0) {
    errors.push('Missing columns - required for table display')
  }
  
  if (!pattern.relationshipData) {
    errors.push('Missing relationshipData - required for relationship columns')
  }
  
  // Validate persistence configuration
  if (!pattern.tableId) {
    errors.push('Missing tableId - required for XState persistence')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
} 