import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type { Table } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { MagnifyingGlassIcon } from '@radix-ui/react-icons'
import { SearchInput } from '../performance/SearchInput'
import { LightweightColumnVisibility } from '../performance/LightweightColumnVisibility'
import type { ColumnVisibilityOption } from '../performance/LightweightColumnVisibility'

export interface EntityTableToolbarProps<T> {
  table: Table<T>
  entityType: string
  searchPlaceholder?: string
  showViewOptions?: boolean
  autoSearch?: boolean
  searchDebounceMs?: number
}

/**
 * Debounce helper hook for performant search
 */
function useDebounced<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Entity Table Toolbar
 * 
 * Performance-optimized toolbar with:
 * - ✅ LightweightTextInput for search (no parent re-renders)
 * - ✅ Memoized column visibility options
 * - ✅ Debounced search to prevent excessive filtering (300ms default)
 * - ✅ Immediate UI updates with delayed table filtering for best UX
 * - ✅ Minimal state updates to prevent cascading re-renders
 * - ✅ Follows TanStack Table performance best practices
 */
export function EntityTableToolbar<T>({
  table,
  entityType,
  searchPlaceholder = 'Search...',
  showViewOptions = true,
  autoSearch = true,
  searchDebounceMs = 300,
}: EntityTableToolbarProps<T>) {
  const [searchValue, setSearchValue] = useState('')
  
  // ✅ PERFORMANCE: Debounce the search value to prevent excessive table filtering
  const debouncedSearchValue = useDebounced(searchValue, searchDebounceMs)
  
  // ✅ PERFORMANCE: Apply debounced search to table filter
  useEffect(() => {
    if (autoSearch) {
      console.log(`🔍 [EntityTableToolbar] Applying debounced filter: "${debouncedSearchValue}"`)
      table.setGlobalFilter(debouncedSearchValue)
    }
  }, [debouncedSearchValue, autoSearch, table])

  // ✅ Memoize column visibility options with proper dependencies
  const columnVisibilityState = table.getState().columnVisibility
  const columnToggleOptions: ColumnVisibilityOption[] = useMemo(() => {
    return table
      .getAllColumns()
      .filter(column => 
        typeof column.accessorFn !== 'undefined' && column.getCanHide()
      )
      .map(column => ({
        id: column.id,
        label: typeof column.columnDef.header === 'string' 
          ? column.columnDef.header 
          : column.id,
        isVisible: column.getIsVisible(),
        toggle: () => column.toggleVisibility(),
      }))
  }, [table, columnVisibilityState])

  // ✅ PERFORMANCE: Stable callback for search input (prevents LightweightTextInput re-renders)
  const handleSearchChange = useCallback((value: string) => {
    console.log(`🔍 [EntityTableToolbar] Search input changed: "${value}"`)
    if (value === '') {
      console.log(`🔍 [EntityTableToolbar] Search cleared`)
    }
    setSearchValue(value)
    // Note: Table filtering happens via debounced effect above
  }, [])

  // ✅ PERFORMANCE: Stable callback for manual search submit
  const handleSearchSubmit = useCallback(() => {
    if (!autoSearch) {
      console.log(`🔍 [EntityTableToolbar] Manual search submit: "${searchValue}"`)
      table.setGlobalFilter(searchValue)
    }
  }, [autoSearch, searchValue, table])

  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex flex-1 items-center space-x-2">
        {/* ✅ Search Input - Using dedicated SearchInput for performance */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <SearchInput
              placeholder={searchPlaceholder}
              value={searchValue}
              onValueChange={handleSearchChange}
              autoFocus={true}
              className="pl-8 max-w-sm"
            />
          </div>
          
          {!autoSearch && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSearchSubmit}
            >
              Search
            </Button>
          )}
        </div>
      </div>

      {/* View Options */}
      {showViewOptions && (
        <LightweightColumnVisibility 
          options={columnToggleOptions}
        />
      )}
    </div>
  )
} 