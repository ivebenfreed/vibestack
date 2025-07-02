import React from 'react'
import { CSS_CLASSES } from '../utils/constants'

interface NumberRendererProps {
  value: any
  config?: {
    numberMin?: number
    numberMax?: number
    step?: number
    format?: string
  }
  onContentClick?: (event: React.MouseEvent) => void
}

/**
 * Pure number display renderer
 * Shows numeric content with proper formatting and empty state
 */
export function NumberRenderer({ value, config, onContentClick }: NumberRendererProps): React.ReactNode {
  // Show icon for null/empty number values
  if (value === null || value === undefined || value === '') {
    return (
      <div className={CSS_CLASSES.emptyState} onClick={onContentClick}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
        <span className="text-xs">Add number</span>
      </div>
    )
  }
  
  const displayValue = formatNumber(value, config)
  
  return (
    <div 
      className={`${CSS_CLASSES.cellDisplayRight} ${CSS_CLASSES.cellHover}`}
      title={String(value)} // Show raw value on hover
      onClick={onContentClick}
    >
      {displayValue}
    </div>
  )
}

/**
 * Format number based on configuration
 */
function formatNumber(value: any, config?: NumberRendererProps['config']): string {
  const numValue = Number(value)
  
  if (isNaN(numValue)) {
    return String(value)
  }
  
  // Apply formatting based on config
  if (config?.format) {
    switch (config.format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(numValue)
      case 'percentage':
        return new Intl.NumberFormat('en-US', {
          style: 'percent',
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }).format(numValue / 100)
      case 'decimal':
        return new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(numValue)
      default:
        return String(numValue)
    }
  }
  
  // Check if it's a whole number
  if (Number.isInteger(numValue)) {
    return String(numValue)
  }
  
  // Format with reasonable decimal places
  return numValue.toFixed(2).replace(/\.?0+$/, '')
}