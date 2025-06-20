/**
 * VibeGridHeader - Table Header Component
 * 
 * Extracted from VibeGridNative for better modularity
 * Handles global search and displays search results count
 */

import React from 'react'
import { cn } from '@/lib/utils'
import type { VibeGridHeaderProps } from '../../types'
import { SmartGlobalSearch } from './SmartGlobalSearch'

export const VibeGridHeader: React.FC<VibeGridHeaderProps> = ({
  enableGlobalSearch,
  globalFilter,
  onGlobalFilterChange,
  filteredRowCount,
  totalRowCount,
  className
}) => {
  if (!enableGlobalSearch) return null
  
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <SmartGlobalSearch
        value={globalFilter}
        onChange={onGlobalFilterChange}
        className="w-80 max-w-sm"
      />
      
      {globalFilter && (
        <div className="text-sm text-muted-foreground">
          Found {filteredRowCount} of {totalRowCount} entries
        </div>
      )}
    </div>
  )
} 