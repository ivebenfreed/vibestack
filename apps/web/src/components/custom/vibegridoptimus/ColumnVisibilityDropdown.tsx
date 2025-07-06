import React from 'react'
import { Columns3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface ColumnVisibilityDropdownProps {
  columns: any[]
  hiddenColumns: Set<string>
  onToggleColumn: (columnKey: string) => void
  isRequiredField: (column: any) => boolean
}

export function ColumnVisibilityDropdown({
  columns,
  hiddenColumns,
  onToggleColumn,
  isRequiredField
}: ColumnVisibilityDropdownProps) {
  // Categorize columns
  const requiredColumns = columns.filter(col => isRequiredField(col))
  const systemColumns = columns.filter(col => 
    col.rdgConfig?.businessLogic?.systemField && !isRequiredField(col)
  )
  const businessColumns = columns.filter(col => 
    !col.rdgConfig?.businessLogic?.systemField && !isRequiredField(col)
  )
  
  const hiddenCount = Array.from(hiddenColumns).filter(key => 
    columns.find(col => col.key === key)
  ).length

  const renderColumnItem = (column: any, isRequired: boolean) => {
    const isHidden = hiddenColumns.has(column.key)
    const isChecked = !isHidden
    
    const columnItem = (
      <DropdownMenuItem
        className={`flex items-center space-x-2 ${isRequired ? 'opacity-60' : ''}`}
        onSelect={(e) => e.preventDefault()}
      >
        <Checkbox
          checked={isChecked}
          disabled={isRequired}
          onCheckedChange={() => {
            if (!isRequired) {
              onToggleColumn(column.key)
            }
          }}
        />
        <span className="flex-1 text-sm">
          {column.name || column.key}
        </span>
        {isRequired && (
          <span className="text-xs text-muted-foreground">Required</span>
        )}
      </DropdownMenuItem>
    )

    if (isRequired) {
      return (
        <Tooltip key={column.key}>
          <TooltipTrigger asChild>
            {columnItem}
          </TooltipTrigger>
          <TooltipContent>
            <p>This field is required and cannot be hidden</p>
          </TooltipContent>
        </Tooltip>
      )
    }

    return <div key={column.key}>{columnItem}</div>
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2">
          <Columns3 className="h-4 w-4" />
          <span className="ml-1 text-xs">
            Columns {hiddenCount > 0 && `(${hiddenCount} hidden)`}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Column Visibility</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {requiredColumns.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Required Fields
            </DropdownMenuLabel>
            {requiredColumns.map(col => renderColumnItem(col, true))}
            <DropdownMenuSeparator />
          </>
        )}
        
        {businessColumns.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Business Fields
            </DropdownMenuLabel>
            {businessColumns.map(col => renderColumnItem(col, false))}
          </>
        )}
        
        {systemColumns.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              System Fields
            </DropdownMenuLabel>
            {systemColumns.map(col => renderColumnItem(col, false))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}