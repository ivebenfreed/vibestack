/**
 * Ultra-Performance Table Editor Portal
 * 
 * React Portal-based editor that floats over table cells:
 * - Zero impact on table render performance
 * - Positioned absolutely over target cell
 * - Full keyboard navigation (Tab, Enter, Escape)
 * - Auto-focus and value selection
 * - Type-aware input components
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'

export interface UltraTableEditorProps {
  /** Current cell value */
  value: any
  /** Field name being edited */
  field: string
  /** Row index for positioning */
  rowIndex: number
  /** Column index for positioning */
  columnIndex: number
  /** Value type for appropriate editor */
  type?: 'string' | 'number' | 'boolean' | 'date' | 'text' | 'select' | 'multiselect'
  /** Options for select/multiselect types */
  options?: Array<{ value: string; label: string }> | string[]
  /** Completion callback */
  onComplete: (newValue: any) => void
  /** Cancel callback */
  onCancel: () => void
}

/**
 * Portal-based cell editor that floats over the table
 * 
 * Performance benefits:
 * - Completely separate from table render tree
 * - No impact on virtualization or cell updates
 * - Positioned using coordinates, not React layout
 * - Auto-cleanup with portals
 */
export function UltraTableEditor({
  value,
  field,
  rowIndex,
  columnIndex,
  type = 'string',
  options = [],
  onComplete,
  onCancel
}: UltraTableEditorProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const [editValue, setEditValue] = useState(value)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  
  // Normalize options array
  const normalizedOptions = options.map(opt => 
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  )

  // Find and position over the target cell
  useEffect(() => {
    const findTargetCell = () => {
      // Find the cell using data attributes
      const cell = document.querySelector(
        `[data-row="${rowIndex}"][data-col="${columnIndex}"][data-field="${field}"]`
      ) as HTMLTableCellElement

      if (cell) {
        const rect = cell.getBoundingClientRect()
        setPosition({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height
        })
        return true
      }
      return false
    }

    // Try immediately, then with a small delay if not found
    if (!findTargetCell()) {
      const timeout = setTimeout(findTargetCell, 10)
      return () => clearTimeout(timeout)
    }
  }, [rowIndex, columnIndex, field])

  // Auto-focus and select text
  useEffect(() => {
    if (inputRef.current && position) {
      inputRef.current.focus()
      
      // Select all text for easy replacement
      if (inputRef.current.select) {
        inputRef.current.select()
      } else if (inputRef.current.setSelectionRange) {
        inputRef.current.setSelectionRange(0, inputRef.current.value.length)
      }
    }
  }, [position])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault()
        if (e.shiftKey && type === 'text') {
          // Allow newlines in text areas with Shift+Enter
          return
        }
        onComplete(editValue)
        break

      case 'Escape':
        e.preventDefault()
        onCancel()
        break

      case 'Tab':
        // Let Tab bubble up for potential table navigation
        onComplete(editValue)
        break
    }
  }, [editValue, type, onComplete, onCancel])

  // Handle clicks outside to complete editing
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onComplete(editValue)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editValue, onComplete])

  // Handle value changes
  const handleValueChange = useCallback((newValue: any) => {
    setEditValue(newValue)
  }, [])

  // Don't render until we have position
  if (!position) return null

  // Render the appropriate input type
  const renderEditor = () => {
    const commonProps = {
      ref: inputRef as any,
      value: String(editValue || ''),
      onChange: (e: any) => handleValueChange(e.target.value),
      onKeyDown: handleKeyDown,
      className: cn(
        'w-full h-full border-2 border-primary shadow-lg',
        'text-sm bg-background',
        'focus-visible:outline-none focus-visible:ring-0'
      )
    }

    switch (type) {
      case 'number':
        return (
          <Input
            {...commonProps}
            type="number"
            onChange={(e) => handleValueChange(parseFloat(e.target.value) || 0)}
          />
        )

      case 'boolean':
        return (
          <div className={cn(
            'flex items-center justify-center',
            'w-full h-full bg-background border-2 border-primary shadow-lg rounded-sm'
          )}>
            <Checkbox
              checked={Boolean(editValue)}
              onCheckedChange={handleValueChange}
              autoFocus
              onKeyDown={handleKeyDown}
            />
          </div>
        )

      case 'date':
        return (
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-full h-full border-2 border-primary shadow-lg',
                  'text-sm bg-background justify-start text-left font-normal',
                  'focus-visible:outline-none focus-visible:ring-0',
                  !editValue && 'text-muted-foreground'
                )}
                onClick={() => setDatePickerOpen(true)}
                onKeyDown={handleKeyDown}
                autoFocus
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {editValue ? format(new Date(editValue), 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={editValue ? new Date(editValue) : undefined}
                onSelect={(date) => {
                  handleValueChange(date)
                  setDatePickerOpen(false)
                  onComplete(date)
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        )

      case 'select':
        return (
          <Select
            value={String(editValue || '')}
            onValueChange={(value) => {
              handleValueChange(value)
              onComplete(value)
            }}
            onOpenChange={(open) => {
              if (!open && editValue !== value) {
                onComplete(editValue)
              }
            }}
          >
            <SelectTrigger
              className={cn(
                'w-full h-full border-2 border-primary shadow-lg',
                'text-sm bg-background',
                'focus-visible:outline-none focus-visible:ring-0'
              )}
              onKeyDown={handleKeyDown}
              autoFocus
            >
              <SelectValue placeholder="Select option..." />
            </SelectTrigger>
            <SelectContent>
              {normalizedOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case 'multiselect':
        const multiValue = Array.isArray(editValue) ? editValue : []
        return (
          <div className={cn(
            'w-full border-2 border-primary shadow-lg',
            'text-sm bg-background p-2 max-h-40 overflow-y-auto',
            'focus-visible:outline-none focus-visible:ring-0'
          )}>
            {normalizedOptions.map((option) => (
              <div key={option.value} className="flex items-center space-x-2 py-1">
                <Checkbox
                  checked={multiValue.includes(option.value)}
                  onCheckedChange={(checked) => {
                    const newValue = checked
                      ? [...multiValue, option.value]
                      : multiValue.filter(v => v !== option.value)
                    handleValueChange(newValue)
                  }}
                />
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  {option.label}
                </label>
              </div>
            ))}
            <div className="flex justify-end space-x-2 mt-2 pt-2 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onCancel()}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => onComplete(multiValue)}
              >
                Done
              </Button>
            </div>
          </div>
        )

      case 'text':
        return (
          <Textarea
            {...commonProps}
            rows={3}
            className={cn(commonProps.className, 'resize-none')}
          />
        )

      default: // string
        return <Input {...commonProps} />
    }
  }

  // Create portal to render outside React tree
  const getEditorDimensions = () => {
    const baseWidth = Math.max(position.width, 120)
    const baseHeight = position.height
    
    switch (type) {
      case 'text':
        return {
          width: Math.max(baseWidth, 200),
          height: 'auto',
          minHeight: Math.max(baseHeight, 80)
        }
      
      case 'multiselect':
        return {
          width: Math.max(baseWidth, 250),
          height: 'auto',
          minHeight: Math.max(baseHeight, 120),
          maxHeight: 300
        }
      
      case 'date':
        return {
          width: Math.max(baseWidth, 200),
          height: baseHeight,
          minHeight: baseHeight
        }
      
      case 'select':
        return {
          width: Math.max(baseWidth, 150),
          height: baseHeight,
          minHeight: baseHeight
        }
      
      default:
        return {
          width: baseWidth,
          height: baseHeight,
          minHeight: baseHeight
        }
    }
  }

  return createPortal(
    <div
      ref={containerRef}
      className="absolute z-50"
      style={{
        top: position.top,
        left: position.left,
        ...getEditorDimensions()
      }}
    >
      {renderEditor()}
    </div>,
    document.body
  )
}

