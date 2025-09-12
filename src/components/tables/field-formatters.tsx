/**
 * Field Type-Based Formatting System
 * 
 * Provides intelligent formatting based on field types and values:
 * - Dates: Human-readable formats with timezone awareness
 * - Numbers: Localized with proper decimal places
 * - Booleans: Visual indicators with icons
 * - JSON: Expandable/collapsible objects
 * - URLs: Clickable links with previews
 * - Enums: Badge-style formatting with colors
 * - Null/undefined: Consistent empty state indicator
 */

import React from 'react'
import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Check, 
  X, 
  Calendar,
  ExternalLink,
  Eye,
  EyeOff,
  Hash,
  Type,
  Database
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Field type detection based on value and schema
export type FieldType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'datetime'
  | 'json' 
  | 'url' 
  | 'email'
  | 'phone'
  | 'enum'
  | 'id'
  | 'unknown'

// Format configuration
export interface FieldFormatConfig {
  type?: FieldType
  enumValues?: string[]
  enumColors?: Record<string, string>
  dateFormat?: 'short' | 'long' | 'relative' | 'datetime'
  numberFormat?: 'integer' | 'decimal' | 'currency' | 'percentage'
  jsonExpanded?: boolean
  maxLength?: number
  showIcon?: boolean
}

// Detect field type from value and schema hints
export function detectFieldType(value: any, fieldName: string, schemaHints?: any): FieldType {
  if (value === null || value === undefined) {
    return 'unknown'
  }

  // Check schema hints first
  if (schemaHints?.type) {
    switch (schemaHints.type.toLowerCase()) {
      case 'datetime':
      case 'timestamp':
        return 'datetime'
      case 'date':
        return 'date'
      case 'boolean':
        return 'boolean'
      case 'number':
      case 'integer':
      case 'float':
        return 'number'
      case 'json':
      case 'object':
        return 'json'
      case 'enum':
        return 'enum'
    }
  }

  // Field name pattern matching
  const fieldLower = fieldName.toLowerCase()
  if (fieldLower.includes('id') || fieldLower.endsWith('_id')) {
    return 'id'
  }
  if (fieldLower.includes('email')) {
    return 'email'
  }
  if (fieldLower.includes('phone')) {
    return 'phone'
  }
  if (fieldLower.includes('url') || fieldLower.includes('link')) {
    return 'url'
  }
  if (fieldLower.includes('created') || fieldLower.includes('updated') || fieldLower.includes('date')) {
    return 'datetime'
  }

  // Value-based detection
  const valueType = typeof value
  
  if (valueType === 'boolean') {
    return 'boolean'
  }
  
  if (valueType === 'number') {
    return 'number'
  }

  if (valueType === 'string') {
    // Date detection
    if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
      return 'datetime'
    }
    if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return 'date'
    }
    
    // URL detection
    if (value.match(/^https?:\/\//)) {
      return 'url'
    }
    
    // Email detection
    if (value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return 'email'
    }
    
    // Phone detection
    if (value.match(/^[\+]?[\d\s\-\(\)]+$/) && value.replace(/\D/g, '').length >= 10) {
      return 'phone'
    }

    // JSON detection
    if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
      try {
        JSON.parse(value)
        return 'json'
      } catch {
        // Not valid JSON
      }
    }

    return 'string'
  }

  if (valueType === 'object' && value !== null) {
    return 'json'
  }

  return 'unknown'
}

// Format a single field value
export function formatFieldValue(
  value: any, 
  fieldName: string, 
  config: FieldFormatConfig = {}
): React.ReactNode {
  // Handle null/undefined
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted-foreground italic">—</span>
  }

  const fieldType = config.type || detectFieldType(value, fieldName)

  switch (fieldType) {
    case 'boolean':
      return formatBoolean(value, config)
      
    case 'date':
      return formatDate(value, config)
      
    case 'datetime':
      return formatDateTime(value, config)
      
    case 'number':
      return formatNumber(value, config)
      
    case 'json':
      return formatJson(value, config)
      
    case 'url':
      return formatUrl(value, config)
      
    case 'email':
      return formatEmail(value, config)
      
    case 'phone':
      return formatPhone(value, config)
      
    case 'enum':
      return formatEnum(value, config)
      
    case 'id':
      return formatId(value, config)
      
    case 'string':
    default:
      return formatString(value, config)
  }
}

function formatBoolean(value: boolean, config: FieldFormatConfig): React.ReactNode {
  if (config.showIcon === false) {
    return <span>{value ? 'Yes' : 'No'}</span>
  }

  return (
    <div className="flex items-center gap-1">
      {value ? (
        <>
          <Check className="h-4 w-4 text-green-600" />
          <span className="text-green-700">Yes</span>
        </>
      ) : (
        <>
          <X className="h-4 w-4 text-red-600" />
          <span className="text-red-700">No</span>
        </>
      )}
    </div>
  )
}

function formatDate(value: string | Date, config: FieldFormatConfig): React.ReactNode {
  const date = typeof value === 'string' ? parseISO(value) : value
  
  if (!isValid(date)) {
    return <span className="text-muted-foreground">Invalid date</span>
  }

  const formatType = config.dateFormat || 'short'
  let formatted: string

  switch (formatType) {
    case 'long':
      formatted = format(date, 'MMMM d, yyyy')
      break
    case 'relative':
      formatted = formatDistanceToNow(date, { addSuffix: true })
      break
    case 'short':
    default:
      formatted = format(date, 'MMM d, yyyy')
      break
  }

  return (
    <div className="flex items-center gap-1">
      {config.showIcon !== false && <Calendar className="h-3 w-3 text-muted-foreground" />}
      <span>{formatted}</span>
    </div>
  )
}

function formatDateTime(value: string | Date, config: FieldFormatConfig): React.ReactNode {
  const date = typeof value === 'string' ? parseISO(value) : value
  
  if (!isValid(date)) {
    return <span className="text-muted-foreground">Invalid date</span>
  }

  const formatType = config.dateFormat || 'datetime'
  let formatted: string

  switch (formatType) {
    case 'relative':
      formatted = formatDistanceToNow(date, { addSuffix: true })
      break
    case 'short':
      formatted = format(date, 'MMM d, yyyy h:mm a')
      break
    case 'long':
      formatted = format(date, 'MMMM d, yyyy h:mm:ss a')
      break
    case 'datetime':
    default:
      formatted = format(date, 'MMM d, h:mm a')
      break
  }

  return (
    <div className="flex items-center gap-1 text-sm">
      {config.showIcon !== false && <Calendar className="h-3 w-3 text-muted-foreground" />}
      <span>{formatted}</span>
    </div>
  )
}

function formatNumber(value: number, config: FieldFormatConfig): React.ReactNode {
  const formatType = config.numberFormat || 'decimal'
  let formatted: string

  switch (formatType) {
    case 'integer':
      formatted = Math.round(value).toLocaleString()
      break
    case 'currency':
      formatted = new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD' 
      }).format(value)
      break
    case 'percentage':
      formatted = new Intl.NumberFormat('en-US', { 
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }).format(value / 100)
      break
    case 'decimal':
    default:
      formatted = value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      })
      break
  }

  return (
    <div className="flex items-center gap-1 text-right font-mono text-sm">
      {config.showIcon !== false && <Hash className="h-3 w-3 text-muted-foreground" />}
      <span>{formatted}</span>
    </div>
  )
}

function formatJson(value: any, config: FieldFormatConfig): React.ReactNode {
  const [expanded, setExpanded] = React.useState(config.jsonExpanded || false)
  
  let jsonString: string
  try {
    jsonString = typeof value === 'string' ? value : JSON.stringify(value, null, expanded ? 2 : 0)
  } catch {
    return <span className="text-muted-foreground">Invalid JSON</span>
  }

  const preview = jsonString.length > 50 ? jsonString.substring(0, 47) + '...' : jsonString
  
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-5 w-5 p-0"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </Button>
      <code className="text-xs bg-muted px-1 py-0.5 rounded">
        {expanded ? jsonString : preview}
      </code>
    </div>
  )
}

function formatUrl(value: string, config: FieldFormatConfig): React.ReactNode {
  const domain = new URL(value).hostname
  
  return (
    <div className="flex items-center gap-1">
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
      >
        {config.showIcon !== false && <ExternalLink className="h-3 w-3" />}
        <span className="truncate max-w-[150px]">{domain}</span>
      </a>
    </div>
  )
}

function formatEmail(value: string, config: FieldFormatConfig): React.ReactNode {
  return (
    <a
      href={`mailto:${value}`}
      className="text-blue-600 hover:text-blue-800 hover:underline"
    >
      {value}
    </a>
  )
}

function formatPhone(value: string, config: FieldFormatConfig): React.ReactNode {
  // Basic phone formatting - could be enhanced with libphonenumber
  const formatted = value.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
  
  return (
    <a
      href={`tel:${value}`}
      className="font-mono text-sm text-blue-600 hover:text-blue-800 hover:underline"
    >
      {formatted}
    </a>
  )
}

function formatEnum(value: string, config: FieldFormatConfig): React.ReactNode {
  const colors = config.enumColors || {}
  const color = colors[value] || 'secondary'
  
  return (
    <Badge variant={color as any} className="text-xs">
      {value}
    </Badge>
  )
}

function formatId(value: string, config: FieldFormatConfig): React.ReactNode {
  // Show only first 8 chars for UUIDs
  const display = value.length > 20 ? `${value.substring(0, 8)}...` : value
  
  return (
    <div className="flex items-center gap-1">
      {config.showIcon !== false && <Database className="h-3 w-3 text-muted-foreground" />}
      <code className="text-xs text-muted-foreground font-mono">
        {display}
      </code>
    </div>
  )
}

function formatString(value: string, config: FieldFormatConfig): React.ReactNode {
  const maxLength = config.maxLength || 100
  const truncated = value.length > maxLength ? `${value.substring(0, maxLength - 3)}...` : value
  
  return (
    <div className="flex items-center gap-1">
      {config.showIcon !== false && value.length > maxLength && (
        <Type className="h-3 w-3 text-muted-foreground" />
      )}
      <span className="truncate" title={value.length > maxLength ? value : undefined}>
        {truncated}
      </span>
    </div>
  )
}

// Predefined format configurations for common field patterns
export const commonFieldConfigs: Record<string, FieldFormatConfig> = {
  // Timestamps
  created_at: { type: 'datetime', dateFormat: 'relative', showIcon: false },
  updated_at: { type: 'datetime', dateFormat: 'relative', showIcon: false },
  
  // IDs
  id: { type: 'id', showIcon: false },
  organization_id: { type: 'id', showIcon: false },
  user_id: { type: 'id', showIcon: false },
  
  // Status fields
  status: { 
    type: 'enum',
    enumColors: {
      active: 'default',
      inactive: 'secondary',
      pending: 'outline',
      deleted: 'destructive'
    }
  },
  
  // Record type
  record_type: {
    type: 'enum',
    enumColors: {
      customer: 'default',
      prospect: 'secondary',
      client: 'outline'
    }
  }
}

// Get format configuration for a field
export function getFieldConfig(fieldName: string): FieldFormatConfig {
  const normalizedName = fieldName.toLowerCase()
  return commonFieldConfigs[normalizedName] || {}
}