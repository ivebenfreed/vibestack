/**
 * PaginationControls - Pagination Navigation Component
 * 
 * Extracted from VibeGridNative pagination for better modularity
 * Provides first, previous, next, last navigation controls
 */

import React from 'react'
import { Button } from 'react-aria-components'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import type { PaginationControlsProps } from '../../types'

export const PaginationControls: React.FC<PaginationControlsProps> = ({ table }) => (
  <div className="flex items-center gap-1">
    <Button
      onPress={() => table.setPageIndex(0)}
      isDisabled={!table.getCanPreviousPage()}
      className="p-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      aria-label="First page"
    >
      <ChevronsLeft className="h-4 w-4" />
    </Button>
    
    <Button
      onPress={() => table.previousPage()}
      isDisabled={!table.getCanPreviousPage()}
      className="px-3 py-1.5 text-sm bg-background text-foreground border border-border hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
      aria-label="Previous page"
    >
      Previous
    </Button>
    
    <span className="px-3 py-1.5 text-sm text-muted-foreground">
      Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
    </span>
    
    <Button
      onPress={() => table.nextPage()}
      isDisabled={!table.getCanNextPage()}
      className="px-3 py-1.5 text-sm bg-background text-foreground border border-border hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
      aria-label="Next page"
    >
      Next
    </Button>
    
    <Button
      onPress={() => table.setPageIndex(table.getPageCount() - 1)}
      isDisabled={!table.getCanNextPage()}
      className="p-1.5 rounded-md border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      aria-label="Last page"
    >
      <ChevronsRight className="h-4 w-4" />
    </Button>
  </div>
) 