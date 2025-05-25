import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button'; // For display mode styling
import { ChevronDown, Loader2 } from 'lucide-react';

interface EditableSelectFieldProps {
  label: string;
  value: string | number | undefined;
  selectOptions: { value: string; label: string }[];
  onSave: (newValue: any) => Promise<void>;
  className?: string;
  textClassName?: string;
  placeholder?: string;
  labelSrOnly?: boolean;
  disabled?: boolean;
}

export const EditableSelectField: React.FC<EditableSelectFieldProps> = ({
  label,
  value,
  selectOptions,
  onSave,
  className,
  textClassName,
  placeholder = 'Select an option',
  labelSrOnly = false,
  disabled = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setCurrentValue(value);
  }, [value]);

  // useEffect(() => {
  //   if (isEditing && !disabled) {
  //     selectTriggerRef.current?.focus(); // Removing this to let the `open` prop handle behavior
  //   }
  // }, [isEditing, disabled]);

  const handleSave = useCallback(async (newValueToSave: string | number | undefined) => {
    if (newValueToSave === value) {
      setIsEditing(false); // Exit edit mode even if value is unchanged
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await onSave(newValueToSave);
      // Value will be updated via prop, then useEffect will update currentValue
    } catch (err: any) {
      setError(err.message || 'Failed to save');
      // Optionally revert currentValue if save fails, or keep it for retry
      // setCurrentValue(value); // Revert to original value from props
    } finally {
      setIsLoading(false);
      setIsEditing(false); // Ensure we exit edit mode
    }
  }, [onSave, value]);

  const handleCancel = () => {
    setCurrentValue(value); // Revert to original value
    setError(null);
    setIsEditing(false); // Exit edit mode
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
    // Enter key behavior is handled by the Select component itself for opening/closing
  };

  if (isEditing && !disabled) {
    return (
      <div className={cn('space-y-1', className)}>
        {!labelSrOnly && <Label htmlFor={label}>{label}</Label>}
        <Select
          open={isEditing} // Control open state directly
          onOpenChange={(isOpen) => {
            setIsEditing(isOpen); // Update isEditing based on Select's open state
            if (!isOpen) { // If Select is closed
              handleSave(currentValue); // Save the current value
            }
          }}
          value={currentValue as string || undefined}
          onValueChange={(val) => {
            setCurrentValue(val); // Update internal state immediately
            // For immediate save on value change (optional, current logic saves on close):
            // handleSave(val);
            // setIsEditing(false); // And close if saving immediately
          }}
          disabled={isLoading}
        >
          <SelectTrigger
            ref={selectTriggerRef}
            id={label}
            onKeyDown={handleKeyDown} // Keep for Escape key
            className={cn(
              'w-full font-normal text-left justify-start', // Added font-normal, text-left and justify-start to match Button
              error ? 'border-red-500' : '',
              textClassName // Apply textClassName here for consistent text styling
            )}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {selectOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  const displayLabel = selectOptions?.find(opt => opt.value === currentValue)?.label || currentValue;

  return (
    <div className={cn('space-y-1', className)}>
      {!labelSrOnly && <Label className="text-sm font-medium text-muted-foreground">{label}</Label>}
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={isEditing}
        aria-label={`Edit ${label}`}
        className={cn(
          'w-full justify-between font-normal min-h-[2.5rem] h-auto py-2 px-3 text-left',
          !currentValue && 'text-muted-foreground',
          textClassName,
          disabled ? 'opacity-70 cursor-not-allowed' : 'hover:bg-muted/50'
        )}
        onClick={() => !disabled && setIsEditing(true)}
        onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) setIsEditing(true);}}
        disabled={disabled || isLoading}
      >
        <span className="truncate">
          {displayLabel || placeholder}
        </span>
        {!disabled && <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
      </Button>
      {isLoading && isEditing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      {error && !isEditing && <p className="text-sm text-red-500 pt-1">{error}</p>}
    </div>
  );
};