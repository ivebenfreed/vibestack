/**
 * TextInputEditor - Modular Text Input Editor Component
 * 
 * ✅ EXTRACTED: From UniversalCellRenderer for better organization
 * ✅ PERFORMANCE: No impact since only rendered on click
 * ✅ MAINTAINABLE: Dedicated file for text/number/uuid editing logic
 */

import React from 'react'

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
    <input
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
      className="edit-input"
      onFocus={(e) => {
        console.log('Input focused')
      }}
      onBlur={(e) => {
        handleBlur(e)
      }}
    />
  )
} 