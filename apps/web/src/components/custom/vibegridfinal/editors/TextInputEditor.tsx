/**
 * TextInputEditor - Modular Text Input Editor Component
 * 
 * ✅ EXTRACTED: From UniversalCellRenderer for better organization
 * ✅ PERFORMANCE: No impact since only rendered on click
 * ✅ MAINTAINABLE: Dedicated file for text/number/uuid editing logic
 */

import React from 'react'
import { Input } from '@/components/ui/input'

// Force consistent font size to match display text
// Note: Inline styles needed to override shadcn Input component's responsive text sizing
const EDITOR_TEXT_STYLE = {
  fontSize: '16px',
  lineHeight: 'normal'
} as const

export interface TextInputEditorProps {
  cellType: string
  value: any
  onChange: (value: any) => void
  onSave: (value: any) => void
  onCancel: () => void
  config: any
  placeholder?: string
}

export const TextInputEditor: React.FC<TextInputEditorProps> = ({
  cellType,
  value,
  onChange,
  onSave,
  onCancel,
  config,
  placeholder
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null)
  
  const inputType = cellType === 'date' ? 'date' : 
                   cellType === 'number' ? 'number' : 
                   'text'

  React.useEffect(() => {
    // Auto-focus when mounted
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  React.useEffect(() => {
    // Handle escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onCancel()
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        const input = e.target as HTMLInputElement
        onSave(input.value)
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onSave, onCancel])

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    onSave(e.target.value)
  }

  return (
    <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm">
      <Input
        ref={inputRef}
        type={inputType}
        value={value || ''}
        placeholder={placeholder || config.placeholder}
        min={config.numberMin}
        max={config.numberMax}
        step={config.step}
        maxLength={config.maxLength}
        readOnly={config.readOnly !== false && cellType === 'uuid'}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        className="h-full border border-input shadow-sm focus-visible:ring-1 focus-visible:ring-ring rounded-sm bg-background px-2"
        style={EDITOR_TEXT_STYLE}
      />
    </div>
  )
} 