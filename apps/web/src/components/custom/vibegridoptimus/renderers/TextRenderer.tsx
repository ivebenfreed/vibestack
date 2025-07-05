import React from 'react'
import { CSS_CLASSES } from '../utils/constants'

interface TextRendererProps {
  value: any
  config?: {
    placeholder?: string
    maxLength?: number
    inputType?: string
  }
  onContentClick?: (event: React.MouseEvent) => void
}

/**
 * Pure text display renderer
 * Shows text content with proper overflow handling and empty state
 */
export function TextRenderer({ value, config, onContentClick }: TextRendererProps): React.ReactNode {
  // PERFORMANCE: Simplified empty state - no complex SVG
  if (!value) {
    return (
      <div className={CSS_CLASSES.emptyState} onClick={onContentClick}>
        <span className="text-xs text-muted-foreground">—</span>
      </div>
    )
  }
  
  // PERFORMANCE: Avoid String() conversion if already string
  const displayValue = typeof value === 'string' ? value : String(value)
  
  return (
    <div 
      className={`${CSS_CLASSES.cellDisplay} ${CSS_CLASSES.cellHover} ${CSS_CLASSES.textOverflow}`}
      title={displayValue} // Show full text on hover
      onClick={onContentClick}
    >
      {displayValue}
    </div>
  )
}