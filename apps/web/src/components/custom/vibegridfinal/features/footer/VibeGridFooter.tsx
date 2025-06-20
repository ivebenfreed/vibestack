/**
 * VibeGridFooter - Table Footer Component
 * 
 * Extracted from VibeGridNative for better modularity
 * Combines pagination controls, page size selector, and row count display
 */

import React from 'react'
import { cn } from '@/lib/utils'
import type { VibeGridFooterProps } from '../../types'
import { PageSizeSelector } from './PageSizeSelector'
import { PaginationControls } from './PaginationControls'

export const VibeGridFooter: React.FC<VibeGridFooterProps> = ({
  enablePagination,
  table,
  pageSizeOptions,
  filteredRowCount,
  totalRowCount,
  globalFilter,
  className
}) => {
  if (!enablePagination) return null
  
  const { pagination } = table.getState()
  
  return (
    <div className={cn(
      "flex items-center justify-between px-4 py-3 border-t border-border",
      className
    )}>
      {/* Left side - Row count info */}
      <div className="text-sm text-muted-foreground">
        Showing {pagination.pageIndex * pagination.pageSize + 1} to{' '}
        {Math.min(
          (pagination.pageIndex + 1) * pagination.pageSize,
          filteredRowCount
        )}{' '}
        of {filteredRowCount} entries
        {globalFilter && (
          <span className="ml-1">(filtered from {totalRowCount} total)</span>
        )}
      </div>
      
      {/* Right side - Pagination controls */}
      <div className="flex items-center gap-4">
        <PageSizeSelector 
          table={table} 
          pageSizeOptions={pageSizeOptions} 
        />
        <PaginationControls table={table} />
      </div>
    </div>
  )
} 