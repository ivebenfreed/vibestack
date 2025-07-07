/**
 * SmartGlobalSearch - TanStack Table Native Global Filter
 * 
 * Fixed implementation that aligns with TanStack Table's native global filtering:
 * ✅ No recursion issues
 * ✅ Proper debouncing using useEffect cleanup
 * ✅ Respects width constraints
 * ✅ Direct integration with TanStack Table's globalFilter state
 * ✅ Properly styled clear button within input boundaries
 */

import React from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SmartGlobalSearchProps } from '../../types'

export const SmartGlobalSearch: React.FC<SmartGlobalSearchProps> = ({ 
  value, 
  onChange, 
  placeholder = "Search across all columns...",
  className 
}) => {
  const [localValue, setLocalValue] = React.useState(value)
  
  // Sync with external value changes (when globalFilter is controlled externally)
  React.useEffect(() => {
    setLocalValue(value)
  }, [value])
  
  // Debounced onChange - properly implemented to avoid recursion
  React.useEffect(() => {
    // Only debounce if localValue differs from the external value
    if (localValue !== value) {
      const timeoutId = setTimeout(() => {
        onChange(localValue)
      }, 300)
      
      // Cleanup function prevents recursion
      return () => clearTimeout(timeoutId)
    }
  }, [localValue, value, onChange])
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value)
  }
  
  const handleClear = () => {
    setLocalValue('')
    onChange('') // Immediate clear for better UX
  }
  
  return (
    <div className={cn("relative inline-flex", className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground transform -translate-y-1/2 pointer-events-none z-10" />
      <input
        value={localValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={cn(
          "w-full pl-10 h-9 text-sm border border-input bg-background rounded-md transition-colors",
          "hover:border-accent-foreground/25 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          localValue ? "pr-10" : "pr-4" // Adjust right padding when clear button is visible
        )}
      />
      
      {localValue && (
        <button
          onClick={handleClear}
          className={cn(
            "absolute right-3 top-1/2 h-4 w-4 transform -translate-y-1/2",
            "rounded-sm opacity-70 hover:opacity-100 focus:opacity-100",
            "transition-opacity duration-200 focus:outline-none",
            "flex items-center justify-center",
            "hover:bg-muted focus:bg-muted"
          )}
          aria-label="Clear search"
          type="button"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
} 