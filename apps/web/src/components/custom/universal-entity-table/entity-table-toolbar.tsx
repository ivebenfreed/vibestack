import React, { useState } from 'react'
import { ObjectLiteral } from 'typeorm'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MixerHorizontalIcon, Cross2Icon } from '@radix-ui/react-icons'

interface EntityTableToolbarProps<T extends ObjectLiteral = any> {
  table: any
  entityType: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  showViewOptions?: boolean
  enableSearch?: boolean
  autoSearch?: boolean // Use internal search state and automatically filter table
}

export function EntityTableToolbar<T extends ObjectLiteral>({
  table,
  entityType,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  showViewOptions = true,
  enableSearch = true,
  autoSearch = false,
}: EntityTableToolbarProps<T>) {
  const [internalSearchValue, setInternalSearchValue] = useState('')
  const isFiltered = table.getState().columnFilters.length > 0
  
  // Use internal search value if autoSearch is enabled
  const currentSearchValue = autoSearch ? internalSearchValue : searchValue
  
  const handleSearchChange = (value: string) => {
    if (autoSearch) {
      setInternalSearchValue(value)
      // Apply global filter to table
      table.setGlobalFilter(value)
    } else {
      onSearchChange?.(value)
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        {/* Search Input */}
        {enableSearch && (autoSearch || onSearchChange) && (
          <Input
            placeholder={searchPlaceholder}
            value={currentSearchValue}
            onChange={(event) => handleSearchChange(event.target.value)}
            className="h-8 w-[150px] lg:w-[250px]"
          />
        )}

        {/* Clear Filters Button */}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <Cross2Icon className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      {/* View Options */}
      {showViewOptions && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto h-8">
              <MixerHorizontalIcon className="mr-2 h-4 w-4" />
              View
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[150px]">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((column: any) => typeof column.accessorFn !== 'undefined' && column.getCanHide())
              .map((column: any) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
} 