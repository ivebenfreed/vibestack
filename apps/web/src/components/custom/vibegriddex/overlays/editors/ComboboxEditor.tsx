/**
 * ComboboxEditor - Professional dropdown editor with search for VibeGridX
 * 
 * ✅ ADAPTED: From VibeGridOptimus ComboboxEditor for VibeGridX integration
 * ✅ SEARCH: Instant filtering for enum options
 * ✅ KEYBOARD NAV: Arrow keys, Enter, Escape, Tab support
 * ✅ AUTO-FOCUS: Opens immediately when editing starts
 * ✅ NO TRIGGER: Only shows dropdown content, no extra cell display
 */

import React from 'react'
import { cn } from '@/lib/utils'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Check } from 'lucide-react'
import type { CellRef, Column, RelationshipContext } from '../../types'

export interface ComboboxEditorProps {
  cell: CellRef
  column: Column
  initialValue: any
  onCommit: (value: any) => void
  onCancel: () => void
  placeholder?: string
  searchPlaceholder?: string
  className?: string
  isMultiSelect?: boolean
  // Context for relationship options providers
  relationshipContext?: RelationshipContext
}

export const ComboboxEditor: React.FC<ComboboxEditorProps> = ({ 
  cell,
  column,
  initialValue,
  onCommit,
  onCancel,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  className = "",
  isMultiSelect = false,
  relationshipContext
}) => {
  const [searchValue, setSearchValue] = React.useState('')
  const [highlightedIndex, setHighlightedIndex] = React.useState(0)
  const [hasCommitted, setHasCommitted] = React.useState(false)
  const [dynamicOptions, setDynamicOptions] = React.useState<any[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = React.useState(false)

  // Load options from provider if available
  React.useEffect(() => {
    console.log('🔍 ComboboxEditor: Provider check', {
      columnId: column.id,
      hasProvider: !!column.relationshipOptionsProvider,
      hasContext: !!relationshipContext,
      relationshipContext: relationshipContext,
      relationshipTable: column.relationshipTable,
      relationshipEntityType: column.relationshipEntityType
    });
    
    if (column.relationshipOptionsProvider && relationshipContext) {
      console.log('🔍 ComboboxEditor: Loading relationship options', {
        columnId: column.id,
        relationshipTable: column.relationshipTable,
        hasProvider: !!column.relationshipOptionsProvider,
        hasContext: !!relationshipContext
      });
      
      setIsLoadingOptions(true)
      
      const loadOptions = async () => {
        try {
          const providerOptions = await column.relationshipOptionsProvider!(relationshipContext)
          
          console.log('🔍 ComboboxEditor: Loaded relationship options', {
            columnId: column.id,
            optionCount: providerOptions.length,
            options: providerOptions.map(opt => ({ value: opt.value, label: opt.label }))
          });
          
          setDynamicOptions(providerOptions)
        } catch (error) {
          console.error('ComboboxEditor: Error loading relationship options:', error)
          setDynamicOptions([])
        } finally {
          setIsLoadingOptions(false)
        }
      }
      
      loadOptions()
    }
  }, [column.relationshipOptionsProvider, relationshipContext])

  // Get options from column configuration or dynamic provider
  const options = React.useMemo(() => {
    let rawOptions: any[] = []
    
    // Use dynamic options if available, otherwise fall back to static options
    if (column.relationshipOptionsProvider && dynamicOptions.length > 0) {
      rawOptions = dynamicOptions
    } else {
      rawOptions = column.enumOptions || column.options || []
    }
    
    console.log('🔍 ComboboxEditor: Computing options', {
      columnId: column.id,
      hasProvider: !!column.relationshipOptionsProvider,
      dynamicOptionsCount: dynamicOptions.length,
      staticOptionsCount: (column.enumOptions || column.options || []).length,
      usingDynamic: column.relationshipOptionsProvider && dynamicOptions.length > 0,
      rawOptionsCount: rawOptions.length
    });
    
    // Convert to standard format
    const standardOptions = rawOptions.map(option => {
      if (typeof option === 'string') {
        return { value: option, label: option }
      }
      return { value: option.value, label: option.label }
    })

    // Add null option for nullable fields
    if (column.nullable !== false) {
      standardOptions.unshift({ value: '__null__', label: 'None' })
    }

    console.log('🔍 ComboboxEditor: Final options', {
      columnId: column.id,
      optionCount: standardOptions.length,
      options: standardOptions.map(opt => ({ value: opt.value, label: opt.label }))
    });

    return standardOptions
  }, [column.enumOptions, column.options, column.nullable, column.relationshipOptionsProvider, dynamicOptions])

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
            handleCommit(initialValue) // Commit current state if no options to select
          }
          break
        case 'Escape':
          e.preventDefault()
          handleCancel()
          break
        case 'Tab':
          e.preventDefault()
          // Handle Tab like Enter - select current and close
          if (filteredOptions[highlightedIndex]) {
            handleSelect(filteredOptions[highlightedIndex].value)
          } else {
            handleCommit(initialValue) // Commit current state and navigate
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [filteredOptions, highlightedIndex, initialValue])

  const handleSelect = (value: string) => {
    const finalValue = value === '__null__' ? null : value
    handleCommit(finalValue)
  }

  const handleCommit = (value: any) => {
    if (hasCommitted) return
    setHasCommitted(true)
    onCommit(value)
  }

  const handleCancel = () => {
    if (hasCommitted) return
    setHasCommitted(true)
    onCancel()
  }

  // Reset highlighted index when filtered options change
  React.useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredOptions])

  return (
    <div className={cn("w-full h-full", className)}>
      <Command shouldFilter={false} className="border rounded-md shadow-lg bg-background">
        <CommandInput
          placeholder={searchPlaceholder}
          value={searchValue}
          onValueChange={setSearchValue}
          autoFocus
          className="border-none focus:ring-0"
        />
        <CommandList className="max-h-64 overflow-auto">
          {isLoadingOptions ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading options...
            </div>
          ) : (
            <>
              <CommandEmpty>No results found.</CommandEmpty>
              {/* Group options by their group property */}
              {(() => {
                // Group the filtered options
                const grouped = filteredOptions.reduce((acc, option) => {
                  const group = option.group || 'Other';
                  if (!acc[group]) acc[group] = [];
                  acc[group].push(option);
                  return acc;
                }, {} as Record<string, EnumOption[]>);
                
                // Sort groups
                const sortedGroups = Object.keys(grouped).sort();
                
                // Render grouped options
                return sortedGroups.map(groupName => (
                  <CommandGroup key={groupName} heading={groupName}>
                    {grouped[groupName].map((option, groupIndex) => {
                      const globalIndex = filteredOptions.findIndex(o => o.value === option.value);
                      return (
                        <CommandItem
                          key={option.value}
                          value={option.value}
                          onSelect={() => {
                            console.log('ComboboxEditor: onSelect called', option.value);
                            handleSelect(option.value);
                          }}
                          onClick={(e) => {
                            console.log('ComboboxEditor: onClick called', option.value);
                            e.stopPropagation();
                            handleSelect(option.value);
                          }}
                          className={cn(
                            "cursor-pointer",
                            globalIndex === highlightedIndex && "bg-accent"
                          )}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              isMultiSelect 
                                ? (Array.isArray(initialValue) && initialValue.includes(option.value) ? "opacity-100" : "opacity-0")
                                : (initialValue === option.value || (initialValue === null && option.value === '__null__') ? "opacity-100" : "opacity-0")
                            )}
                          />
                          <span 
                            className={option.value === '__null__' ? 'text-muted-foreground italic' : ''}
                            style={option.color ? { color: option.color } : undefined}
                          >
                            {option.label}
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ));
              })()}
            </>
          )}
        </CommandList>
      </Command>
    </div>
  )
}