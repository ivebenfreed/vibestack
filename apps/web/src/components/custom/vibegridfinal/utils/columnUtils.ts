/**
 * Column Utilities - Content-stable + User-resizable Column Sizing
 * 
 * Column sizing configuration optimized for different cell types
 * Ensures consistent and performant column behavior
 */

import type { CellType } from '../types'

// ============================================================================
// Column Sizing Configuration - Content-stable + User-resizable
// ============================================================================

export interface ColumnSizing {
  size: number
  minSize: number
  maxSize: number
}

export const getColumnSizing = (cellType: CellType): ColumnSizing => {
  switch (cellType) {
    case 'enum':
      return { size: 120, minSize: 80, maxSize: 180 } // Status/Priority badges
    case 'boolean':
      return { size: 80, minSize: 60, maxSize: 120 } // Yes/No toggles
    case 'date':
      return { size: 140, minSize: 100, maxSize: 200 } // Date/time stamps
    case 'uuid':
      return { size: 100, minSize: 80, maxSize: 140 } // Short IDs
    case 'number':
      return { size: 80, minSize: 60, maxSize: 120 } // Numeric values
    case 'relationship-single':
      return { size: 150, minSize: 100, maxSize: 250 } // Person names
    case 'relationship-multi':
      return { size: 180, minSize: 120, maxSize: 300 } // Multiple relationships
    case 'json':
      return { size: 250, minSize: 150, maxSize: 400 } // Complex data
    case 'text':
    default:
      return { size: 200, minSize: 100, maxSize: 400 } // Standard text content
  }
}

// ============================================================================
// Column Enhancement Utilities
// ============================================================================

export const enhanceColumnsWithSizing = <T>(columns: any[], relationshipData: any = {}, onSave?: any) => {
  return columns.map(column => {
    const cellType = column.meta?.cellType || 'text'
    const sizing = getColumnSizing(cellType)
    
    return {
      ...column,
      // Apply content-stable column sizing
      size: column.size ?? sizing.size,
      minSize: column.minSize ?? sizing.minSize,
      maxSize: column.maxSize ?? sizing.maxSize,
      // Universal cell renderer (will be set by main component)
      cell: column.cell
    }
  })
}

// ============================================================================
// Column Helper Functions
// ============================================================================

export const formatFieldLabel = (fieldName: string): string => {
  return fieldName
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
    .trim()
}

export const getColumnId = (column: any): string => {
  return column.id || column.accessorKey || 'unknown'
}

export const isSystemField = (columnId: string): boolean => {
  return ['id', 'createdAt', 'updatedAt', 'clientId'].includes(columnId)
}

export const isEditableColumn = (column: any): boolean => {
  const meta = column.meta || {}
  return meta.config?.editable !== false && !meta.systemField
} 