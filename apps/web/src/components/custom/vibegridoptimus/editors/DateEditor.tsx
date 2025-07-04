import React, { useState } from 'react'
import { format } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { CalendarIcon, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BaseEntity, OptimusColumn } from '../types'
import { useEditorBehavior } from '../hooks/useEditorBehavior'
import { EDITOR_BEHAVIORS } from '../types/editor'

interface DateEditorProps<TEntity extends BaseEntity> {
  row: TEntity
  column: OptimusColumn<TEntity>
  onRowChange: (row: TEntity) => void
  onClose: (commitChanges?: boolean) => void
  onUpdate?: (id: string, column: string, value: any) => Promise<void>
}

/**
 * Rich date editor for renderEditCell
 * Calendar picker with proper ISO string handling
 * Uses centralized behavior hook for consistent edit patterns
 */
export function DateEditor<TEntity extends BaseEntity>({
  row,
  column,
  onRowChange,
  onClose,
  onUpdate
}: DateEditorProps<TEntity>) {
  const value = row[column.key]
  const config = column.config || {}
  const [open, setOpen] = useState(true)
  const initialDate = React.useMemo(() => {
    if (!value) return undefined
    try {
      const d = new Date(value)
      return isNaN(d.getTime()) ? undefined : d
    } catch {
      return undefined
    }
  }, [value])
  
  const [date, setDate] = useState<Date | undefined>(initialDate)
  
  // Parse min/max dates from config
  const minDate = config.dateMin ? new Date(config.dateMin) : undefined
  const maxDate = config.dateMax ? new Date(config.dateMax) : undefined
  
  // Use centralized editor behavior
  const behavior = useEditorBehavior({
    config: EDITOR_BEHAVIORS.date,
    onCommit: (value?: any) => {
      const dateValue = value !== undefined ? value : date
      console.log('[DateEditor] 💾 Committing date:', dateValue)
      // Apply changes and close
      const updatedRow = {
        ...row,
        [column.key]: dateValue || null
      } as TEntity
      onRowChange(updatedRow)
      onClose(true)
    },
    onCancel: () => {
      console.log('[DateEditor] ❌ Cancelling edit')
      onClose(false)
    },
    onUpdate,
    rowId: row.id as string,
    fieldKey: column.key as string,
    initialValue: initialDate,
    currentValue: date
  })
  
  const handleSelect = (newDate: Date | undefined) => {
    console.log('[DateEditor] 📅 Selected date:', newDate)
    setDate(newDate)
    
    // Update grid state immediately for live preview
    const updatedRow = {
      ...row,
      [column.key]: newDate || null
    } as TEntity
    
    onRowChange(updatedRow)
    // Use centralized immediate commit with new value
    behavior.handleCommitWithSave(newDate)
  }
  
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDate(undefined)
    onRowChange({
      ...row,
      [column.key]: null
    } as TEntity)
    // Clear and commit
    behavior.handleCommitWithSave(null)
  }
  
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      // When closing popover without selection, use behavior's commit logic
      behavior.handleCommit()
    }
  }
  
  
  return (
    <div className="absolute inset-0 z-50">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <div 
            className="w-full h-full cursor-pointer bg-transparent border-0 outline-0 opacity-0"
            tabIndex={0}
            autoFocus
            onKeyDown={behavior.handleKeyDown}
          />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" side="bottom">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            disabled={(day) => {
              if (minDate && day < minDate) return true
              if (maxDate && day > maxDate) return true
              return false
            }}
            initialFocus
          />
          <div className="p-3 border-t">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                handleSelect(new Date())
              }}
            >
              Today
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}