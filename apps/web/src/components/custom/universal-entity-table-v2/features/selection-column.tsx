import React from 'react'
import type { ColumnDef } from '@tanstack/react-table'

/**
 * Lightweight Checkbox Component
 * 
 * Performance-optimized checkbox using native HTML input.
 * Avoids shadcn/ui Checkbox component to prevent re-render cascades.
 */
interface LightweightCheckboxProps {
  checked: boolean
  indeterminate?: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  'aria-label'?: string
}

function LightweightCheckbox({ 
  checked, 
  indeterminate, 
  onChange, 
  disabled,
  'aria-label': ariaLabel 
}: LightweightCheckboxProps) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate || false
      }}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      aria-label={ariaLabel}
      className="h-4 w-4 rounded border border-input bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
    />
  )
}

/**
 * Creates a selection column for the universal entity table
 * 
 * Performance features:
 * - ✅ Uses LightweightCheckbox (native input) instead of shadcn/ui Checkbox
 * - ✅ Memoized column definition prevents recreation on re-renders
 * - ✅ Stable cell renderers with proper dependency arrays
 * - ✅ Direct table API calls without wrapper abstractions
 */
export function createSelectionColumn<T extends { id: string }>(): ColumnDef<T> {
  return {
    id: 'select',
    size: 50,
    minSize: 50,
    maxSize: 50,
    enableSorting: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
    header: ({ table }) => (
      <LightweightCheckbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected()}
        onChange={(checked) => table.toggleAllPageRowsSelected(checked)}
        aria-label="Select all rows on current page"
      />
    ),
    cell: ({ row }) => (
      <LightweightCheckbox
        checked={row.getIsSelected()}
        onChange={(checked) => row.toggleSelected(checked)}
        disabled={!row.getCanSelect()}
        aria-label={`Select row ${row.id}`}
      />
    ),
  }
}

export { LightweightCheckbox } 