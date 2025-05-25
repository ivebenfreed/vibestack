import React, { useState, useEffect, useRef, useCallback, useId } from 'react';
import { EditText, EditTextarea } from 'react-edit-text';
import 'react-edit-text/dist/index.css'; // Recommended for default styling
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface NewEditableTextProps {
  label: string;
  value: string | undefined;
  fieldType: 'text' | 'textarea';
  onSave: (newValue: string) => Promise<void>;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  textareaProps?: React.TextareaHTMLAttributes<HTMLTextAreaElement>;
  className?: string;
  textClassName?: string;
  placeholder?: string;
  labelSrOnly?: boolean;
}

const NewEditableText: React.FC<NewEditableTextProps> = ({
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
}) => {
  const autoId = useId();
  const fieldId = inputProps?.id || textareaProps?.id || autoId;

  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // To keep track of the original value when editing starts, for cancel
  const [originalValueOnEditStart, setOriginalValueOnEditStart] = useState(value);

  const editTextRef = useRef<any>(null); // Or a more specific type if known for react-edit-text's forwarded ref
  const editTextAreaRef = useRef<any>(null); // Or a more specific type

  useEffect(() => {
    setCurrentValue(value);
    if (!isEditing) { // If not editing, also update the original value snapshot
      setOriginalValueOnEditStart(value);
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing) {
      // Use a timeout to ensure the element is in the DOM and focusable
      setTimeout(() => {
        if (fieldType === 'text' && editTextRef.current) {
          // Attempt to focus. The exact method might depend on how react-edit-text exposes its underlying input.
          // Common patterns: editTextRef.current.focus() or editTextRef.current.input?.focus()
          // Prioritize checking for a direct focus method, then try accessing a nested input.
          if (typeof editTextRef.current.focus === 'function') {
            editTextRef.current.focus();
          } else if (editTextRef.current.input && typeof editTextRef.current.input.focus === 'function') {
            editTextRef.current.input.focus();
          }
        } else if (fieldType === 'textarea' && editTextAreaRef.current) {
          if (typeof editTextAreaRef.current.focus === 'function') {
            editTextAreaRef.current.focus();
          } else if (editTextAreaRef.current.input && typeof editTextAreaRef.current.input.focus === 'function') {
            editTextAreaRef.current.input.focus();
          }
        }
      }, 0); // Minimal delay
    }
  }, [isEditing, fieldType]);

  const handleEditClick = () => {
    if (!isLoading) {
      setOriginalValueOnEditStart(currentValue); // Snapshot current value before editing
      setIsEditing(true);
      setError(null); // Clear previous errors
    }
  };

  const handleSave = async (newValue: string) => {
    if (newValue === originalValueOnEditStart && !error) { // Don't save if value hasn't changed and no error
      setIsEditing(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await onSave(newValue);
      setCurrentValue(newValue); // Ensure internal state matches saved value
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
      // Keep isEditing true to allow retry or correction
    } finally {
      setIsLoading(false);
    }
  };

  // react-edit-text's onSave is called with an object {name, value, previousValue}
  const handleEditTextSave = ({ value: val }: { name?: string; value: string; previousValue?: string }) => {
    handleSave(val);
  };

  const handleCancel = () => {
    setCurrentValue(originalValueOnEditStart); // Revert to value at the start of this edit session
    setIsEditing(false);
    setError(null);
  };

  // react-edit-text handles Escape for cancel by reverting to its own initial value for the edit session.
  // We can augment this with its onEditMode and onBlur if needed, but for now, its default is fine.
  // Enter (single-line) and Ctrl/Meta+Enter (multiline) are handled by react-edit-text for save.

  const commonInputStyles =
    'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]';

  const inputSpecificStyles = 'h-9';
  const textareaSpecificStyles = 'min-h-16 field-sizing-content py-2'; // Adjusted py for textarea

  const getEditTextClassName = () => {
    const baseStyles = cn(
      commonInputStyles,
      fieldType === 'text' ? inputSpecificStyles : textareaSpecificStyles,
      textClassName, // Add this line
      error ? 'border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive' : '',
      fieldType === 'text' ? inputProps?.className : textareaProps?.className
    );
    return baseStyles;
  };


  return (
    <div className={cn('space-y-1 group', className)}>
      {!labelSrOnly && (
        <Label htmlFor={fieldId} className={cn(isEditing ? '' : 'text-muted-foreground')}>
          {label}
        </Label>
      )}
      {isEditing ? (
        <div className="relative">
          {fieldType === 'text' ? (
            <EditText
              name={inputProps?.name || 'editable-text'}
              id={fieldId}
              value={currentValue || ''}
              onChange={(e) => setCurrentValue(e.target.value)}
              onSave={handleEditTextSave}
              onBlur={(_event) => {
                // Delay to allow save from Enter/Ctrl+Enter to process before blur potentially reverts
                setTimeout(() => {
                  if (isEditing && !isLoading) { // Only if still editing and not loading
                     // react-edit-text calls onSave on Enter. If blur happens without Enter,
                     // we might want to save the current input value.
                     // For now, rely on explicit save (Enter) or cancel (Escape).
                     // If we want blur to save, we'd call handleSave(currentValue) here.
                     // Let's align with EditableField.tsx: save on blur if editing.
                     handleSave(currentValue || '');
                  }
                }, 150); // EditableField used 100ms, slightly more to be safe
              }}
              onEditMode={() => setError(null)} // Clear error when re-entering edit mode
              ref={editTextRef}
              inputClassName={getEditTextClassName()}
              className={textClassName}
              placeholder={placeholder}
              disabled={isLoading}
              {...inputProps}
            />
          ) : (
            <EditTextarea
              name={textareaProps?.name || 'editable-textarea'}
              id={fieldId}
              value={currentValue || ''}
              onChange={(e) => setCurrentValue(e.target.value)}
              onSave={handleEditTextSave}
              onBlur={(_event) => {
                setTimeout(() => {
                  if (isEditing && !isLoading) {
                    handleSave(currentValue || '');
                  }
                }, 150);
              }}
              onEditMode={() => setError(null)}
              ref={editTextAreaRef}
              inputClassName={getEditTextClassName()}
              className={textClassName}
              rows={textareaProps?.rows || 3}
              placeholder={placeholder}
              disabled={isLoading}
              {...textareaProps}
            />
          )}
          {isLoading && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      ) : (
        <div
          className={cn(
            'min-h-[2.25rem] flex items-center rounded-md border border-transparent p-2 cursor-text w-full', // h-9 is 2.25rem, py-1 + border = ~2.5rem for input
            'group-hover:border-dashed group-hover:border-gray-300 dark:group-hover:border-gray-700',
            textClassName,
            (!currentValue && placeholder) ? 'text-muted-foreground italic' : '',
            fieldType === 'textarea' ? 'whitespace-pre-wrap break-words min-h-16' : 'truncate' // Allow textarea to show multiple lines
          )}
          role="button"
          tabIndex={0}
          onClick={handleEditClick}
          onFocus={handleEditClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleEditClick();
            }
          }}
          aria-label={`Edit ${label}`}
        >
          {currentValue || <span className="text-muted-foreground italic">{placeholder}</span>}
        </div>
      )}
      {error && isEditing && <p className="text-sm text-red-500 pt-1">{error}</p>}
    </div>
  );
};

export default NewEditableText;