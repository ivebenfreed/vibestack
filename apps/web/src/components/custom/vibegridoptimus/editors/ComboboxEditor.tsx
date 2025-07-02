/**
 * ComboboxEditor - Professional dropdown editor with search for VibeGridOptimus
 * 
 * ✅ ADAPTED: From VibeGridFinal ComboboxEditor for react-data-grid integration
 * ✅ SEARCH: Instant filtering for enum options
 * ✅ KEYBOARD NAV: Arrow keys, Enter, Escape, Tab support
 * ✅ AUTO-FOCUS: Opens immediately when editing starts
 */

import React from 'react'
import { cn } from '@/lib/utils'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Check } from 'lucide-react'

export interface ComboboxEditorProps {
  options: Array<{value: string, label: string}>
  currentValue: any
  onSelect: (value: string) => void
  onCommit: () => void
  onCancel: () => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  isMultiSelect?: boolean
}

export const ComboboxEditor: React.FC<ComboboxEditorProps> = ({ 
  options, 
  currentValue, 
  onSelect, 
  onCommit,
  onCancel,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  className = "",
  isMultiSelect = false
}) => {
  const [open, setOpen] = React.useState(false) // Start closed, then open on mount
  const [searchValue, setSearchValue] = React.useState('')
  const [highlightedIndex, setHighlightedIndex] = React.useState(0)
  const [hasSelectedValue, setHasSelectedValue] = React.useState(false)

  // Open the popover after mount to avoid flash
  React.useEffect(() => {
    setOpen(true)
  }, [])

  // Filter options based on search
  const filteredOptions = React.useMemo(() => {
    if (!searchValue) return options
    return options.filter(option => 
      option.label.toLowerCase().includes(searchValue.toLowerCase()) ||
      option.value.toLowerCase().includes(searchValue.toLowerCase())
    )
  }, [options, searchValue])

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setHighlightedIndex(prev => 
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev)
          break
        case 'Enter':
          e.preventDefault()
          if (filteredOptions[highlightedIndex]) {
            handleSelect(filteredOptions[highlightedIndex].value)
          } else {
            setOpen(false)
            onCommit() // Commit current state if no options to select
          }
          break
        case 'Escape':
          e.preventDefault()
          setOpen(false)
          onCancel()
          break
        case 'Tab':
          e.preventDefault()
          // Handle Tab like Enter - select current and close
          if (filteredOptions[highlightedIndex]) {
            handleSelect(filteredOptions[highlightedIndex].value)
          } else {
            setOpen(false)
            onCommit() // Commit current state and navigate
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [filteredOptions, highlightedIndex, open])

  const handleSelect = (value: string) => {
    onSelect(value)
    setHasSelectedValue(true)
    if (!isMultiSelect) {
      setOpen(false)
    }
  }

  // Reset highlighted index when filtered options change
  React.useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredOptions])

  return (
    <div className={cn("absolute inset-0 z-50", className)}>
      <Popover 
        open={open} 
        onOpenChange={(newOpen) => {
          if (!newOpen) {
            // Only cancel if no value was selected and popover is being closed manually
            if (!hasSelectedValue) {
              onCancel()
            }
          }
        }}
      >
        <PopoverTrigger asChild>
          <div 
            className="w-full h-full cursor-pointer bg-transparent border-0 outline-0 opacity-0"
            tabIndex={0}
            autoFocus
          />
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start" side="bottom">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchValue}
              onValueChange={setSearchValue}
              autoFocus
            />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((option, index) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option.value)}
                  className={cn(
                    "cursor-pointer",
                    index === highlightedIndex && "bg-accent"
                  )}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      isMultiSelect 
                        ? (Array.isArray(currentValue) && currentValue.includes(option.value) ? "opacity-100" : "opacity-0")
                        : (currentValue === option.value ? "opacity-100" : "opacity-0")
                    )}
                  />
                  <span className={option.value === '' ? 'text-muted-foreground italic' : ''}>
                    {option.label}
                  </span>
                </CommandItem>
              ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}