import React, { useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LightweightTextInput } from '../performance/LightweightTextInput'
import { LightweightSelect } from '../performance/LightweightSelect'
import { LightweightDatePicker } from '../performance/LightweightDatePicker'
import { LightweightNumberInput } from '../performance/LightweightNumberInput'
import { Cross2Icon } from '@radix-ui/react-icons'
import { Save } from 'lucide-react'

export type BulkEditFieldType = 'text' | 'number' | 'date' | 'select' | 'boolean'

export interface BulkEditField {
  key: string
  label: string
  type: BulkEditFieldType
  options?: Array<{ label: string; value: any }> // For select fields
  placeholder?: string
  min?: number // For number fields
  max?: number // For number fields
  step?: number // For number fields
  required?: boolean
}

export interface EntityTableBulkEditToolbarProps<T = any> {
  fields: BulkEditField[]
  selectedCount: number
  onBulkUpdate: (updates: Partial<T>) => Promise<void> | void
  isLoading?: boolean
  entityType?: string
}

/**
 * Creates common bulk edit fields for an entity type
 * Can be customized by individual implementations
 */
export function createBulkEditFields(entityType: string): BulkEditField[] {
  const commonFields: BulkEditField[] = [
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Draft', value: 'draft' },
        { label: 'Archived', value: 'archived' },
      ],
    },
    {
      key: 'priority',
      label: 'Priority',
      type: 'select',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' },
        { label: 'Critical', value: 'critical' },
      ],
    },
    {
      key: 'tags',
      label: 'Tags',
      type: 'text',
      placeholder: 'Comma-separated tags...',
    },
    {
      key: 'notes',
      label: 'Notes',
      type: 'text',
      placeholder: 'Add notes...',
    },
  ]

  // Entity-specific fields can be added here
  switch (entityType.toLowerCase()) {
    case 'tasks':
    case 'task':
      return [
        ...commonFields,
        {
          key: 'dueDate',
          label: 'Due Date',
          type: 'date',
        },
        {
          key: 'assigneeId',
          label: 'Assignee',
          type: 'select',
          options: [], // Would be populated from user data
        },
      ]
    
    case 'projects':
    case 'project':
      return [
        ...commonFields,
        {
          key: 'budget',
          label: 'Budget',
          type: 'number',
          min: 0,
          step: 100,
        },
        {
          key: 'startDate',
          label: 'Start Date',
          type: 'date',
        },
        {
          key: 'endDate',
          label: 'End Date',  
          type: 'date',
        },
      ]
      
    default:
      return commonFields
  }
}

/**
 * Entity Table Bulk Edit Toolbar
 * 
 * Performance-optimized bulk editing with:
 * - ✅ All lightweight components (no shadcn/ui form controls)
 * - ✅ Memoized field renderers to prevent recreation
 * - ✅ Local state management until save
 * - ✅ Batch updates to prevent multiple API calls
 */
export function EntityTableBulkEditToolbar<T>({
  fields,
  selectedCount,
  onBulkUpdate,
  isLoading = false,
  entityType = 'items',
}: EntityTableBulkEditToolbarProps<T>) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, any>>({})
  const [hasChanges, setHasChanges] = useState(false)

  // ✅ Don't render if no selection
  if (selectedCount === 0) {
    return null
  }

  // ✅ Memoized field change handler
  const handleFieldChange = useCallback((fieldKey: string, value: any) => {
    setEditValues(prev => ({
      ...prev,
      [fieldKey]: value,
    }))
    setHasChanges(true)
  }, [])

  // ✅ Memoized save handler
  const handleSave = useCallback(async () => {
    if (!hasChanges || Object.keys(editValues).length === 0) return

    try {
      // Filter out empty values
      const updates = Object.entries(editValues).reduce((acc, [key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          acc[key] = value
        }
        return acc
      }, {} as Record<string, any>)

      if (Object.keys(updates).length > 0) {
        await onBulkUpdate(updates as Partial<T>)
        setEditValues({})
        setHasChanges(false)
        setIsExpanded(false)
      }
    } catch (error) {
      console.error('Bulk update failed:', error)
    }
  }, [editValues, hasChanges, onBulkUpdate])

  // ✅ Memoized cancel handler
  const handleCancel = useCallback(() => {
    setEditValues({})
    setHasChanges(false)
    setIsExpanded(false)
  }, [])

  // ✅ Memoized field renderers to prevent recreation
  const fieldRenderers = useMemo(() => {
    return fields.map((field) => {
      const currentValue = editValues[field.key] || ''

      const commonProps = {
        key: field.key,
        value: currentValue,
        placeholder: field.placeholder,
        className: "h-8 min-w-[120px]",
      }

      switch (field.type) {
        case 'text':
          return (
            <div key={field.key} className="flex items-center space-x-2">
              <label className="text-xs font-medium text-muted-foreground min-w-[60px]">
                {field.label}:
              </label>
              <LightweightTextInput
                {...commonProps}
                onValueChange={(value) => handleFieldChange(field.key, value)}
              />
            </div>
          )

        case 'number':
          return (
            <div key={field.key} className="flex items-center space-x-2">
              <label className="text-xs font-medium text-muted-foreground min-w-[60px]">
                {field.label}:
              </label>
              <LightweightNumberInput
                {...commonProps}
                onValueChange={(value) => handleFieldChange(field.key, value)}
                min={field.min}
                max={field.max}
                step={field.step}
              />
            </div>
          )

        case 'date':
          return (
            <div key={field.key} className="flex items-center space-x-2">
              <label className="text-xs font-medium text-muted-foreground min-w-[60px]">
                {field.label}:
              </label>
              <LightweightDatePicker
                {...commonProps}
                onValueChange={(value) => handleFieldChange(field.key, value)}
              />
            </div>
          )

        case 'select':
          return (
            <div key={field.key} className="flex items-center space-x-2">
              <label className="text-xs font-medium text-muted-foreground min-w-[60px]">
                {field.label}:
              </label>
              <LightweightSelect
                value={currentValue}
                onValueChange={(value) => handleFieldChange(field.key, value)}
                options={field.options || []}
                placeholder={field.placeholder || `Select ${field.label.toLowerCase()}...`}
                className="h-8 min-w-[120px]"
              />
            </div>
          )

        default:
          return null
      }
    }).filter(Boolean)
  }, [fields, editValues, handleFieldChange])

  if (!isExpanded) {
    return (
      <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded-md">
        <div className="flex items-center space-x-2">
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Quick Edit
          </Badge>
          <span className="text-sm text-blue-700">
            Edit {selectedCount} {entityType} at once
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(true)}
          className="h-8 bg-white border-blue-300 text-blue-700 hover:bg-blue-50"
        >
          Edit Selected
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Bulk Edit
          </Badge>
          <span className="text-sm text-blue-700 font-medium">
            Editing {selectedCount} {entityType}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-100"
        >
          <Cross2Icon className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {fieldRenderers}
      </div>

      <div className="flex items-center justify-end space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancel}
          disabled={isLoading}
          className="h-8"
        >
          Cancel
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleSave}
          disabled={isLoading || !hasChanges}
          className="h-8"
        >
          <Save className="mr-2 h-4 w-4" />
          Update {selectedCount} {entityType}
        </Button>
      </div>
    </div>
  )
} 