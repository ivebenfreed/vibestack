import { ColumnDef } from '@tanstack/react-table'
import { ObjectLiteral } from 'typeorm'
import { Checkbox } from '@/components/ui/checkbox'

/**
 * Creates a selection column for bulk actions
 */
export function createSelectionColumn<T extends ObjectLiteral & { id: string }>(): ColumnDef<T, any> {
  return {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 40,
  }
}

/**
 * Creates basic ID column (usually hidden)
 */
export function createIdColumn<T extends ObjectLiteral & { id: string }>(): ColumnDef<T, any> {
  return {
    accessorKey: 'id',
    header: 'ID',
    size: 100,
    enableHiding: true,
    cell: ({ getValue }) => (
      <div className="font-mono text-xs truncate max-w-[100px]">
        {getValue() as string}
      </div>
    ),
  }
}

/**
 * Creates a date column with consistent formatting
 */
export function createDateColumn<T extends ObjectLiteral>(
  key: keyof T,
  header: string,
  options?: {
    size?: number
    format?: 'short' | 'medium' | 'long'
  }
): ColumnDef<T, any> {
  const { size = 120, format = 'short' } = options || {}
  
  const formatOptions: Intl.DateTimeFormatOptions = 
    format === 'short' 
      ? { month: 'short', day: 'numeric' }
      : format === 'medium'
      ? { month: 'short', day: 'numeric', year: 'numeric' }
      : { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }

  return {
    accessorKey: key as string,
    header,
    size,
    cell: ({ getValue }) => {
      const date = getValue() as Date | string | null
      if (!date) return <span className="text-muted-foreground">-</span>
      
      try {
        return new Intl.DateTimeFormat('en-US', formatOptions).format(new Date(date))
      } catch (error) {
        return <span className="text-muted-foreground">Invalid date</span>
      }
    },
  }
}

/**
 * Creates a text column with truncation
 */
export function createTextColumn<T extends ObjectLiteral>(
  key: keyof T,
  header: string,
  options?: {
    size?: number
    minSize?: number
    maxSize?: number
    maxLength?: number
    fontWeight?: 'normal' | 'medium' | 'semibold'
  }
): ColumnDef<T, any> {
  const { 
    size = 200, 
    minSize = 150, 
    maxSize = 400, 
    maxLength = 50,
    fontWeight = 'normal'
  } = options || {}

  const fontClass = {
    normal: '',
    medium: 'font-medium',
    semibold: 'font-semibold'
  }[fontWeight]

  return {
    accessorKey: key as string,
    header,
    size,
    minSize,
    maxSize,
    cell: ({ getValue }) => {
      const value = getValue() as string | null
      if (!value) return <span className="text-muted-foreground">-</span>
      
      const displayValue = maxLength && value.length > maxLength 
        ? `${value.substring(0, maxLength)}...` 
        : value

      return (
        <div className={`truncate ${fontClass}`} title={value}>
          {displayValue}
        </div>
      )
    },
  }
}

export function createEntityTableColumns<T extends ObjectLiteral & { id: string }>(
  entityType: string
): ColumnDef<T, any>[] {
  // Basic fallback columns - in practice you'd use the preset functions
  return [
    createSelectionColumn<T>(),
    createIdColumn<T>(),
    createTextColumn<T>('name' as keyof T, 'Name', { fontWeight: 'medium' }),
    createDateColumn<T>('createdAt' as keyof T, 'Created'),
  ]
} 