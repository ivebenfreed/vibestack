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

// Extended context for create mode support
interface ExtendedCellContext<TData, TValue> extends CellContext<TData, TValue> {
  createMode?: boolean
  createValue?: TValue
  onCreateValueChange?: (value: TValue) => void
  required?: boolean
  onEnterSave?: (fieldName: string, currentValue: TValue) => void
  autoFocus?: boolean
  optimisticUpdates?: boolean
}

/**
 * Editable Text Cell Component
 * Supports both inline editing and create mode
 */
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
  optimisticUpdates = true,
}: ExtendedCellContext<TData, TValue>) {
  const initialValue = createMode ? (createValue as string) : (getValue() as string)
  const [value, setValue] = React.useState(initialValue || '')
  const [isEditing, setIsEditing] = React.useState(false)
  const [isUpdating, setIsUpdating] = React.useState(false)
  const meta = table.options.meta
  const editable = createMode || meta?.editableColumns?.includes(column.id)

  React.useEffect(() => {
    if (createMode) {
      setValue(createValue as string || '')
    } else {
      setValue(initialValue || '')
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

    if (optimisticUpdates) {
      // Optimistic update pattern - update UI immediately
      setIsEditing(false)
      
      // Fire and forget the async update
      if (meta?.onUpdate) {
        meta.onUpdate(row.id, column.id, value).then(() => {
          console.log('[EditableTextCell] Update successful')
        }).catch((error) => {
          console.error('[EditableTextCell] Update failed:', error)
          // Revert to original value on error
          setValue(initialValue || '')
        })
      }
    } else {
      // Loading state behavior
      setIsUpdating(true)
      try {
        await meta?.onUpdate?.(row.id, column.id, value)
        setIsEditing(false)
      } catch (error) {
        console.error('[EditableTextCell] Update failed:', error)
        setValue(initialValue || '')
        setIsEditing(false)
      } finally {
        setIsUpdating(false)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (createMode) {
        onCreateValueChange?.(value as TValue)
        onEnterSave?.(column.id, value as TValue)
      } else {
        onSave()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (createMode) {
        setValue(createValue as string || '')
      } else {
        setValue(initialValue || '')
        setIsEditing(false)
      }
    }
  }

  if (!editable) {
    return <div className="truncate">{String(value)}</div>
  }

  if (isEditing || createMode) {
    return (
      <div className="relative">
        <Input
          value={String(value)}
          onChange={(e) => setValue(e.target.value as any)}
          onBlur={createMode ? undefined : onSave}
          onKeyDown={handleKeyDown}
          className={cn(
            "m-0 w-full",
            createMode ? "h-7 text-xs pr-6" : "h-8",
            required && createMode && "border-orange-200 focus:border-orange-400",
            isUpdating && "opacity-75"
          )}
          autoFocus={createMode ? autoFocus : true}
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
      {String(value)}
    </div>
  )
}

/**
 * Editable Select Cell Component
 * For enum values and dropdown selections
 */
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
  optimisticUpdates = true,
}: ExtendedCellContext<TData, TValue> & { options: { label: string; value: string }[] }) {
  const initialValue = createMode ? (createValue as string) : (getValue() as string)
  const [value, setValue] = React.useState(initialValue || '')
  const [isUpdating, setIsUpdating] = React.useState(false)
  const meta = table.options.meta
  const editable = createMode || meta?.editableColumns?.includes(column.id)

  React.useEffect(() => {
    if (createMode) {
      setValue(createValue as string || '')
    } else {
      setValue(initialValue || '')
    }
  }, [createMode, createValue, initialValue])

  const onSave = async (newValue: string) => {
    if (createMode) {
      onCreateValueChange?.(newValue as TValue)
      return
    }
    
    if (newValue === initialValue) {
      return
    }

    if (optimisticUpdates) {
      setValue(newValue)
      if (meta?.onUpdate) {
        meta.onUpdate(row.id, column.id, newValue).catch((error) => {
          console.error('[EditableSelectCell] Update failed:', error)
          setValue(initialValue || '')
        })
      }
    } else {
      setIsUpdating(true)
      try {
        await meta?.onUpdate?.(row.id, column.id, newValue)
        setValue(newValue)
      } catch (error) {
        console.error('[EditableSelectCell] Update failed:', error)
      } finally {
        setIsUpdating(false)
      }
    }
  }

  if (!editable) {
    const option = options.find(opt => opt.value === value)
    return <div className="truncate">{option?.label || value}</div>
  }

  const selectedOption = options.find(opt => opt.value === value)

  return (
    <div className="relative">
      <Select
        value={value}
        onValueChange={onSave}
        disabled={isUpdating}
      >
        <SelectTrigger className={cn(
          "w-full border-none shadow-none",
          createMode ? "h-7 text-xs" : "h-8",
          createMode && !value && required && "border border-orange-200"
        )}>
          <SelectValue placeholder={
            createMode && required ? "Required *" : "Select..."
          }>
            {selectedOption?.label || value}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isUpdating && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </div>
  )
}

/**
 * Editable Checkbox Cell Component
 * For boolean values
 */
export function EditableCheckboxCell<TData, TValue>({
  getValue,
  row,
  column,
  table,
  createMode = false,
  createValue,
  onCreateValueChange,
  optimisticUpdates = true,
}: ExtendedCellContext<TData, TValue>) {
  const initialValue = createMode ? (createValue as boolean) : (getValue() as boolean)
  const [value, setValue] = React.useState(initialValue || false)
  const [isUpdating, setIsUpdating] = React.useState(false)
  const meta = table.options.meta
  const editable = createMode || meta?.editableColumns?.includes(column.id)

  const onToggle = async (checked: boolean) => {
    if (createMode) {
      setValue(checked)
      onCreateValueChange?.(checked as TValue)
      return
    }

    if (optimisticUpdates) {
      setValue(checked)
      if (meta?.onUpdate) {
        meta.onUpdate(row.id, column.id, checked).catch((error) => {
          console.error('[EditableCheckboxCell] Update failed:', error)
          setValue(!checked)
        })
      }
    } else {
      setIsUpdating(true)
      try {
        await meta?.onUpdate?.(row.id, column.id, checked)
        setValue(checked)
      } catch (error) {
        console.error('[EditableCheckboxCell] Update failed:', error)
      } finally {
        setIsUpdating(false)
      }
    }
  }

  if (!editable) {
    return (
      <div className="flex items-center">
        <Checkbox checked={value} disabled />
      </div>
    )
  }

  return (
    <div className="flex items-center">
      <Checkbox
        checked={value}
        onCheckedChange={onToggle}
        disabled={isUpdating}
      />
      {isUpdating && (
        <div className="ml-2 h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      )}
    </div>
  )
}

/**
 * Editable Date Cell Component
 * For date values with calendar picker
 */
export function EditableDateCell<TData, TValue>({
  getValue,
  row,
  column,
  table,
  createMode = false,
  createValue,
  onCreateValueChange,
  required = false,
  optimisticUpdates = true,
}: ExtendedCellContext<TData, TValue>) {
  const initialValue = createMode ? (createValue as Date) : (getValue() as Date)
  const [value, setValue] = React.useState<Date | undefined>(initialValue)
  const [isOpen, setIsOpen] = React.useState(false)
  const [isUpdating, setIsUpdating] = React.useState(false)
  const meta = table.options.meta
  const editable = createMode || meta?.editableColumns?.includes(column.id)

  React.useEffect(() => {
    if (createMode) {
      setValue(createValue as Date)
    } else {
      setValue(initialValue)
    }
  }, [createMode, createValue, initialValue])

  const onSave = async (newDate?: Date) => {
    if (createMode) {
      setValue(newDate)
      onCreateValueChange?.(newDate as TValue)
      setIsOpen(false)
      return
    }
    
    if (newDate === initialValue) {
      setIsOpen(false)
      return
    }

    if (optimisticUpdates) {
      setValue(newDate)
      setIsOpen(false)
      if (meta?.onUpdate) {
        meta.onUpdate(row.id, column.id, newDate).catch((error) => {
          console.error('[EditableDateCell] Update failed:', error)
          setValue(initialValue)
        })
      }
    } else {
      setIsUpdating(true)
      try {
        await meta?.onUpdate?.(row.id, column.id, newDate)
        setValue(newDate)
        setIsOpen(false)
      } catch (error) {
        console.error('[EditableDateCell] Update failed:', error)
      } finally {
        setIsUpdating(false)
      }
    }
  }

  if (!editable) {
    return (
      <div className="truncate">
        {value ? format(value, 'MMM dd, yyyy') : '-'}
      </div>
    )
  }

  return (
    <div className="relative">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start text-left font-normal h-8 px-2",
              !value && "text-muted-foreground",
              createMode && "h-7 text-xs",
              createMode && !value && required && "border border-orange-200"
            )}
            disabled={isUpdating}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, 'MMM dd, yyyy') : (
              createMode && required ? "Required *" : "Pick a date"
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onSave}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {isUpdating && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </div>
  )
}

/**
 * Editable Number Cell Component
 * For numeric values
 */
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
  optimisticUpdates = true,
}: ExtendedCellContext<TData, TValue>) {
  const initialValue = createMode ? (createValue as number) : (getValue() as number)
  const [value, setValue] = React.useState(initialValue?.toString() || '')
  const [isEditing, setIsEditing] = React.useState(false)
  const [isUpdating, setIsUpdating] = React.useState(false)
  const meta = table.options.meta
  const editable = createMode || meta?.editableColumns?.includes(column.id)

  React.useEffect(() => {
    if (createMode) {
      setValue(createValue?.toString() || '')
    } else {
      setValue(initialValue?.toString() || '')
    }
  }, [createMode, createValue, initialValue])

  const onSave = async () => {
    const numValue = parseFloat(value)
    
    if (createMode) {
      onCreateValueChange?.(numValue as TValue)
      return
    }
    
    if (numValue === initialValue || (isNaN(numValue) && !initialValue)) {
      setIsEditing(false)
      return
    }

    if (optimisticUpdates) {
      setIsEditing(false)
      if (meta?.onUpdate) {
        meta.onUpdate(row.id, column.id, numValue).catch((error) => {
          console.error('[EditableNumberCell] Update failed:', error)
          setValue(initialValue?.toString() || '')
        })
      }
    } else {
      setIsUpdating(true)
      try {
        await meta?.onUpdate?.(row.id, column.id, numValue)
        setIsEditing(false)
      } catch (error) {
        console.error('[EditableNumberCell] Update failed:', error)
        setValue(initialValue?.toString() || '')
        setIsEditing(false)
      } finally {
        setIsUpdating(false)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (createMode) {
        const numValue = parseFloat(value)
        onCreateValueChange?.(numValue as TValue)
        onEnterSave?.(column.id, numValue as TValue)
      } else {
        onSave()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (createMode) {
        setValue(createValue?.toString() || '')
      } else {
        setValue(initialValue?.toString() || '')
        setIsEditing(false)
      }
    }
  }

  if (!editable) {
    return <div className="truncate text-right">{value}</div>
  }

  if (isEditing || createMode) {
    return (
      <div className="relative">
        <Input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={createMode ? undefined : onSave}
          onKeyDown={handleKeyDown}
          className={cn(
            "m-0 w-full text-right",
            createMode ? "h-7 text-xs pr-6" : "h-8",
            required && createMode && "border-orange-200 focus:border-orange-400",
            isUpdating && "opacity-75"
          )}
          autoFocus={createMode ? autoFocus : true}
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
        "truncate py-2 text-right",
        editable && "cursor-pointer hover:bg-muted/30 rounded px-2"
      )}
      onClick={() => setIsEditing(true)}
    >
      {value}
    </div>
  )
} 