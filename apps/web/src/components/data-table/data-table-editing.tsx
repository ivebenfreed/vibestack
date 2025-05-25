import React from 'react'
import { CellContext } from '@tanstack/react-table'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon } from '@radix-ui/react-icons'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { useCachedEntities, RelationshipConfig, RELATIONSHIP_CACHE_KEYPREFIX } from './data-table-logic'
import { EditableFilterableRelationshipCell } from './data-table-relationship-cells'

// Extended context for create mode
interface ExtendedCellContext<TData, TValue> extends CellContext<TData, TValue> {
  createMode?: boolean
  createValue?: TValue
  onCreateValueChange?: (value: TValue) => void
  required?: boolean
  onEnterSave?: (fieldName: string, currentValue: TValue) => void
  autoFocus?: boolean
}

// Re-export existing editable cell components with create mode support
export function EditableTextCell<TData, TValue>({
  getValue,
  row,
  column,
  table,
  createMode = false,
  createValue,
  onCreateValueChange,
  required = false,
  onEnterSave,
  autoFocus = false,
}: ExtendedCellContext<TData, TValue>) {
  const initialValue = createMode ? (createValue as string) : (getValue() as string)
  const [value, setValue] = React.useState(initialValue)
  const [isEditing, setIsEditing] = React.useState(false)
  const [isUpdating, setIsUpdating] = React.useState(false)
  const meta = table.options.meta
  const editable = createMode || meta?.editableColumns?.includes(column.id)

  React.useEffect(() => {
    if (createMode) {
      setValue(createValue as string)
    } else {
      setValue(initialValue)
    }
  }, [createMode, createValue, initialValue])

  const onSave = async () => {
    if (createMode) {
      onCreateValueChange?.(value as TValue)
      return
    }
    
    if (value === initialValue) {
      setIsEditing(false)
      return
    }

    // Handle PGlite + live query optimistic update
    setIsUpdating(true)
    try {
      console.log('[EditableTextCell] Updating:', { rowId: row.id, columnId: column.id, value })
      await meta?.onUpdate?.(row.id, column.id, value)
      console.log('[EditableTextCell] Update successful, live query will refresh')
      setIsEditing(false)
      // Live query will automatically update the displayed value
    } catch (error) {
      console.error('[EditableTextCell] Update failed:', error)
      // Revert to original value on error
      setValue(initialValue)
      setIsEditing(false)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (createMode) {
        // Save this cell's value and trigger the record save
        onCreateValueChange?.(value as TValue)
        onEnterSave?.(column.id, value as TValue)
      } else {
        // Regular edit mode - save this cell with optimistic update
        onSave()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (createMode) {
        setValue(createValue as string)
      } else {
        setValue(initialValue)
        setIsEditing(false)
      }
    }
  }

  if (!editable) {
    return <div>{String(value ?? '')}</div>
  }

  if (isEditing || createMode) {
    return (
      <div className="relative">
        <Input
          value={String(value ?? '')}
          onChange={(e) => setValue(e.target.value as any)}
          onBlur={createMode ? undefined : onSave}
          onKeyDown={handleKeyDown}
          className={cn(
            "m-0 w-full",
            createMode ? "h-7 text-xs pr-6" : "h-8",
            required && createMode && "border-orange-200 focus:border-orange-400",
            isUpdating && "opacity-75"
          )}
          autoFocus={createMode ? autoFocus : !createMode}
          placeholder={createMode && required ? "Required" : undefined}
          disabled={isUpdating}
        />
        {required && createMode && (
          <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-orange-500 text-xs font-bold">
            *
          </span>
        )}
        {isUpdating && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "truncate py-2",
        editable && "cursor-pointer hover:bg-muted/30 rounded px-2"
      )}
      onClick={() => setIsEditing(true)}
    >
      {String(value ?? '')}
    </div>
  )
}

export function EditableSelectCell<TData, TValue>({
  getValue,
  row,
  column,
  table,
  options,
  createMode = false,
  createValue,
  onCreateValueChange,
  required = false,
}: ExtendedCellContext<TData, TValue> & { options: { label: string; value: string }[] }) {
  const initialValue = createMode ? (createValue as string) : (getValue() as string)
  const [value, setValue] = React.useState(initialValue)
  const [isUpdating, setIsUpdating] = React.useState(false)
  const meta = table.options.meta
  const editable = createMode || meta?.editableColumns?.includes(column.id)

  React.useEffect(() => {
    if (createMode) {
      setValue(createValue as string)
    } else {
      setValue(initialValue)
    }
  }, [createMode, createValue, initialValue])

  const onSave = async (newValue: string) => {
    if (createMode) {
      onCreateValueChange?.(newValue as TValue)
      setValue(newValue as any)
      return
    }
    
    if (newValue === initialValue) return

    // Handle PGlite + live query optimistic update
    setIsUpdating(true)
    try {
      console.log('[EditableSelectCell] Updating:', { rowId: row.id, columnId: column.id, value: newValue })
      await meta?.onUpdate?.(row.id, column.id, newValue)
      console.log('[EditableSelectCell] Update successful, live query will refresh')
      setValue(newValue as any)
      // Live query will automatically update the displayed value
    } catch (error) {
      console.error('[EditableSelectCell] Update failed:', error)
      // Revert to original value on error
      setValue(initialValue as any)
    } finally {
      setIsUpdating(false)
    }
  }

  const currentOption = options.find((option) => option.value === value)
  const displayLabel = currentOption?.label || String(value ?? '')

  if (!editable) {
    return <div>{displayLabel}</div>
  }

  return (
    <div className="relative">
      <Select
        value={String(value ?? '')}
        onValueChange={onSave}
        disabled={isUpdating}
      >
        <SelectTrigger className={cn(
          "w-full truncate border-0 bg-transparent focus:ring-transparent py-0 hover:bg-muted/30 focus:bg-muted/30",
          createMode ? "h-7 text-xs pr-6" : "h-8",
          required && createMode && !value && "border-orange-200",
          isUpdating && "opacity-75"
        )}>
          <SelectValue placeholder={createMode && required ? "Required" : "Select..."}>{displayLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent 
          align="start" 
          className="z-50"
          avoidCollisions={true}
          collisionPadding={8}
        >
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {required && createMode && (
        <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-orange-500 text-xs font-bold">
          *
        </span>
      )}
      {isUpdating && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </div>
  )
}

export function EditableCheckboxCell<TData, TValue>({
  getValue,
  row,
  column,
  table,
  createMode = false,
  createValue,
  onCreateValueChange,
  required = false,
}: ExtendedCellContext<TData, TValue>) {
  const initialValue = createMode ? (createValue as boolean) : (getValue() as boolean)
  const meta = table.options.meta
  const editable = createMode || meta?.editableColumns?.includes(column.id)

  const onToggle = async (checked: boolean) => {
    if (createMode) {
      onCreateValueChange?.(checked as TValue)
      return
    }
    
    if (checked === initialValue) return
    try {
      await meta?.onUpdate?.(row.id, column.id, checked)
    } catch (error) {
      console.error('Failed to update cell:', error)
    }
  }

  if (!editable) {
    return (
      <div className="flex items-center justify-center">
        <Checkbox checked={initialValue} disabled />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center relative">
      <Checkbox
        checked={initialValue}
        onCheckedChange={onToggle}
        className={cn(
          required && createMode && !initialValue && "border-orange-400"
        )}
      />
      {required && createMode && (
        <span className="absolute -right-3 top-1/2 transform -translate-y-1/2 text-orange-500 text-xs font-bold">
          *
        </span>
      )}
    </div>
  )
}

export function EditableDateCell<TData, TValue>({
  getValue,
  row,
  column,
  table,
  createMode = false,
  createValue,
  onCreateValueChange,
  required = false,
}: ExtendedCellContext<TData, TValue>) {
  const initialValue = createMode ? (createValue as Date | null) : (getValue() as Date | null)
  const [date, setDate] = React.useState<Date | undefined>(initialValue || undefined)
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)
  const meta = table.options.meta
  const editable = createMode || meta?.editableColumns?.includes(column.id)

  React.useEffect(() => {
    if (createMode) {
      setDate((createValue as Date) || undefined)
    } else {
      setDate(initialValue || undefined)
    }
  }, [createMode, createValue, initialValue])

  const onSave = async (newDate?: Date) => {
    if (createMode) {
      onCreateValueChange?.((newDate || null) as TValue)
      setDate(newDate)
      setIsPopoverOpen(false)
      return
    }
    
    if (newDate?.getTime() === initialValue?.getTime()) {
      setIsPopoverOpen(false)
      return
    }
    try {
      await meta?.onUpdate?.(row.id, column.id, newDate || null)
      setDate(newDate)
      setIsPopoverOpen(false)
    } catch (error) {
      console.error('Failed to update cell:', error)
      setDate(initialValue || undefined)
      setIsPopoverOpen(false)
    }
  }

  const formattedDate = date ? format(date, 'PPP') : (createMode && required ? 'Required' : 'Not set')

  if (!editable) {
    return <div>{formattedDate}</div>
  }

  return (
    <div className="relative">
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start text-left font-normal hover:bg-muted/30",
              !date && "text-muted-foreground",
              createMode ? "h-7 text-xs pr-6" : "h-8",
              required && createMode && !date && "border-orange-200"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formattedDate}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(newDate) => {
              onSave(newDate)
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {required && createMode && (
        <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-orange-500 text-xs font-bold">
          *
        </span>
      )}
    </div>
  )
}

export function EditableNumberCell<TData, TValue>({
  getValue,
  row,
  column,
  table,
  createMode = false,
  createValue,
  onCreateValueChange,
  required = false,
  onEnterSave,
  autoFocus = false,
}: ExtendedCellContext<TData, TValue>) {
  const initialValue = createMode ? (createValue as number) : (getValue() as number)
  const [value, setValue] = React.useState(initialValue)
  const [isEditing, setIsEditing] = React.useState(false)
  const [isUpdating, setIsUpdating] = React.useState(false)
  const meta = table.options.meta
  const editable = createMode || meta?.editableColumns?.includes(column.id)

  React.useEffect(() => {
    if (createMode) {
      setValue(createValue as number)
    } else {
      setValue(initialValue)
    }
  }, [createMode, createValue, initialValue])

  const onSave = async () => {
    if (createMode) {
      onCreateValueChange?.(value as TValue)
      return
    }
    
    if (value === initialValue) {
      setIsEditing(false)
      return
    }

    // Handle PGlite + live query optimistic update
    setIsUpdating(true)
    try {
      console.log('[EditableNumberCell] Updating:', { rowId: row.id, columnId: column.id, value })
      await meta?.onUpdate?.(row.id, column.id, value)
      console.log('[EditableNumberCell] Update successful, live query will refresh')
      setIsEditing(false)
      // Live query will automatically update the displayed value
    } catch (error) {
      console.error('[EditableNumberCell] Update failed:', error)
      // Revert to original value on error
      setValue(initialValue)
      setIsEditing(false)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (createMode) {
        // Save this cell's value and trigger the record save
        onCreateValueChange?.(value as TValue)
        onEnterSave?.(column.id, value as TValue)
      } else {
        // Regular edit mode - save this cell with optimistic update
        onSave()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (createMode) {
        setValue(createValue as number)
      } else {
        setValue(initialValue)
        setIsEditing(false)
      }
    }
  }

  if (!editable) {
    return <div>{String(value ?? '')}</div>
  }

  if (isEditing || createMode) {
    return (
      <div className="relative">
        <Input
          type="number"
          value={String(value ?? '')}
          onChange={(e) => setValue(Number(e.target.value) as any)}
          onBlur={createMode ? undefined : onSave}
          onKeyDown={handleKeyDown}
          className={cn(
            "m-0 w-full",
            createMode ? "h-7 text-xs pr-6" : "h-8",
            required && createMode && "border-orange-200 focus:border-orange-400",
            isUpdating && "opacity-75"
          )}
          autoFocus={createMode ? autoFocus : !createMode}
          placeholder={createMode && required ? "Required" : undefined}
          disabled={isUpdating}
        />
        {required && createMode && (
          <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-orange-500 text-xs font-bold">
            *
          </span>
        )}
        {isUpdating && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "truncate py-2",
        editable && "cursor-pointer hover:bg-muted/30 rounded px-2"
      )}
      onClick={() => setIsEditing(true)}
    >
      {String(value ?? '')}
    </div>
  )
}

// Use the enhanced filterable version as the default
export const EditableRelationshipCell = EditableFilterableRelationshipCell 