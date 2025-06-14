import React, { createContext, useContext } from 'react'
import type { BaseEntity, TableContextValue } from './table-types'

/**
 * 🚀 Universal Entity Table Context
 * 
 * ✅ MINIMAL context usage for performance
 * ✅ Only stable references to prevent re-renders
 * ✅ No data passed through context (use direct props instead)
 * ✅ Only configuration and services
 * 
 * Performance Principles:
 * - Keep context value stable with useMemo
 * - Pass data through props, not context
 * - Only essential configuration in context
 * - Avoid changing values that trigger re-renders
 */

// Create context with undefined default (must be wrapped in provider)
const TableContext = createContext<TableContextValue<any> | undefined>(undefined)

/**
 * Table Context Provider Props
 */
interface TableContextProviderProps<T extends BaseEntity> {
  children: React.ReactNode
  value: TableContextValue<T>
}

/**
 * Minimal Table Context Provider
 * 
 * Only provides stable configuration and services.
 * Data should flow through props for performance.
 */
export function TableContextProvider<T extends BaseEntity>({
  children,
  value
}: TableContextProviderProps<T>) {
  return (
    <TableContext.Provider value={value}>
      {children}
    </TableContext.Provider>
  )
}

/**
 * Hook to use table context
 * 
 * @throws Error if used outside of TableContextProvider
 */
export function useTableContext<T extends BaseEntity>(): TableContextValue<T> {
  const context = useContext(TableContext)
  
  if (context === undefined) {
    throw new Error(
      'useTableContext must be used within a TableContextProvider. ' +
      'Make sure your component is wrapped in <TableContextProvider>.'
    )
  }
  
  return context as TableContextValue<T>
}

/**
 * Optional hook that returns undefined if no context
 * 
 * Useful for components that can work with or without table context
 */
export function useOptionalTableContext<T extends BaseEntity>(): TableContextValue<T> | undefined {
  return useContext(TableContext) as TableContextValue<T> | undefined
}

/**
 * HOC for components that need table context
 * 
 * @param Component - Component to wrap
 * @returns Component with injected table context
 */
export function withTableContext<P extends object>(
  Component: React.ComponentType<P & { tableContext: TableContextValue<any> }>
) {
  return React.memo(function WithTableContext(props: P) {
    const tableContext = useTableContext()
    
    return <Component {...props} tableContext={tableContext} />
  })
}

/**
 * Performance Notes:
 * 
 * ✅ Context value should be memoized in parent to prevent re-renders
 * ✅ Only stable configuration values in context
 * ✅ Data flows through props for better performance isolation
 * ✅ Service references are stable between renders
 * ✅ entityType and feature flags are stable strings/booleans
 * 
 * Usage Example:
 * ```tsx
 * const tableContext = useMemo(() => ({
 *   entityType: 'tasks',
 *   enableInlineEdit: true,
 *   enableOptimisticUpdates: true,
 *   service: taskService, // Stable service reference
 *   performanceTracker: performanceTracker // Stable tracker reference
 * }), []) // Empty deps = stable context
 * 
 * return (
 *   <TableContextProvider value={tableContext}>
 *     <UniversalEntityTable data={tasks} columns={columns} />
 *   </TableContextProvider>
 * )
 * ```
 */ 