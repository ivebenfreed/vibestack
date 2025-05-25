import React, { useState, useEffect, useRef, useCallback, useId } from 'react'
import { RichTextarea } from 'rich-textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface RichEditableTextProps {
  label: string
  value: string | undefined
  fieldType: 'text' | 'textarea'
  onSave: (newValue: string) => Promise<void>
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>
  textareaProps?: React.TextareaHTMLAttributes<HTMLTextAreaElement>
  className?: string
  textClassName?: string
  placeholder?: string
  labelSrOnly?: boolean
  disabled?: boolean
  autoFocus?: boolean
}

// Exact dimensional matching between display and edit modes - no transitions, no shifts
const createAppThemedStyling = (fieldType: 'text' | 'textarea', textClassName?: string, error?: boolean, disabled?: boolean) => {
  // Exact base styling - no transitions that can cause visual issues
  const baseAppStyling = 'w-full rounded-md border bg-transparent outline-none'
  
  // App theme colors
  const appColors = 'text-foreground placeholder:text-muted-foreground'
  const errorBorder = error ? 'border-red-500' : 'border-border'
  
  if (fieldType === 'text') {
    // EXACT input dimensions - must match perfectly between modes
    const exactInputDimensions = 'h-9 px-3 py-1 flex items-center'
    
    return {
      editMode: cn(
        baseAppStyling,
        exactInputDimensions,
        appColors,
        errorBorder,
        'focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30',
        textClassName
      ),
      displayMode: cn(
        baseAppStyling,
        exactInputDimensions,
        appColors,
        // Always show a subtle border to match edit mode visually
        'border-gray-200 dark:border-gray-800',
        'cursor-text',
        'group-hover:border-dashed group-hover:border-gray-400 dark:group-hover:border-gray-600',
        disabled ? 'opacity-50 cursor-not-allowed border-gray-100 dark:border-gray-900' : '',
        textClassName
      )
    }
  } else {
    // EXACT textarea dimensions - must match perfectly between modes  
    const exactTextareaDimensions = 'px-3 py-2 min-h-[2.5rem]'
    
    return {
      editMode: cn(
        baseAppStyling,
        exactTextareaDimensions,
        appColors,
        errorBorder,
        'focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30',
        'resize-vertical whitespace-pre-wrap',
        textClassName
      ),
      displayMode: cn(
        baseAppStyling,
        exactTextareaDimensions,
        appColors,
        // Always show a subtle border to match edit mode visually
        'border-gray-200 dark:border-gray-800',
        'cursor-text whitespace-pre-wrap break-words',
        'group-hover:border-dashed group-hover:border-gray-400 dark:group-hover:border-gray-600',
        disabled ? 'opacity-50 cursor-not-allowed border-gray-100 dark:border-gray-900' : '',
        textClassName
      )
    }
  }
}

const RichEditableText: React.FC<RichEditableTextProps> = ({
  label,
  value,
  fieldType,
  onSave,
  inputProps,
  textareaProps,
  className,
  textClassName,
  placeholder = 'Click to edit',
  labelSrOnly = false,
  disabled = false,
  autoFocus = false,
}) => {
  const autoId = useId()
  const fieldId = inputProps?.id || textareaProps?.id || autoId

  const [isEditing, setIsEditing] = useState(false)
  const [currentValue, setCurrentValue] = useState(value || '')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [originalValue, setOriginalValue] = useState(value || '')

  const inputRef = useRef<HTMLInputElement>(null)
  const richTextareaRef = useRef<HTMLTextAreaElement>(null)
  const displayRef = useRef<HTMLDivElement>(null)

  // Create unified styling for both modes
  const styling = createAppThemedStyling(fieldType, textClassName, !!error, disabled)

  // Update internal state when value prop changes
  useEffect(() => {
    setCurrentValue(value || '')
    if (!isEditing) {
      setOriginalValue(value || '')
    }
  }, [value, isEditing])

  // Auto-focus when entering edit mode
  useEffect(() => {
    if (isEditing && !disabled) {
      const timeoutId = setTimeout(() => {
        if (fieldType === 'text' && inputRef.current) {
          inputRef.current.focus()
          // Move cursor to end for text inputs
          const len = inputRef.current.value.length
          inputRef.current.setSelectionRange(len, len)
        } else if (fieldType === 'textarea' && richTextareaRef.current) {
          richTextareaRef.current.focus()
          // Move cursor to end for textareas
          const len = richTextareaRef.current.value.length
          richTextareaRef.current.setSelectionRange(len, len)
        }
      }, 0)
      return () => clearTimeout(timeoutId)
    }
  }, [isEditing, fieldType, disabled])

  const handleSave = useCallback(async () => {
    if (currentValue === originalValue) {
      setIsEditing(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      await onSave(currentValue)
      setOriginalValue(currentValue)
      setIsEditing(false)
    } catch (err: any) {
      setError(err.message || 'Failed to save')
      // Keep editing mode open for retry
    } finally {
      setIsLoading(false)
    }
  }, [currentValue, originalValue, onSave])

  const handleCancel = useCallback(() => {
    setCurrentValue(originalValue)
    setIsEditing(false)
    setError(null)
  }, [originalValue])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    } else if (e.key === 'Enter') {
      if (fieldType === 'text') {
        e.preventDefault()
        handleSave()
      } else if (fieldType === 'textarea' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleSave()
      }
    }
  }, [fieldType, handleSave, handleCancel])

  const handleBlur = useCallback(() => {
    // Use a timeout to allow clicking on buttons without premature blur
    setTimeout(() => {
      if (isEditing && !isLoading) {
        handleSave()
      }
    }, 150)
  }, [isEditing, isLoading, handleSave])

  const handleEditClick = useCallback(() => {
    if (!disabled && !isLoading) {
      setOriginalValue(currentValue)
      setIsEditing(true)
      setError(null)
    }
  }, [disabled, isLoading, currentValue])

  // Calculate exact height for textareas to ensure zero layout shift
  const getExactHeight = useCallback(() => {
    if (fieldType === 'text') return undefined

    const rows = textareaProps?.rows || 4
    // Use natural CSS sizing that rich-textarea expects - avoid pixel calculations
    // This lets the browser handle consistent sizing naturally
    return { 
      minHeight: `${Math.max(2.5, rows * 1.5)}rem` // At least 2.5rem, then 1.5rem per additional row
    }
  }, [fieldType, textareaProps?.rows])

  // Simple renderer for rich-textarea that preserves text as-is but allows styling
  const textRenderer = useCallback((text: string) => {
    return (
      <span className={cn('whitespace-pre-wrap break-words', textClassName)}>
        {text}
      </span>
    )
  }, [textClassName])

  if (isEditing) {
    return (
      <div className={cn('space-y-1', className)}>
        {!labelSrOnly && (
          <Label htmlFor={fieldId} className="text-sm font-medium">
            {label}
          </Label>
        )}
        
        <div className="relative">
          {fieldType === 'text' ? (
            <input
              ref={inputRef}
              id={fieldId}
              type="text"
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder={placeholder}
              disabled={isLoading}
              className={cn(
                styling.editMode,
                inputProps?.className
              )}
              {...inputProps}
            />
          ) : (
            <RichTextarea
              ref={richTextareaRef}
              id={fieldId}
              value={currentValue}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCurrentValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder={placeholder}
              disabled={isLoading}
              style={{
                ...getExactHeight(),
                resize: 'vertical',
                width: '100%',
                boxSizing: 'border-box',
              }}
              className={cn(
                styling.editMode,
                textareaProps?.className
              )}
              rows={textareaProps?.rows || 4}
              {...textareaProps}
            >
              {textRenderer}
            </RichTextarea>
          )}
          
          {isLoading && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    )
  }

  // Display mode with precise height and spacing matching
  return (
    <div className={cn('space-y-1 group', className)}>
      {!labelSrOnly && (
        <Label htmlFor={fieldId} className="text-sm font-medium text-muted-foreground">
          {label}
        </Label>
      )}
      
      <div
        ref={displayRef}
        style={getExactHeight()}
        className={cn(
          styling.displayMode,
          // Placeholder styling
          (!currentValue && placeholder) ? 'text-muted-foreground italic' : '',
          // Field-specific layout
          fieldType === 'text' ? 'truncate' : '',
          // Disabled styling
          disabled ? 'opacity-50 cursor-not-allowed hover:bg-transparent' : ''
        )}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={handleEditClick}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            handleEditClick()
          }
        }}
        aria-label={`Edit ${label}`}
      >
        {currentValue || (
          <span className="text-muted-foreground italic">{placeholder}</span>
        )}
      </div>
    </div>
  )
}

export default RichEditableText 