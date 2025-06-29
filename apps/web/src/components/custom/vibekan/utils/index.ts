/**
 * VibeKan Utility Functions
 */

import type { VibeKanConfig, KanbanColumn, WithId } from '../types'

/**
 * Create a typed VibeKan configuration
 * Helps with type inference and provides better IDE support
 */
export function createVibeKanConfig<TEntity extends WithId, TStatus = string>(
  config: VibeKanConfig<TEntity, TStatus>
): VibeKanConfig<TEntity, TStatus> {
  return config
}

/**
 * Create column definitions from an enum or object
 * @example
 * const columns = createColumnsFromEnum(TaskStatus, {
 *   OPEN: { title: 'Open', id: 'open' },
 *   IN_PROGRESS: { title: 'In Progress', id: 'in_progress' },
 *   COMPLETED: { title: 'Completed', id: 'completed' }
 * })
 */
export function createColumnsFromEnum<TEnum extends Record<string, string>>(
  enumObj: TEnum,
  mapping: Record<keyof TEnum, { title: string; id: string }>
): KanbanColumn<TEnum[keyof TEnum]>[] {
  return Object.entries(mapping).map(([enumKey, config]) => ({
    id: config.id,
    title: config.title,
    status: enumObj[enumKey] as TEnum[keyof TEnum]
  }))
}

/**
 * Create a simple status-to-column-id mapper
 */
export function createStatusToColumnMapper<TStatus extends string | number>(
  statusColumnMap: Record<TStatus, string>
): (status: TStatus) => string {
  return (status: TStatus) => statusColumnMap[status] || Object.values(statusColumnMap)[0]
}

/**
 * Create a column-id-to-status mapper
 */
export function createColumnToStatusMapper<TStatus extends string | number>(
  columnStatusMap: Record<string, TStatus>
): (columnId: string) => TStatus {
  return (columnId: string) => {
    const status = columnStatusMap[columnId]
    if (status === undefined) {
      throw new Error(`No status mapping found for column: ${columnId}`)
    }
    return status
  }
}