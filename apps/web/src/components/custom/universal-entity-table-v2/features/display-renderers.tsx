import React from 'react'
import { format } from 'date-fns'

// ============================================================================
// Simple Color and Badge Utilities
// ============================================================================

/**
 * Color mapping for common patterns
 */
export const colorPresets = {
  // Status colors
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-800',
  
  // Priority colors
  high: 'bg-red-100 text-red-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-gray-100 text-gray-800',
  
  // State colors
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
  
  // Custom colors
  purple: 'bg-purple-100 text-purple-800',
  pink: 'bg-pink-100 text-pink-800',
  indigo: 'bg-indigo-100 text-indigo-800',
  cyan: 'bg-cyan-100 text-cyan-800',
} as const

/**
 * Creates a simple badge with color and label mapping
 */
export function badge(
  value: any, 
  options?: {
    colorMapping?: Record<string, keyof typeof colorPresets | string>,
    labelMapping?: Record<string, string>,
    defaultColor?: keyof typeof colorPresets | string
  }
): React.ReactNode {
  if (!value && value !== 0) return <span className="text-muted-foreground">-</span>
  
  const stringValue = String(value)
  const { colorMapping, labelMapping, defaultColor = 'neutral' } = options || {}
  
  const colorKey = colorMapping?.[stringValue] || defaultColor
  const colorClass = typeof colorKey === 'string' && colorKey in colorPresets 
    ? colorPresets[colorKey as keyof typeof colorPresets]
    : colorKey
  
  const displayLabel = labelMapping?.[stringValue] || stringValue
  
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
      {displayLabel}
    </span>
  )
}

/**
 * Creates a colored text renderer
 */
export function colored(
  value: any,
  colorMapping?: Record<string, string>,
  defaultClass: string = 'text-foreground'
): React.ReactNode {
  if (!value && value !== 0) return <span className="text-muted-foreground">-</span>
  
  const stringValue = String(value)
  const colorClass = colorMapping?.[stringValue] || defaultClass
  
  return <span className={colorClass}>{stringValue}</span>
}



// ============================================================================
// Quick Field-Level Renderers  
// ============================================================================

/**
 * Quick task status renderer
 */
export function taskStatus(value: any) {
  return badge(value, {
    colorMapping: {
      // Actual enum values (lowercase)
      'open': 'neutral',
      'in_progress': 'info',
      'completed': 'success',
      // Also handle uppercase just in case
      'OPEN': 'neutral',
      'IN_PROGRESS': 'info', 
      'COMPLETED': 'success'
    },
    labelMapping: {
      'open': 'Open',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'OPEN': 'Open',
      'IN_PROGRESS': 'In Progress', 
      'COMPLETED': 'Completed'
    }
  })
}

/**
 * Quick task priority renderer
 */
export function taskPriority(value: any) {
  return badge(value, {
    colorMapping: {
      // Actual enum values (lowercase)
      'low': 'low',
      'medium': 'medium', 
      'high': 'high',
      // Also handle uppercase just in case
      'LOW': 'low',
      'MEDIUM': 'medium',
      'HIGH': 'high'
    },
    labelMapping: {
      'low': 'Low',
      'medium': 'Medium', 
      'high': 'High',
      'LOW': 'Low',
      'MEDIUM': 'Medium',
      'HIGH': 'High'
    }
  })
}

// ============================================================================
// Date Display Renderers
// ============================================================================

/**
 * Formats dates in a human-readable format
 */
export function dateRenderer(value: any): React.ReactNode {
  if (!value) return <span className="text-muted-foreground">-</span>
  
  try {
    const date = value instanceof Date ? value : new Date(value)
    return format(date, 'MMM dd, yyyy')
  } catch {
    return <span className="text-muted-foreground">Invalid date</span>
  }
}

/**
 * Formats dates with time
 */
export function dateTimeRenderer(value: any): React.ReactNode {
  if (!value) return <span className="text-muted-foreground">-</span>
  
  try {
    const date = value instanceof Date ? value : new Date(value)
    return format(date, 'MMM dd, yyyy HH:mm')
  } catch {
    return <span className="text-muted-foreground">Invalid date</span>
  }
}

/**
 * Formats dates in relative format (e.g., "2 days ago")
 */
export function relativeDateRenderer(value: any): React.ReactNode {
  if (!value) return <span className="text-muted-foreground">-</span>
  
  try {
    const date = value instanceof Date ? value : new Date(value)
    const now = new Date()
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffInDays === 0) return 'Today'
    if (diffInDays === 1) return 'Yesterday'
    if (diffInDays > 0) return `${diffInDays} days ago`
    if (diffInDays === -1) return 'Tomorrow'
    return `In ${Math.abs(diffInDays)} days`
  } catch {
    return <span className="text-muted-foreground">Invalid date</span>
  }
}

// ============================================================================
// Array and List Display Renderers
// ============================================================================

/**
 * Renders arrays as comma-separated values with optional limit
 */
export function arrayRenderer(maxItems: number = 3, moreText: string = 'more') {
  return (value: any): React.ReactNode => {
    if (!Array.isArray(value) || value.length === 0) {
      return <span className="text-muted-foreground">-</span>
    }
    
    const items = value.slice(0, maxItems)
    const hasMore = value.length > maxItems
    
    return (
      <span>
        {items.join(', ')}
        {hasMore && <span className="text-muted-foreground"> +{value.length - maxItems} {moreText}</span>}
      </span>
    )
  }
}

/**
 * Renders tags with pill styling
 */
export function tagsRenderer(maxTags: number = 2): (value: any) => React.ReactNode {
  return (value: any) => {
    if (!Array.isArray(value) || value.length === 0) {
      return <span className="text-muted-foreground">No tags</span>
    }
    
    const visibleTags = value.slice(0, maxTags)
    const hiddenCount = value.length - maxTags
    
    return (
      <div className="flex flex-wrap gap-1">
        {visibleTags.map((tag, index) => (
          <span 
            key={index} 
            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-secondary text-secondary-foreground"
          >
            {tag}
          </span>
        ))}
        {hiddenCount > 0 && (
          <span className="text-xs text-muted-foreground">+{hiddenCount} more</span>
        )}
      </div>
    )
  }
}

// ============================================================================
// Numeric Display Renderers
// ============================================================================

/**
 * Formats numbers as currency
 */
export function currencyRenderer(currency: string = 'USD', locale: string = 'en-US') {
  return (value: any): React.ReactNode => {
    if (value == null || value === '') return <span className="text-muted-foreground">-</span>
    
    const numValue = typeof value === 'number' ? value : parseFloat(value)
    if (isNaN(numValue)) return <span className="text-muted-foreground">Invalid</span>
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(numValue)
  }
}

/**
 * Formats numbers as percentages
 */
export function percentageRenderer(decimals: number = 1) {
  return (value: any): React.ReactNode => {
    if (value == null || value === '') return <span className="text-muted-foreground">-</span>
    
    const numValue = typeof value === 'number' ? value : parseFloat(value)
    if (isNaN(numValue)) return <span className="text-muted-foreground">Invalid</span>
    
    return `${(numValue * 100).toFixed(decimals)}%`
  }
}

/**
 * Formats large numbers with K/M/B suffixes
 */
export function compactNumberRenderer(value: any): React.ReactNode {
  if (value == null || value === '') return <span className="text-muted-foreground">-</span>
  
  const numValue = typeof value === 'number' ? value : parseFloat(value)
  if (isNaN(numValue)) return <span className="text-muted-foreground">Invalid</span>
  
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(numValue)
}

// ============================================================================
// Boolean Display Renderers
// ============================================================================

/**
 * Renders boolean values with custom labels and styling
 */
export function booleanRenderer(
  trueLabel: string = 'Yes', 
  falseLabel: string = 'No',
  trueClass: string = 'text-green-700',
  falseClass: string = 'text-gray-500'
) {
  return (value: any): React.ReactNode => {
    if (value == null) return <span className="text-muted-foreground">-</span>
    
    const isTrue = Boolean(value)
    return (
      <span className={isTrue ? trueClass : falseClass}>
        {isTrue ? trueLabel : falseLabel}
      </span>
    )
  }
}

/**
 * Renders boolean values as badges
 */
export function booleanBadgeRenderer(
  trueLabel: string = 'Active',
  falseLabel: string = 'Inactive',
  trueClass: string = 'bg-green-100 text-green-800',
  falseClass: string = 'bg-gray-100 text-gray-800'
) {
  return (value: any): React.ReactNode => {
    if (value == null) return <span className="text-muted-foreground">-</span>
    
    const isTrue = Boolean(value)
    const label = isTrue ? trueLabel : falseLabel
    const colorClass = isTrue ? trueClass : falseClass
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        {label}
      </span>
    )
  }
}

// ============================================================================
// Text Display Renderers
// ============================================================================

/**
 * Truncates long text with ellipsis
 */
export function truncateRenderer(maxLength: number = 50, suffix: string = '...') {
  return (value: any): React.ReactNode => {
    if (!value) return <span className="text-muted-foreground">-</span>
    
    const text = String(value)
    if (text.length <= maxLength) return text
    
    return (
      <span title={text}>
        {text.substring(0, maxLength)}{suffix}
      </span>
    )
  }
}

/**
 * Renders text with a "Show more" link for long content
 */
export function expandableTextRenderer(maxLength: number = 100) {
  return (value: any): React.ReactNode => {
    if (!value) return <span className="text-muted-foreground">-</span>
    
    const text = String(value)
    if (text.length <= maxLength) return text
    
    const [isExpanded, setIsExpanded] = React.useState(false)
    
    if (isExpanded) {
      return (
        <span>
          {text}{' '}
          <button 
            onClick={() => setIsExpanded(false)}
            className="text-primary hover:underline text-xs"
          >
            Show less
          </button>
        </span>
      )
    }
    
    return (
      <span>
        {text.substring(0, maxLength)}...{' '}
        <button 
          onClick={() => setIsExpanded(true)}
          className="text-primary hover:underline text-xs"
        >
          Show more
        </button>
      </span>
    )
  }
} 