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

export interface BulkEditField {
  key: string
  label: string
  type: 'enum' | 'text' | 'number' | 'boolean' | 'date' | 'relationship'
  options?: { label: string; value: string }[]
  placeholder?: string
}

interface EntityTableBulkEditDropdownProps<T> {
  field: BulkEditField
  selectedCount: number
  onBulkUpdate: (updates: Partial<T>) => Promise<void>
  isLoading: boolean
}

export function EntityTableBulkEditDropdown<T>({
  field,
  selectedCount,
  onBulkUpdate,
  isLoading
}: EntityTableBulkEditDropdownProps<T>) {
  const [selectedValue, setSelectedValue] = useState<string>('')
  const [isUpdating, setIsUpdating] = useState(false)

  const options = useMemo(() => {
    if (field.type === 'enum' && field.options) {
      return field.options
    }
    
    if (field.type === 'boolean') {
      return [
        { label: 'True', value: 'true' },
        { label: 'False', value: 'false' }
      ]
    }
    
    // For relationships and other types, we'd need to implement fetching
    // This is a simplified version - you might want to extend this
    return []
  }, [field])

  const handleValueChange = async (value: string) => {
    setSelectedValue(value)
    
    if (value && value !== 'placeholder') {
      setIsUpdating(true)
      try {
        let processedValue: any = value
        
        // Process value based on field type
        if (field.type === 'boolean') {
          processedValue = value === 'true'
        } else if (field.type === 'number') {
          processedValue = parseFloat(value)
        }
        
        const updates = { [field.key]: processedValue } as Partial<T>
        await onBulkUpdate(updates)
        setSelectedValue('') // Reset after successful update
      } catch (error) {
        // Error handling is done in the parent
        console.error('Bulk update failed:', error)
      } finally {
        setIsUpdating(false)
      }
    }
  }

  if (!options.length && field.type !== 'text' && field.type !== 'number') {
    return null // Hide if no options available
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

/**
 * Bulk Edit Toolbar Component
 * Renders multiple bulk edit dropdowns for quick editing
 */
interface EntityTableBulkEditToolbarProps<T> {
  fields: BulkEditField[]
  selectedCount: number
  onBulkUpdate: (updates: Partial<T>) => Promise<void>
  isLoading?: boolean
}

export function EntityTableBulkEditToolbar<T>({
  fields,
  selectedCount,
  onBulkUpdate,
  isLoading = false
}: EntityTableBulkEditToolbarProps<T>) {
  if (selectedCount === 0 || fields.length === 0) {
    return null
  }

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-1">
        <Edit3 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">
          Quick Edit:
        </span>
      </div>
      
      {fields.map((field) => (
        <EntityTableBulkEditDropdown
          key={field.key}
          field={field}
          selectedCount={selectedCount}
          onBulkUpdate={onBulkUpdate}
          isLoading={isLoading}
        />
      ))}
    </div>
  )
}

/**
 * Helper function to create bulk edit fields for common entity types
 */
export function createBulkEditFields(entityType: string): BulkEditField[] {
  const commonFields: Record<string, BulkEditField[]> = {
    tasks: [
      {
        key: 'status',
        label: 'Status',
        type: 'enum',
        options: [
          { label: 'Open', value: 'OPEN' },
          { label: 'In Progress', value: 'IN_PROGRESS' },
          { label: 'Completed', value: 'COMPLETED' }
        ]
      },
      {
        key: 'priority',
        label: 'Priority',
        type: 'enum',
        options: [
          { label: 'Low', value: 'LOW' },
          { label: 'Medium', value: 'MEDIUM' },
          { label: 'High', value: 'HIGH' }
        ]
      }
    ],
    projects: [
      {
        key: 'status',
        label: 'Status',
        type: 'enum',
        options: [
          { label: 'Active', value: 'ACTIVE' },
          { label: 'In Progress', value: 'IN_PROGRESS' },
          { label: 'Completed', value: 'COMPLETED' },
          { label: 'On Hold', value: 'ON_HOLD' }
        ]
      }
    ],
    users: [
      {
        key: 'active',
        label: 'Active',
        type: 'boolean'
      }
    ]
  }

  return commonFields[entityType] || []
} 