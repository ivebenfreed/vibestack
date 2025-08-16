import { Component, JSX, Show, splitProps } from 'solid-js';

interface FormFieldProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  required?: boolean;
  helperText?: string;
}

export const FormField: Component<FormFieldProps> = (props) => {
  const [local, inputProps] = splitProps(props, ['label', 'error', 'required', 'helperText']);
  
  return (
    <div class="space-y-1">
      <label for={inputProps.id} class="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {local.label}
        {local.required && <span class="text-red-500 ml-1">*</span>}
      </label>
      <input
        {...inputProps}
        class={`input w-full ${local.error ? 'border-red-500' : ''} ${inputProps.class || ''}`}
        aria-invalid={!!local.error}
        aria-describedby={local.error ? `${inputProps.id}-error` : undefined}
      />
      <Show when={local.error}>
        <p id={`${inputProps.id}-error`} class="text-sm text-red-600 dark:text-red-400">
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