/**
 * MultiRelationshipEditor - For multi-relationship/many-to-many fields
 * 
 * ✅ ADAPTED: From VibeGridOptimus MultiRelationshipEditor
 * ✅ TAG INTERFACE: Shows selected items as removable badges
 * ✅ SEARCH: Instant filtering for relationship options
 * ✅ KEYBOARD NAV: Full keyboard navigation support
 * ✅ NULL HANDLING: Proper empty state handling
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';
import type { CellRef, Column } from '../../types';

interface MultiRelationshipEditorProps {
  cell: CellRef;
  column: Column;
  initialValue: any[];
  onCommit: (value: any[]) => void;
  onCancel: () => void;
  relationshipContext?: {
    relationshipResolvers?: Record<string, (id: string | string[]) => string>;
    relationshipAtoms?: Record<string, any>;
  };
}

export function MultiRelationshipEditor({
  cell,
  column,
  initialValue,
  onCommit,
  onCancel,
  relationshipContext
}: MultiRelationshipEditorProps) {
  const [selectedValues, setSelectedValues] = React.useState<string[]>([]);
  const [searchValue, setSearchValue] = React.useState('');
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const [hasCommitted, setHasCommitted] = React.useState(false);

  // Generate options from relationship atoms
  const options = React.useMemo(() => {
    if (!relationshipContext?.relationshipAtoms || !column.relationshipTable) {
      return [];
    }
    
    const relationshipAtom = relationshipContext.relationshipAtoms[column.relationshipTable];
    if (!relationshipAtom) {
      return [];
    }
    
    const atomData = relationshipAtom.get() || {};
    const entities = Object.values(atomData);
    
    return entities.map((entity: any) => ({
      value: entity.id,
      label: entity[column.relationshipDisplayField || 'displayName'] || 
             entity.displayName || 
             entity.name || 
             entity.title || 
             entity.label || 
             entity.id
    }));
  }, [relationshipContext, column.relationshipTable, column.relationshipDisplayField]);

  // Initialize selected values
  React.useEffect(() => {
    const getInitialSelectedValues = (value: any[]): string[] => {
      if (!Array.isArray(value)) return [];
      return value.map(item => {
        if (typeof item === 'string') return item;
        else if (typeof item === 'object' && item?.id) return item.id;
        return String(item);
      });
    };
    
    setSelectedValues(getInitialSelectedValues(initialValue || []));
  }, [initialValue]);

  // Filter options based on search
  const filteredOptions = React.useMemo(() => {
    if (!searchValue) return options;
    return options.filter(option => 
      option.label.toLowerCase().includes(searchValue.toLowerCase()) ||
      option.value.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [options, searchValue]);

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => 
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredOptions[highlightedIndex]) {
            handleToggleItem(filteredOptions[highlightedIndex].value);
          } else {
            handleCommit(selectedValues);
          }
          break;
        case 'Escape':
          e.preventDefault();
          handleCancel();
          break;
        case 'Tab':
          e.preventDefault();
          handleCommit(selectedValues);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filteredOptions, highlightedIndex, selectedValues]);

  const handleToggleItem = (value: string) => {
    let newValues: string[];
    if (selectedValues.includes(value)) {
      newValues = selectedValues.filter(v => v !== value);
    } else {
      newValues = [...selectedValues, value];
    }
    setSelectedValues(newValues);
  };

  const handleRemoveItem = (value: string) => {
    const newValues = selectedValues.filter(v => v !== value);
    setSelectedValues(newValues);
  };

  const handleCommit = (values: string[]) => {
    if (hasCommitted) return;
    setHasCommitted(true);
    onCommit(values);
  };

  const handleCancel = () => {
    if (hasCommitted) return;
    setHasCommitted(true);
    onCancel();
  };

  // Reset highlighted index when filtered options change
  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions]);

  return (
    <div className="w-full h-full">
      <div className="border rounded-md shadow-lg bg-background">
        {/* Selected items display */}
        {selectedValues.length > 0 && (
          <div className="flex flex-wrap gap-1 p-2 border-b">
            {selectedValues.map((value) => {
              const option = options.find(opt => opt.value === value);
              return (
                <Badge
                  key={value}
                  variant="secondary"
                  className="text-xs flex items-center gap-1"
                >
                  {option?.label || value}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive"
                    onClick={() => handleRemoveItem(value)}
                  />
                </Badge>
              );
            })}
          </div>
        )}

        {/* Search and options */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search options..."
            value={searchValue}
            onValueChange={setSearchValue}
            autoFocus
            className="border-none focus:ring-0"
          />
          <CommandList className="max-h-48 overflow-auto">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option, index) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleToggleItem(option.value)}
                  className={cn(
                    "cursor-pointer",
                    index === highlightedIndex && "bg-accent"
                  )}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedValues.includes(option.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span>{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>

        {/* Commit button */}
        <div className="p-2 border-t">
          <button
            onClick={() => handleCommit(selectedValues)}
            className="w-full px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Done ({selectedValues.length} selected)
          </button>
        </div>
      </div>
    </div>
  );
}