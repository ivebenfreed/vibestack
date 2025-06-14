import React, { useState, useCallback, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

/**
 * 🔍 SearchInput - Dedicated Search Component
 * 
 * Purpose-built for table search functionality with:
 * ✅ Always-visible clear button when there's text
 * ✅ Real-time updates as you type
 * ✅ Consistent layout that never shifts
 * ✅ Browser-like search behavior
 * ✅ No mode switching complexity
 */

export interface SearchInputProps {
  /** Current search value */
  value: string
  /** Callback when search value changes (real-time) */
  onValueChange: (value: string) => void
  /** Placeholder text */
  placeholder?: string
  /** Additional CSS classes */
  className?: string
  /** Auto-focus on mount */
  autoFocus?: boolean
  /** Disabled state */
  disabled?: boolean
  /** Test ID for automation */
  'data-testid'?: string
}

export const SearchInput = React.memo(function SearchInput({
  value,
  onValueChange,
  placeholder = "Search...",
  className = "",
  autoFocus = false,
  disabled = false,
  'data-testid': testId,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Handle input change with real-time updates
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value
    onValueChange(newValue)
  }, [onValueChange])

  // Handle clear button click
  const handleClear = useCallback(() => {
    onValueChange('')
    inputRef.current?.focus()
  }, [onValueChange])

  // Auto-focus effect
  useEffect(() => {
    if (autoFocus && !disabled) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
    }
  }, [autoFocus, disabled])

  return (
    <div className={cn("relative", className)} data-testid={testId}>
      {/* Search Input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "w-full h-8 px-3 pr-8 text-sm bg-background border border-border rounded-md",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring",
          "placeholder:text-muted-foreground",
          "transition-colors",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      />
      
      {/* Clear Button - Always positioned consistently */}
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className={cn(
            "absolute top-1/2 right-2 transform -translate-y-1/2",
            "h-4 w-4 rounded-full flex items-center justify-center",
            "bg-muted/80 hover:bg-muted border border-border/50",
            "text-muted-foreground hover:text-foreground",
            "focus:outline-none focus:ring-1 focus:ring-ring focus:bg-muted",
            "transition-all backdrop-blur-sm z-10"
          )}
          aria-label="Clear search"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
})

/**
 * Performance Notes:
 * 
 * ✅ Single-purpose component optimized for search
 * ✅ No mode switching complexity
 * ✅ Always reserves space for clear button (pr-8)
 * ✅ Real-time updates by default
 * ✅ Consistent layout that never shifts
 * ✅ Minimal DOM structure
 * ✅ React.memo prevents unnecessary re-renders
 */ 