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
  // Show icon for null/empty text values
  if (!value) {
    return (
      <div className={CSS_CLASSES.emptyState} onClick={onContentClick}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14,2 14,8 20,8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10,9 9,9 8,9"></polyline>
        </svg>
        <span className="text-xs">Add text</span>
      </div>
    )
  }
  
  const displayValue = String(value)
  
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