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
  SingleValueProps,
  ValueContainerProps,
  MenuProps,
  CSSObjectWithLabel,
} from 'react-select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Loader2, ChevronDownIcon } from 'lucide-react';

// To help with typing the Select component from react-select
const Select = OriginalSelect as React.ComponentType<SelectProps<OptionType, false, GroupBase<OptionType>> & { inputId?: string }>;

export interface OptionType {
  value: any;
  label: string;
}

export interface NewEditableSelectProps {
  label: string;
  value: string | number | undefined;
  options: OptionType[];
  onSave: (newValue: any) => Promise<void>;
  selectProps?: SelectProps<OptionType, false>;
  className?: string;
  textClassName?: string; // Kept for API consistency, but direct application as Tailwind classes to react-select's internal text elements via the `styles` prop is limited. Text styling is part of `singleValue`.
  placeholder?: string;
  labelSrOnly?: boolean;
  id?: string; 
}

const NewEditableSelect: React.FC<NewEditableSelectProps> = ({
  label,
  value,
  options,
  onSave,
  selectProps = {},
  className,
  // textClassName, // As noted in the interface, direct class application is limited here.
  placeholder,
  labelSrOnly,
  id,
}) => {
  const [currentSelectedOption, setCurrentSelectedOption] = useState<OptionType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Ref to store the value prop as it was when the component last settled (mounted or after a successful save)
  const initialValuePropRef = useRef(value);

  useEffect(() => {
    const option = options.find(opt => opt.value === value) || null;
    setCurrentSelectedOption(option);
    initialValuePropRef.current = value; // Update ref when 'value' prop changes externally
  }, [value, options]);

  const handleChange = async (option: OptionType | null) => {
    setCurrentSelectedOption(option);
    
    // Save immediately when option is selected
    const valueToSave = option ? option.value : undefined;

    if (valueToSave !== initialValuePropRef.current) {
      setIsLoading(true);
      setError(null);
      try {
        await onSave(valueToSave);
        initialValuePropRef.current = valueToSave; // Update ref to the new successfully saved value
      } catch (e: any) {
        setError(e.message || 'Failed to save. Please try again.');
        // Revert to original option if save fails
        const originalOption = options.find(opt => opt.value === initialValuePropRef.current) || null;
        setCurrentSelectedOption(originalOption);
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

  const selectStyles: StylesConfig<OptionType, false, GroupBase<OptionType>> = {
    control: (base: CSSObjectWithLabel, state: ControlProps<OptionType, false, GroupBase<OptionType>>): CSSObjectWithLabel => ({
      ...base,
      minHeight: '2.25rem', // h-9
      height: '2.25rem',
      borderColor: state.isFocused 
        ? 'hsl(var(--ring))' 
        : error 
        ? 'hsl(var(--destructive))' 
        : 'hsl(var(--input))',
      backgroundColor: 'transparent',
      borderRadius: '0.375rem', // rounded-md (var(--radius) could be used if available globally)
      paddingLeft: '0.75rem', // px-3
      paddingRight: '0.75rem', // px-3
      boxShadow: state.isFocused 
        ? `0 0 0 1px hsl(var(--ring))` 
        : error 
        ? `0 0 0 1px hsl(var(--destructive))`
        : 'var(--xs, 0 1px 2px 0 rgba(0,0,0,0.05))', // shadow-xs
      '&:hover': { // Use & for ampersand in JSX style objects if needed, or ensure it's correctly interpreted
        borderColor: state.isFocused ? 'hsl(var(--ring))' : error ? 'hsl(var(--destructive))' : 'hsl(var(--input))', // Shadcn doesn't specify hover border change for SelectTrigger apart from focus
      },
      fontSize: '0.875rem', // text-sm
      transition: 'border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out', // Mimic Shadcn transition
      width: '100%', // Make it full width by default, can be overridden by className on wrapper
      display: 'flex',
      justifyContent: 'flex-start', // Align content to the left
    }),
    valueContainer: (base: CSSObjectWithLabel, _state: ValueContainerProps<OptionType, false, GroupBase<OptionType>>): CSSObjectWithLabel => ({
      ...base,
      padding: '0px 2px', // Minimal padding, control handles most
      gap: '0.5rem', 
      flex: 'none', // Don't let it take up all available space
      width: 'auto', // Only take up space needed for content
    }),
    singleValue: (base: CSSObjectWithLabel, _state: SingleValueProps<OptionType, false, GroupBase<OptionType>>): CSSObjectWithLabel => ({
      ...base,
      color: 'hsl(var(--foreground))',
      lineHeight: '1.25rem', // Adjusted for better vertical centering in h-9
      marginLeft: '2px',
      marginRight: '2px',
    }),
    placeholder: (base: CSSObjectWithLabel, _state: PlaceholderProps<OptionType, false, GroupBase<OptionType>>): CSSObjectWithLabel => ({
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
      padding: '0 4px', // Minimal padding around the indicator
      flex: 'none', // Don't let it stretch
      alignSelf: 'center',
    }),
    menu: (base: CSSObjectWithLabel, _state: MenuProps<OptionType, false, GroupBase<OptionType>>): CSSObjectWithLabel => ({
      ...base,
      borderRadius: '0.375rem', // rounded-md
      border: '1px solid hsl(var(--border))',
      backgroundColor: 'rgb(15, 23, 42)', // Explicit opaque dark background (slate-900)
      backgroundClip: 'padding-box', // Ensure background covers the content area
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)', // Enhanced shadow for dark theme
      color: 'rgb(248, 250, 252)', // Explicit light text color (slate-50)
      overflow: 'hidden',
      zIndex: 9999, // Higher z-index to ensure it appears above other content
      marginTop: '0.25rem', // space between trigger and menu
      opacity: 1, // Explicitly set full opacity
      // Force solid background to ensure no transparency
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    }),
    menuList: (base: CSSObjectWithLabel): CSSObjectWithLabel => ({
      ...base,
      padding: '0.25rem', // p-1
    }),
    option: (base: CSSObjectWithLabel, state: OptionProps<OptionType, false, GroupBase<OptionType>>): CSSObjectWithLabel => ({
      ...base,
      fontSize: '0.875rem', // text-sm
      padding: '0.375rem 0.5rem', // py-1.5 px-2
      borderRadius: 'calc(0.375rem - 2px)', // slightly smaller radius for options, matching shadcn
      cursor: 'default',
      backgroundColor: state.isSelected
        ? 'rgb(51, 65, 85)' // Explicit slate-600 for selected
        : state.isFocused
        ? 'rgb(30, 41, 59)' // Explicit slate-700 for focused
        : 'transparent',
      color: state.isSelected || state.isFocused
        ? 'rgb(248, 250, 252)' // Explicit light text (slate-50)
        : 'rgb(203, 213, 225)', // Explicit slate-300 for normal text
      '&:active': {
        backgroundColor: 'rgb(51, 65, 85)', // slate-600
        color: 'rgb(248, 250, 252)', // slate-50
      },
    }),
  };

  const CustomDropdownIndicatorComponent = (
    props: DropdownIndicatorProps<OptionType, false, GroupBase<OptionType>>
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
          value={currentSelectedOption}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          styles={selectStyles}
          isDisabled={isLoading || selectProps.isDisabled}
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

export default NewEditableSelect;