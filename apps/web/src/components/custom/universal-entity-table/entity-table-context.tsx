import React, { createContext, useMemo } from 'react'
import { ObjectLiteral } from 'typeorm'

export interface TableContextValue<T extends ObjectLiteral = any> {
  // Service operations
  service?: {
    create?: (data: Partial<T>) => Promise<T>
    update?: (id: string, data: Partial<T>) => Promise<T>
    delete?: (id: string) => Promise<void>
    bulkUpdate?: (ids: string[], data: Partial<T>) => Promise<void>
    bulkDelete?: (ids: string[]) => Promise<void>
  }
  
  // Table configuration
  entityType: string
  editableColumns?: string[]
  enableOptimisticUpdates: boolean
  
  // Event handlers
  onEntityCreated?: (entity: T) => void
  onEntityUpdated?: (entity: T) => void
  onEntityDeleted?: (id: string) => void
  
  // Update handler for cells
  updateCell: (rowId: string, columnId: string, value: any) => Promise<void>
}

export const TableContext = createContext<TableContextValue | null>(null)

interface TableProviderProps<T extends ObjectLiteral> {
  children: React.ReactNode
  value: TableContextValue<T>
}

export function TableProvider<T extends ObjectLiteral>({ 
  children, 
  value 
}: TableProviderProps<T>) {
  const contextValue = useMemo(() => value, [value])
  
  return (
    <TableContext value={contextValue}>
      {children}
    </TableContext>
  )
}

/**
 * Hook to access table context using React 19's use()
 * Can be called conditionally unlike traditional hooks
 */
export function useTableContext<T extends ObjectLiteral = any>(): TableContextValue<T> {
  const context = React.use(TableContext)
  if (!context) {
    throw new Error('useTableContext must be used within a TableProvider')
  }
  return context as TableContextValue<T>
} 