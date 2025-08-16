import { Component, JSX, Show, For, splitProps } from 'solid-js';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends JSX.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: string;
  required?: boolean;
  helperText?: string;
  placeholder?: string;
}

export const SelectField: Component<SelectFieldProps> = (props) => {
  const [local, selectProps] = splitProps(props, ['label', 'options', 'error', 'required', 'helperText', 'placeholder']);
  
  return (
    <div class="space-y-1">
      <label for={selectProps.id} class="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {local.label}
        {local.required && <span class="text-red-500 ml-1">*</span>}
      </label>
      <select
        {...selectProps}
        class={`input w-full ${local.error ? 'border-red-500' : ''} ${selectProps.class || ''}`}
        aria-invalid={!!local.error}
        aria-describedby={local.error ? `${selectProps.id}-error` : undefined}
      >
        {local.placeholder && (
          <option value="" disabled selected>
            {local.placeholder}
          </option>
        )}
        <For each={local.options}>
          {(option) => (
            <option value={option.value}>{option.label}</option>
          )}
        </For>
      </select>
      <Show when={local.error}>
        <p id={`${selectProps.id}-error`} class="text-sm text-red-600 dark:text-red-400">
          {local.error}
        </p>
      </Show>
      <Show when={local.helperText && !local.error}>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {local.helperText}
        </p>
      </Show>
    </div>
  );
};