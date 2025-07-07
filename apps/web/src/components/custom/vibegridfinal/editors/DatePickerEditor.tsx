/**
 * DatePickerEditor - Modular Date Picker Editor Component
 * 
 * ✅ EXTRACTED: From UniversalCellRenderer for better organization
 * ✅ PERFORMANCE: No impact since only rendered on click
 * ✅ MAINTAINABLE: Dedicated file for date editing logic
 */

import React from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Clock } from 'lucide-react'
import { format } from 'date-fns'

// Force consistent font size to match display text
// Note: Inline styles needed to override shadcn Input component's responsive text sizing
const EDITOR_TEXT_STYLE = {
  fontSize: '16px',
  lineHeight: 'normal'
} as const

export interface DatePickerEditorProps {
  value: any
  onChange: (value: string) => void
  onSave: (value: string) => void
  onCancel: () => void
  config: any
  placeholder?: string
}

export const DatePickerEditor: React.FC<DatePickerEditorProps> = ({
  value,
  onChange,
  onSave,
  onCancel,
  config,
  placeholder
}) => {
  const [open, setOpen] = React.useState(true) // Auto-open when mounted
  const [tempValue, setTempValue] = React.useState(value || '')

  // Convert string/date to Date object
  const dateValue = React.useMemo(() => {
    if (!tempValue) return undefined
    try {
      return new Date(tempValue)
    } catch {
      return undefined
    }
  }, [tempValue])

  // Handle date selection from calendar
  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      setTempValue('')
      onChange('')
      onSave('')
      setOpen(false)
      return
    }

    let dateString: string
    if (config.showTime) {
      // For datetime, preserve current time or use noon
      const currentTime = dateValue && !isNaN(dateValue.getTime()) ? dateValue : new Date()
      date.setHours(currentTime.getHours(), currentTime.getMinutes())
      dateString = date.toISOString()
    } else {
      // For date-only, use ISO date string
      dateString = date.toISOString().split('T')[0]
    }

    setTempValue(dateString)
    onChange(dateString)
    onSave(dateString)
    setOpen(false)
  }

  // Handle time input change (if showTime is enabled)
  const handleTimeChange = (timeString: string) => {
    if (!dateValue || isNaN(dateValue.getTime())) return

    const [hours, minutes] = timeString.split(':').map(Number)
    if (isNaN(hours) || isNaN(minutes)) return

    const newDate = new Date(dateValue)
    newDate.setHours(hours, minutes)
    const dateString = newDate.toISOString()

    setTempValue(dateString)
    onChange(dateString)
    onSave(dateString)
    setOpen(false)
  }

  // Handle cancel
  const handleCancel = () => {
    setOpen(false)
    onCancel()
  }

  // Handle escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        handleCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Get current time for time input
  const currentTime = React.useMemo(() => {
    if (!dateValue || isNaN(dateValue.getTime())) return '12:00'
    return format(dateValue, 'HH:mm')
  }, [dateValue])

  // ✅ OVERLAY PATTERN: Position absolutely over cell, no backdrop
  return (
    <div className="absolute inset-0 z-50">
      <Popover open={open} onOpenChange={(newOpen) => {
        if (!newOpen) {
          onCancel()
        }
      }}>
        <PopoverTrigger asChild>
          {/* Invisible trigger that fills the cell */}
          <Button
            variant="ghost"
            className="w-full h-full opacity-0 absolute inset-0"
            ref={(button) => {
              // Auto-click to open popover immediately
              if (button && open) {
                setTimeout(() => button.click(), 0)
              }
            }}
          >
            Trigger
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" side="bottom">
          <div className="p-3 space-y-3">
            {/* Calendar */}
            <Calendar
              mode="single"
              selected={dateValue}
              onSelect={handleDateSelect}
              initialFocus
            />
            
            {/* Time input (if showTime is enabled) */}
            {config.showTime && (
              <div className="border-t pt-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="time"
                    value={currentTime}
                    onChange={(e) => handleTimeChange(e.target.value)}
                    className="w-auto"
                    style={EDITOR_TEXT_STYLE}
                  />
                </div>
              </div>
            )}
            
            {/* Clear button */}
            <div className="border-t pt-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setTempValue('')
                  onChange('')
                  onSave('')
                  setOpen(false)
                }}
              >
                Clear Date
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
} 