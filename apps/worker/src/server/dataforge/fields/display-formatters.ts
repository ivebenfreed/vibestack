/**
 * Display Formatters for Complex Field Types
 * 
 * Provides centralized formatting functions to prevent "[object Object]" display issues
 * in data grids and other UI components.
 */

import { formatCurrencyForDisplay } from './currency';
import { formatForDisplay as formatJsonForDisplay, formatJsonSummary } from './json';

export interface DisplayFormatterOptions {
  maxLength?: number;
  showTooltip?: boolean;
  compact?: boolean;
}

/**
 * Master formatter that routes to appropriate field-specific formatter
 */
export function formatFieldForDisplay(
  value: any, 
  fieldType: string, 
  options: DisplayFormatterOptions = {},
  fieldSchema?: any
): string {
  if (value == null || value === undefined) {
    return '';
  }

  // Route to field-specific formatters
  switch (fieldType) {
    case 'currency':
      return formatCurrencyForDisplay(value);
      
    case 'json':
    case 'jsonb':
      return formatJsonForDisplay(value);
      
    case 'file':
      return formatFileForDisplay(value, options);
      
    case 'multi-select':
    case 'multi_select':
      return formatMultiSelectForDisplay(value, options, fieldSchema);
      
    case 'select':
    case 'priority_set':  // Legacy type - TODO: Remove after entity migration
    case 'status_set':    // Legacy type - TODO: Remove after entity migration
      return formatSelectForDisplay(value, options, fieldSchema);
      
    case 'rollup_count':
    case 'rollup_sum':
    case 'rollup_average':
    case 'rollup_concat':
      return formatRollupForDisplay(value, fieldType, options);
      
    case 'computed_expression':
    case 'computed_formula':
      return formatComputedForDisplay(value, fieldType, options);
      
    case 'custom_user_reference':
    case 'custom_entity_reference':
    case 'user_reference':
    case 'entity_reference':
      return formatReferenceForDisplay(value, fieldType, options);
      
    default:
      return formatGenericForDisplay(value, options);
  }
}

/**
 * Format file field data
 */
function formatFileForDisplay(value: any, options: DisplayFormatterOptions): string {
  if (typeof value === 'string') return value;
  
  if (typeof value === 'object' && value !== null) {
    if (value.filename || value.name) {
      return value.filename || value.name;
    }
    
    if (value.url) {
      const url = value.url;
      const filename = url.split('/').pop() || 'File';
      return filename.length > 30 ? filename.substring(0, 27) + '...' : filename;
    }
    
    if (Array.isArray(value)) {
      return `${value.length} file${value.length !== 1 ? 's' : ''}`;
    }
    
    return 'File data';
  }
  
  return String(value);
}

/**
 * Format select field data with badge styling from schema
 */
function formatSelectForDisplay(value: any, options: DisplayFormatterOptions, fieldSchema?: any): string {
  if (!value) return '';
  
  const stringValue = String(value);
  
  // Try to get color information from schema
  let color = null;
  let backgroundColor = null;
  let icon = null;
  
  // Check editor options first
  if (fieldSchema?.editor?.options) {
    const option = fieldSchema.editor.options.find((opt: any) => opt.value === stringValue);
    if (option) {
      color = option.color;
      backgroundColor = option.backgroundColor;
      icon = option.icon;
    }
  }
  
  // If no color found, check conditional formatting
  if (!color && fieldSchema?.display?.conditionalFormatting) {
    const formatting = fieldSchema.display.conditionalFormatting.find((fmt: any) => 
      fmt.condition === `value === "${stringValue}"`
    );
    if (formatting?.style) {
      color = formatting.style.color;
      backgroundColor = formatting.style.backgroundColor;
    }
  }
  
  // Return HTML badge if colors are available, otherwise plain text
  if (color || backgroundColor) {
    const badgeStyles = [];
    if (color) badgeStyles.push(`color: ${color}`);
    if (backgroundColor) badgeStyles.push(`background-color: ${backgroundColor}`);
    
    const styleAttr = badgeStyles.length > 0 ? ` style="${badgeStyles.join('; ')}"` : '';
    const badgeClass = `inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ring-gray-500/10`;
    
    return `<span class="${badgeClass}"${styleAttr}>${stringValue}</span>`;
  }
  
  return stringValue;
}

/**
 * Format multi-select field data with tag-style badges
 */
function formatMultiSelectForDisplay(value: any, options: DisplayFormatterOptions, fieldSchema?: any): string {
  if (!value) return '';
  
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    
    const maxDisplay = options.compact ? 2 : 3;
    const visibleValues = value.slice(0, maxDisplay);
    const remainingCount = value.length - visibleValues.length;
    
    // Try to get color information from schema options
    const getTagBadge = (tagValue: string): string => {
      let color = null;
      let backgroundColor = null;
      
      // Check editor options for color information
      if (fieldSchema?.editor?.options) {
        const option = fieldSchema.editor.options.find((opt: any) => opt.value === tagValue);
        if (option) {
          color = option.color;
          backgroundColor = option.backgroundColor;
        }
      }
      
      // If no colors from schema, generate consistent colors based on tag value
      if (!color) {
        color = generateTagColor(tagValue);
        backgroundColor = generateTagBackgroundColor(color);
      }
      
      // Return HTML badge for tag
      const badgeStyles = [];
      if (color) badgeStyles.push(`color: ${color}`);
      if (backgroundColor) badgeStyles.push(`background-color: ${backgroundColor}`);
      
      const styleAttr = badgeStyles.length > 0 ? ` style="${badgeStyles.join('; ')}"` : '';
      const badgeClass = `inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ring-gray-500/10 mr-1`;
      
      return `<span class="${badgeClass}"${styleAttr}>${tagValue}</span>`;
    };
    
    // Generate badges for visible values
    const badges = visibleValues.map(getTagBadge).join('');
    
    // Add remaining count indicator
    const remainingBadge = remainingCount > 0 
      ? `<span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-500/10">+${remainingCount}</span>`
      : '';
    
    return badges + remainingBadge;
  }
  
  return String(value);
}

/**
 * Generate consistent color for tag value
 */
function generateTagColor(value: string): string {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // yellow
    '#ef4444', // red
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316', // orange
    '#ec4899', // pink
    '#6b7280'  // gray
  ];
  
  // Simple hash function for consistent color assignment
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) & 0xffffffff;
  }
  
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Generate background color from foreground color for tags
 */
function generateTagBackgroundColor(color: string): string {
  const colorMap: Record<string, string> = {
    '#3b82f6': '#dbeafe', // blue
    '#10b981': '#d1fae5', // emerald  
    '#f59e0b': '#fef3c7', // yellow
    '#ef4444': '#fee2e2', // red
    '#8b5cf6': '#ede9fe', // violet
    '#06b6d4': '#cffafe', // cyan
    '#84cc16': '#ecfccb', // lime
    '#f97316': '#fed7aa', // orange
    '#ec4899': '#fce7f3', // pink
    '#6b7280': '#f3f4f6'  // gray
  };
  
  return colorMap[color] || '#f3f4f6';
}

/**
 * Format rollup field data (should show calculated values)
 */
function formatRollupForDisplay(value: any, fieldType: string, options: DisplayFormatterOptions): string {
  if (value == null) return '0';
  
  const numValue = Number(value);
  if (!isNaN(numValue)) {
    switch (fieldType) {
      case 'rollup_count':
        return String(Math.floor(numValue));
      case 'rollup_sum':
      case 'rollup_average':
        return numValue.toFixed(2);
      default:
        return String(numValue);
    }
  }
  
  // For concat or non-numeric rollups
  return String(value);
}

/**
 * Format computed field data
 */
function formatComputedForDisplay(value: any, fieldType: string, options: DisplayFormatterOptions): string {
  if (value == null) return '';
  
  // If it's a computed result, show the result
  if (typeof value === 'object' && value.result !== undefined) {
    return String(value.result);
  }
  
  return String(value);
}

/**
 * Format reference field data
 */
function formatReferenceForDisplay(value: any, fieldType: string, options: DisplayFormatterOptions): string {
  if (!value) return '';
  
  // If it's an array of references
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    if (value.length === 1) return formatSingleReference(value[0]);
    return `${formatSingleReference(value[0])} +${value.length - 1} more`;
  }
  
  return formatSingleReference(value);
}

/**
 * Format a single reference object
 */
function formatSingleReference(ref: any): string {
  if (!ref) return '';
  
  if (typeof ref === 'string') return ref;
  
  if (typeof ref === 'object') {
    // Try common display fields
    return ref.name || ref.title || ref.label || ref.id || 'Reference';
  }
  
  return String(ref);
}

/**
 * Generic formatter for complex objects
 */
function formatGenericForDisplay(value: any, options: DisplayFormatterOptions): string {
  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return `[${value.length} items]`;
    }
    
    // Try to extract meaningful display value
    const displayFields = ['name', 'title', 'label', 'description', 'value'];
    for (const field of displayFields) {
      if (value[field] && typeof value[field] === 'string') {
        const displayValue = value[field];
        if (options.maxLength && displayValue.length > options.maxLength) {
          return displayValue.substring(0, options.maxLength - 3) + '...';
        }
        return displayValue;
      }
    }
    
    // Show object summary
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    if (keys.length === 1) return `{${keys[0]}}`;
    return `{${keys.length} properties}`;
  }
  
  const str = String(value);
  if (options.maxLength && str.length > options.maxLength) {
    return str.substring(0, options.maxLength - 3) + '...';
  }
  
  return str;
}

/**
 * Get appropriate tooltip content for complex field data
 */
export function getFieldTooltip(value: any, fieldType: string): string {
  if (value == null) return '';
  
  switch (fieldType) {
    case 'json':
    case 'jsonb':
      try {
        const obj = typeof value === 'string' ? JSON.parse(value) : value;
        return JSON.stringify(obj, null, 2);
      } catch {
        return String(value);
      }
      
    case 'file':
      if (typeof value === 'object' && value !== null) {
        const parts = [];
        if (value.filename) parts.push(`Name: ${value.filename}`);
        if (value.size) parts.push(`Size: ${formatFileSize(value.size)}`);
        if (value.type) parts.push(`Type: ${value.type}`);
        return parts.join('\n') || 'File information';
      }
      break;
      
    case 'currency':
      if (typeof value === 'object' && value !== null) {
        return `Amount: ${value.amount || 0}\nCurrency: ${value.currency || 'USD'}`;
      }
      break;
  }
  
  // Generic tooltip for complex objects
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return 'Complex data - click to edit';
    }
  }
  
  return String(value);
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Check if a value needs complex formatting
 */
export function needsComplexFormatting(value: any): boolean {
  if (value == null) return false;
  
  if (typeof value === 'object') {
    // Simple objects with obvious display values don't need complex formatting
    if (!Array.isArray(value) && (value.name || value.title || value.label)) {
      return false;
    }
    return true;
  }
  
  return false;
}

// Export all formatters for direct use
export {
  formatCurrencyForDisplay,
  formatJsonForDisplay,
  formatJsonSummary
};