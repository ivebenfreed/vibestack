import React from 'react'
import { CSS_CLASSES } from '../utils/constants'

interface EnumRendererProps {
  value: any
  config?: {
    enumValues?: Record<string, string>
    options?: Array<{ value: string; label: string }>
  }
  onContentClick?: (event: React.MouseEvent) => void
}

/**
 * Pure enum display renderer
 * Shows enum values as styled badges with proper colors
 */
export function EnumRenderer({ value, config, onContentClick }: EnumRendererProps): React.ReactNode {
  // PERFORMANCE: Simplified empty state
  if (!value) {
    return (
      <div className={CSS_CLASSES.emptyState} onClick={onContentClick}>
        <span className="text-xs text-muted-foreground">—</span>
      </div>
    )
  }
  
  // Get the display label
  let label = String(value)
  
  if (config?.enumValues) {
    label = config.enumValues[String(value)] || String(value)
  } else if (config?.options) {
    const option = config.options.find(opt => opt.value === String(value))
    if (option) {
      label = option.label
    }
  }
  
  // Get enum-specific colors based on the value
  const colorClass = getEnumColors(String(value))
  
  return (
    <span className={`${CSS_CLASSES.badge} ${CSS_CLASSES.primaryBadge} ${CSS_CLASSES.cellHoverOpacity}`} onClick={onContentClick}>
      {label}
    </span>
  )
}

/**
 * Get enum-specific colors based on the value
 * Provides semantic coloring for common enum values
 */
function getEnumColors(enumValue: string): string {
  const colorMap: Record<string, string> = {
    // Status colors
    'active': 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800',
    'in_progress': 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800',
    'completed': 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-800',
    'on_hold': 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800',
    'cancelled': 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800',
    
    // Task status colors
    'todo': 'bg-slate-100 dark:bg-slate-900/20 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800',
    'doing': 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800',
    'done': 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800',
    
    // Priority colors
    'low': 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-800',
    'medium': 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800',
    'high': 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800',
    'critical': 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800',
    
    // Generic states
    'draft': 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-800',
    'published': 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800',
    'archived': 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800'
  }
  
  return colorMap[enumValue] || CSS_CLASSES.primaryBadge
}