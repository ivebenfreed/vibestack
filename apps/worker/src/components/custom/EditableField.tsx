import React, { useState, useEffect, useRef, useCallback, useId } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react'; // Using lucide-react for a spinner icon

interface EditableFieldProps {
  label: string;
  value: string | number | undefined;
  fieldType: 'text' | 'textarea' | 'select';
  selectOptions?: { value: string; label: string }[];
  onSave: (newValue: any) => Promise<void>;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  textareaProps?: React.TextareaHTMLAttributes<HTMLTextAreaElement>;
  className?: string;
  textClassName?: string;
  placeholder?: string;
  labelSrOnly?: boolean; // Added for cases where label is visually handled by parent (e.g. CardTitle)
}

export const EditableField: React.FC<EditableFieldProps> = ({
  label,
  value,
  fieldType,
  selectOptions,
  onSave,
  inputProps,
  textareaProps,
  className,
  textClassName,
  placeholder = 'Click to edit',
  labelSrOnly = false,
}) => {
  const autoId = useId();
  const fieldId = inputProps?.id || textareaProps?.id || autoId;

  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const selectTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setCurrentValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing) {
      if (fieldType === 'select') {
        selectTriggerRef.current?.focus();
      } else {
        inputRef.current?.focus();
        // For textarea, move cursor to end
        if (fieldType === 'textarea' && inputRef.current) {
          const el = inputRef.current as HTMLTextAreaElement;
          el.setSelectionRange(el.value.length, el.value.length);
        }
      }
    }
  }, [isEditing, fieldType]);

  const handleSave = useCallback(async () => {
    if (currentValue === value && fieldType !== 'select') { // For select, save even if value is same (e.g. if it was null before)
      setIsEditing(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await onSave(currentValue);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
      // Optionally, revert currentValue to original value or keep it for user to retry
      // For now, keeping it to allow retry or further edits.
    } finally {
      setIsLoading(false);
    }
  }, [currentValue, onSave, value, fieldType]);

  const handleCancel = () => {
    setCurrentValue(value);
    setIsEditing(false);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && fieldType === 'text') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Enter' && fieldType === 'textarea') {
      if (e.shiftKey) {
        // Shift+Enter: Allow new line (default behavior)
        return;
      } else {
        // Enter alone: Save
        e.preventDefault();
        handleSave();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleBlur = () => {
    // Timeout to allow click on save/cancel or other elements without premature blur save
    setTimeout(() => {
      if (document.activeElement !== inputRef.current && document.activeElement !== selectTriggerRef.current) {
         if (isEditing) handleSave(); // Save on blur only if editing
      }
    }, 100);
  };


  if (isEditing) {
    return (
      <div className={cn('space-y-1', className)}>
        {!labelSrOnly && <Label htmlFor={fieldId}>{label}</Label>}
        {fieldType === 'text' && (
          <Input
            ref={inputRef as React.Ref<HTMLInputElement>}
            id={fieldId}
            type="text"
            value={currentValue as string || ''}
            onChange={(e) => setCurrentValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            disabled={isLoading}
            {...inputProps}
            className={cn(error ? 'border-red-500' : '', inputProps?.className)}
          />
        )}
        {fieldType === 'textarea' && (
          <Textarea
            ref={inputRef as React.Ref<HTMLTextAreaElement>}
            id={fieldId}
            value={currentValue as string || ''}
            onChange={(e) => setCurrentValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            disabled={isLoading}
            {...textareaProps}
            className={cn(error ? 'border-red-500' : '', textareaProps?.className)}
          />
        )}
        {fieldType === 'select' && selectOptions && (
          <Select
            value={currentValue as string || undefined}
            onValueChange={(val) => {
              setCurrentValue(val);
              // For select, we can save immediately on change or wait for blur.
              // Plan says "Select change & blur", so we update state and let blur handle save.
            }}
            disabled={isLoading}
          >
            <SelectTrigger
              ref={selectTriggerRef}
              id={fieldId} // Consistent ID usage
              onBlur={handleBlur} // Save on blur
              className={cn(error ? 'border-red-500' : '')}
            >
              <SelectValue placeholder={`Select ${label}`} />
            </SelectTrigger>
            <SelectContent>
              {selectOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className={cn('group', className)} onClick={() => !isEditing && setIsEditing(true)}>
      {!labelSrOnly && <Label className="text-sm font-medium text-muted-foreground">{label}</Label>}
      <div
        className={cn(
          'min-h-[2.5rem] flex items-center rounded-md border border-transparent group-hover:border-dashed group-hover:border-gray-300 p-2 cursor-text',
          textClassName,
          (!currentValue && placeholder) ? 'text-muted-foreground italic' : ''
        )}
        role="button"
        tabIndex={0}
        onFocus={() => !isEditing && setIsEditing(true)} // Allow focus to trigger edit
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') !isEditing && setIsEditing(true);}} // Allow Enter/Space to trigger edit
      >
        {fieldType === 'select'
          ? selectOptions?.find(opt => opt.value === currentValue)?.label || currentValue || placeholder
          : currentValue || placeholder
        }
      </div>
    </div>
  );
};