/**
 * ComboboxEditor - Modular Combobox Editor Component
 * 
 * ✅ EXTRACTED: From UniversalCellRenderer for better organization
 * ✅ PERFORMANCE: No impact since only rendered on click
 * ✅ MAINTAINABLE: Dedicated file for dropdown/search editing logic
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
  onCancel: () => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
}

export const ComboboxEditor: React.FC<ComboboxEditorProps> = ({ 
  options, 
  currentValue, 
  onSelect, 
  onCancel,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  className = ""
}) => {
  const [open, setOpen] = React.useState(true) // Auto-open when mounted
  const [searchValue, setSearchValue] = React.useState('')
  const [highlightedIndex, setHighlightedIndex] = React.useState(0)

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
          }
          break
        case 'Escape':
          e.preventDefault()
          setOpen(false)
          onCancel()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [filteredOptions, highlightedIndex, open])

  const handleSelect = (value: string) => {
    setOpen(false)
    onSelect(value)
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
            onCancel()
          }
        }}
      >
        <PopoverTrigger asChild>
          <div 
            className="w-full h-full cursor-pointer opacity-0"
            ref={(div) => {
              // Auto-click to open popover immediately
              if (div && open) {
                setTimeout(() => div.click(), 0)
              }
            }}
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
                      currentValue === option.value ? "opacity-100" : "opacity-0"
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