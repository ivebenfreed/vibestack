import React from 'react'
import { CSS_CLASSES } from '../utils/constants'

interface DateRendererProps {
  value: any
  config?: {
    format?: string
    showTime?: boolean
    timeZone?: string
  }
  readOnly?: boolean
  onContentClick?: (event: React.MouseEvent) => void
}

/**
 * Pure date display renderer
 * Shows date values with proper formatting and empty state
 */
export function DateRenderer({ value, config, readOnly = false, onContentClick }: DateRendererProps): React.ReactNode {
  // Show icon for null/empty date values
  if (!value) {
    if (readOnly) {
      return <span className={CSS_CLASSES.mutedText}>—</span>
    }
    
    return (
      <div 
        className={`${CSS_CLASSES.emptyState} ${onContentClick ? CSS_CLASSES.cellHover : ''}`}
        onClick={onContentClick}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span className="text-xs">Add date</span>
      </div>
    )
  }
  
  const formattedDate = formatDate(value, config)
  
  return (
    <div 
      className={`${CSS_CLASSES.cellDisplay} ${readOnly ? CSS_CLASSES.mutedText : (onContentClick ? CSS_CLASSES.cellHover : '')}`}
      onClick={!readOnly ? onContentClick : undefined}
      title={value ? new Date(value).toISOString() : ''} // Show ISO string on hover
    >
      {formattedDate}
    </div>
  )
}

/**
 * Format date based on configuration
 */
function formatDate(value: any, config?: DateRendererProps['config']): string {
  try {
    const date = new Date(value)
    
    if (isNaN(date.getTime())) {
      return String(value)
    }
    
    // Use custom format if specified
    if (config?.format) {
      switch (config.format) {
        case 'short':
          return date.toLocaleDateString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: '2-digit'
          })
        case 'medium':
          return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })
        case 'long':
          return date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          })
        case 'iso':
          return date.toISOString().split('T')[0]
        default:
          return date.toLocaleDateString()
      }
    }
    
    // Default formatting
    if (config?.showTime) {
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: config.timeZone
      })
    }
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  } catch (error) {
    return String(value)
  }
}