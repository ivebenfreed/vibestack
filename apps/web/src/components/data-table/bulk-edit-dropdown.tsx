import React, { useState, useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Loader2, Edit3 } from 'lucide-react'
import { BulkEditField } from './data-table-logic'

interface BulkEditDropdownProps<T> {
  field: BulkEditField
  selectedCount: number
  onBulkUpdate: (updates: Partial<T>) => Promise<void>
  isLoading: boolean
}

export function BulkEditDropdown<T>({
  field,
  selectedCount,
  onBulkUpdate,
  isLoading
}: BulkEditDropdownProps<T>) {
  const [selectedValue, setSelectedValue] = useState<string>('')
  const [isUpdating, setIsUpdating] = useState(false)

  const options = useMemo(() => {
    if (field.type === 'enum' && field.options) {
      return field.options
    }
    // For relationships, we'd need to implement fetching
    // This is a simplified version - you might want to extend this
    return []
  }, [field])

  const handleValueChange = async (value: string) => {
    setSelectedValue(value)
    
    if (value && value !== 'placeholder') {
      setIsUpdating(true)
      try {
        const updates = { [field.key]: value } as Partial<T>
        await onBulkUpdate(updates)
        setSelectedValue('') // Reset after successful update
      } catch (error) {
        // Error handling is done in the parent
      } finally {
        setIsUpdating(false)
      }
    }
  }

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {field.label}:
      </span>
      <Select
        value={selectedValue}
        onValueChange={handleValueChange}
        disabled={isLoading || isUpdating}
      >
        <SelectTrigger className="w-[140px] h-8">
          <SelectValue placeholder={
            isUpdating ? (
              <div className="flex items-center">
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Updating...
              </div>
            ) : (
              `Set ${field.label}`
            )
          } />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="placeholder" disabled>
            Update {selectedCount} {selectedCount === 1 ? 'item' : 'items'}
          </SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
} 