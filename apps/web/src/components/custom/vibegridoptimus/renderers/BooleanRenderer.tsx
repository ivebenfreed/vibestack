import React from 'react'
import { CSS_CLASSES } from '../utils/constants'

interface BooleanRendererProps {
  value: any
  onContentClick?: (event: React.MouseEvent) => void
}

/**
 * Pure boolean display renderer
 * Shows boolean values as checkboxes (read-only display)
 */
export function BooleanRenderer({ value, onContentClick }: BooleanRendererProps): React.ReactNode {
  const isChecked = Boolean(value)
  
  return (
    <div className="flex items-center justify-center">
      <div 
        className={`
          w-4 h-4 rounded border-2 flex items-center justify-center ${CSS_CLASSES.cellHover}
          ${isChecked 
            ? 'bg-primary border-primary text-primary-foreground' 
            : 'bg-background border-border hover:border-primary/50'
          }
        `}
        onClick={onContentClick}
      >
        {isChecked && (
          <svg 
            width="12" 
            height="12" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="3" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <polyline points="20,6 9,17 4,12"></polyline>
          </svg>
        )}
      </div>
    </div>
  )
}