import React, { useState, useEffect, useRef } from 'react';
import OriginalSelect, {
  Props as SelectProps,
  StylesConfig,
  GroupBase,
  components,
  DropdownIndicatorProps,
  ControlProps,
  OptionProps,
  PlaceholderProps,
  MultiValueProps,
  ValueContainerProps,
  MenuProps,
  CSSObjectWithLabel,
} from 'react-select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Loader2, ChevronDownIcon } from 'lucide-react';

// To help with typing the Select component from react-select for multi-select
const Select = OriginalSelect as React.ComponentType<SelectProps<OptionType, true, GroupBase<OptionType>> & { inputId?: string }>;

export interface OptionType {
  value: any;
  label: string;
}

export interface NewEditableMultiSelectProps {
  label: string;
  value: (string | number)[] | undefined;
  options: OptionType[];
  onSave: (newValue: any[]) => Promise<void>;
  selectProps?: SelectProps<OptionType, true>;
  className?: string;
  textClassName?: string;
  placeholder?: string;
  labelSrOnly?: boolean;
  id?: string; 
}

const NewEditableMultiSelect: React.FC<NewEditableMultiSelectProps> = ({
  label,
  value,
  options,
  onSave,
  selectProps = {},
  className,
  placeholder,
  labelSrOnly,
  id,
}) => {
  const [currentSelectedOptions, setCurrentSelectedOptions] = useState<OptionType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Ref to store the value prop as it was when the component last settled (mounted or after a successful save)
  const initialValuePropRef = useRef(value);

  useEffect(() => {
    const selectedOptions = value ? options.filter(opt => value.includes(opt.value as string | number)) : [];
    setCurrentSelectedOptions(selectedOptions);
    initialValuePropRef.current = value; // Update ref when 'value' prop changes externally
  }, [value, options]);

  const handleChange = async (selectedOptions: readonly OptionType[] | null) => {
    const newSelectedOptions = selectedOptions ? [...selectedOptions] : [];
    setCurrentSelectedOptions(newSelectedOptions);
    
    // Save immediately when options are selected
    const valuesToSave = newSelectedOptions.map(opt => opt.value);

    // Compare arrays
    const hasChanged = !initialValuePropRef.current || 
      initialValuePropRef.current.length !== valuesToSave.length ||
      !initialValuePropRef.current.every(val => valuesToSave.includes(val as any)) ||
      !valuesToSave.every(val => initialValuePropRef.current!.includes(val as string | number));

    if (hasChanged) {
      setIsLoading(true);
      setError(null);
      try {
        await onSave(valuesToSave);
        initialValuePropRef.current = valuesToSave; // Update ref to the new successfully saved value
      } catch (e: any) {
        setError(e.message || 'Failed to save. Please try again.');
        // Revert to original options if save fails
        const originalOptions = initialValuePropRef.current ? 
          options.filter(opt => initialValuePropRef.current!.includes(opt.value as string | number)) : [];
        setCurrentSelectedOptions(originalOptions);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleBlur = async () => {
    // Keep blur handler simple - just for cleanup if needed
    // Main save logic now happens in handleChange
  };
  
  const componentId = id || selectProps?.id || React.useId();

  const selectStyles: StylesConfig<OptionType, true, GroupBase<OptionType>> = {
    control: (base: CSSObjectWithLabel, state: ControlProps<OptionType, true, GroupBase<OptionType>>): CSSObjectWithLabel => ({
      ...base,
      minHeight: '2.25rem', // h-9
      borderColor: state.isFocused 
        ? 'hsl(var(--ring))' 
        : error 
        ? 'hsl(var(--destructive))' 
        : 'hsl(var(--input))',
      backgroundColor: 'transparent',
      borderRadius: '0.375rem', // rounded-md
      paddingLeft: '0.75rem', // px-3
      paddingRight: '0.75rem', // px-3
      boxShadow: state.isFocused 
        ? `0 0 0 1px hsl(var(--ring))` 
        : error 
        ? `0 0 0 1px hsl(var(--destructive))`
        : 'var(--xs, 0 1px 2px 0 rgba(0,0,0,0.05))', // shadow-xs
      '&:hover': {
        borderColor: state.isFocused ? 'hsl(var(--ring))' : error ? 'hsl(var(--destructive))' : 'hsl(var(--input))',
      },
      fontSize: '0.875rem', // text-sm
      transition: 'border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
      width: '100%',
      display: 'flex',
      justifyContent: 'flex-start',
    }),
    valueContainer: (base: CSSObjectWithLabel, _state: ValueContainerProps<OptionType, true, GroupBase<OptionType>>): CSSObjectWithLabel => ({
      ...base,
      padding: '2px',
      gap: '0.25rem',
      flexWrap: 'wrap',
    }),
    multiValue: (base: CSSObjectWithLabel, _state: MultiValueProps<OptionType, true, GroupBase<OptionType>>): CSSObjectWithLabel => ({
      ...base,
      backgroundColor: 'hsl(var(--secondary))',
      borderRadius: '0.25rem',
      margin: '1px',
    }),
    multiValueLabel: (base: CSSObjectWithLabel): CSSObjectWithLabel => ({
      ...base,
      color: 'hsl(var(--secondary-foreground))',
      fontSize: '0.75rem', // text-xs
      padding: '2px 6px',
    }),
    multiValueRemove: (base: CSSObjectWithLabel): CSSObjectWithLabel => ({
      ...base,
      color: 'hsl(var(--secondary-foreground))',
      ':hover': {
        backgroundColor: 'hsl(var(--destructive))',
        color: 'hsl(var(--destructive-foreground))',
      },
      borderRadius: '0 0.25rem 0.25rem 0',
    }),
    placeholder: (base: CSSObjectWithLabel): CSSObjectWithLabel => ({
      ...base,
      color: 'hsl(var(--muted-foreground))',
      marginLeft: '2px',
      marginRight: '2px',
    }),
    input: (base: CSSObjectWithLabel): CSSObjectWithLabel => ({
      ...base,
      color: 'hsl(var(--foreground))',
      margin: '0px',
      paddingTop: '0px',
      paddingBottom: '0px',
    }),
    indicatorsContainer: (base: CSSObjectWithLabel): CSSObjectWithLabel => ({
      ...base,
      padding: '0 4px',
      flex: 'none',
      alignSelf: 'center',
    }),
    menu: (base: CSSObjectWithLabel, _state: MenuProps<OptionType, true, GroupBase<OptionType>>): CSSObjectWithLabel => ({
      ...base,
      borderRadius: '0.375rem',
      border: '1px solid hsl(var(--border))',
      backgroundColor: 'rgb(15, 23, 42)', // Explicit dark background
      backgroundClip: 'padding-box',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
      color: 'rgb(248, 250, 252)',
      overflow: 'hidden',
      zIndex: 9999,
      marginTop: '0.25rem',
      opacity: 1,
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    }),
    menuList: (base: CSSObjectWithLabel): CSSObjectWithLabel => ({
      ...base,
      padding: '0.25rem',
    }),
    option: (base: CSSObjectWithLabel, state: OptionProps<OptionType, true, GroupBase<OptionType>>): CSSObjectWithLabel => ({
      ...base,
      fontSize: '0.875rem',
      padding: '0.375rem 0.5rem',
      borderRadius: 'calc(0.375rem - 2px)',
      cursor: 'default',
      backgroundColor: state.isSelected
        ? 'rgb(51, 65, 85)' // slate-600 for selected
        : state.isFocused
        ? 'rgb(30, 41, 59)' // slate-700 for focused
        : 'transparent',
      color: state.isSelected || state.isFocused
        ? 'rgb(248, 250, 252)' // slate-50
        : 'rgb(203, 213, 225)', // slate-300
      '&:active': {
        backgroundColor: 'rgb(51, 65, 85)',
        color: 'rgb(248, 250, 252)',
      },
    }),
  };

  const CustomDropdownIndicatorComponent = (
    props: DropdownIndicatorProps<OptionType, true, GroupBase<OptionType>>
  ) => (
    <components.DropdownIndicator {...props}>
      <ChevronDownIcon className="h-4 w-4 opacity-50" />
    </components.DropdownIndicator>
  );

  return (
    <div className={cn('space-y-1 w-full', className)}>
      {!labelSrOnly && (
        <Label htmlFor={componentId} className={cn(labelSrOnly && 'sr-only', 'mb-1 block')}>
          {label}
        </Label>
      )}
      <div className="relative">
        <Select
          inputId={componentId}
          options={options}
          value={currentSelectedOptions}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          styles={selectStyles}
          isDisabled={isLoading || selectProps.isDisabled}
          isMulti={true}
          components={{
            IndicatorSeparator: () => null,
            DropdownIndicator: isLoading 
              ? () => <Loader2 className="h-4 w-4 animate-spin mx-2 my-auto text-muted-foreground" /> 
              : CustomDropdownIndicatorComponent,
            ...selectProps.components,
          }}
          aria-label={labelSrOnly ? label : undefined}
          {...selectProps}
        />
      </div>
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
};

export default NewEditableMultiSelect; 