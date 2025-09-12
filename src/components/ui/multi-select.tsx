/**
 * Multi-Select Component using shadcn/ui
 * Based on https://github.com/sersavan/shadcn-multi-select-component
 */

import React from 'react'
import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface Option {
  value: string
  label: string
  color?: string
  group?: string
  disabled?: boolean
}

interface MultiSelectProps {
  options: Option[]
  onValueChange: (value: string[]) => void
  defaultValue?: string[]
  placeholder?: string
  animation?: number
  asChild?: boolean
  className?: string
  disabled?: boolean
}

export function MultiSelect({
  options,
  onValueChange,
  defaultValue = [],
  placeholder = 'Select items...',
  animation = 0,
  asChild = false,
  className,
  disabled = false
}: MultiSelectProps) {
  const [selectedValues, setSelectedValues] = React.useState<string[]>(defaultValue)
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState('')

  const handleUnselect = (value: string) => {
    const newSelectedValues = selectedValues.filter((v) => v !== value)
    setSelectedValues(newSelectedValues)
    onValueChange(newSelectedValues)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const input = e.target as HTMLInputElement
    if (input.value !== '') return
    
    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        if (selectedValues.length > 0) {
          handleUnselect(selectedValues[selectedValues.length - 1])
        }
        break
      case 'Escape':
        input.blur()
        break
    }
  }

  const selectables = options.filter((option) => !selectedValues.includes(option.value))

  // Group options if they have group property
  const groupedSelectables = React.useMemo(() => {
    const grouped = selectables.reduce((acc, option) => {
      const group = option.group || 'Other'
      if (!acc[group]) acc[group] = []
      acc[group].push(option)
      return acc
    }, {} as Record<string, Option[]>)
    
    return Object.keys(grouped).sort().map(groupName => ({
      groupName,
      options: grouped[groupName]
    }))
  }, [selectables])

  // Filter options based on search
  const filteredGroupedSelectables = React.useMemo(() => {
    if (!inputValue) return groupedSelectables
    
    return groupedSelectables
      .map(group => ({
        ...group,
        options: group.options.filter(option =>
          option.label.toLowerCase().includes(inputValue.toLowerCase()) ||
          option.value.toLowerCase().includes(inputValue.toLowerCase())
        )
      }))
      .filter(group => group.options.length > 0)
  }, [groupedSelectables, inputValue])

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isPopoverOpen}
          className={cn(
            'w-full justify-between min-h-10 h-auto',
            className
          )}
          onClick={() => setIsPopoverOpen(!isPopoverOpen)}
          disabled={disabled}
        >
          {selectedValues.length > 0 ? (
            <div className="flex gap-1 flex-wrap">
              {selectedValues.map((value) => {
                const option = options.find((o) => o.value === value)
                return (
                  <Badge
                    variant="secondary"
                    key={value}
                    className="mr-1 mb-1"
                    style={option?.color ? { backgroundColor: option.color + '20', color: option.color } : undefined}
                  >
                    {option?.label}
                    <button
                      className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUnselect(value)
                        }
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onClick={() => handleUnselect(value)}
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </Badge>
                )
              })}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search..."
            value={inputValue}
            onValueChange={setInputValue}
            onKeyDown={handleKeyDown}
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {filteredGroupedSelectables.map((group) => (
              <CommandGroup key={group.groupName} heading={group.groupName}>
                {group.options.map((option) => (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      const newSelectedValues = [...selectedValues, option.value]
                      setSelectedValues(newSelectedValues)
                      onValueChange(newSelectedValues)
                    }}
                    className="cursor-pointer"
                    disabled={option.disabled}
                  >
                    <span 
                      style={option.color ? { color: option.color } : undefined}
                      className={cn(option.disabled && 'text-muted-foreground')}
                    >
                      {option.label}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
          {selectedValues.length > 0 && (
            <>
              <Separator />
              <div className="p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center text-muted-foreground"
                  onClick={() => {
                    setSelectedValues([])
                    onValueChange([])
                  }}
                >
                  Clear all
                </Button>
              </div>
            </>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}