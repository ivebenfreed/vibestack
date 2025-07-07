/**
 * PageSizeSelector - Page Size Selection Component
 * 
 * Extracted from VibeGridNative pagination for better modularity
 * Uses shadcn Select components for consistent UX
 */

import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { PageSizeSelectorProps } from '../../types'

export const PageSizeSelector: React.FC<PageSizeSelectorProps> = ({
  table,
  pageSizeOptions
}) => (
  <div className="flex items-center gap-2">
    <span className="text-sm text-muted-foreground">Show:</span>
    <Select
      value={String(table.getState().pagination.pageSize)}
      onValueChange={(value) => table.setPageSize(Number(value))}
    >
      <SelectTrigger className="w-20 h-8 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {pageSizeOptions.map(size => (
          <SelectItem key={size} value={String(size)}>
            {size}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <span className="text-sm text-muted-foreground">per page</span>
  </div>
) 