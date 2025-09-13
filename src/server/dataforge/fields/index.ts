/**
 * Field Types - Enhanced file-based field system
 * 
 * Each field type has its own file with all logic:
 * - getDefaultValue()
 * - validate() 
 * - getSqlType()
 * - getSqlDefault()
 * 
 * NEW: Enhanced metadata methods:
 * - getValidationMetadata()
 * - getDisplayMetadata() 
 * - getEditorMetadata()
 * - getCapabilities()
 * - getAccessibilityMetadata()
 */

export type { EnhancedFieldHandler, ValidationMetadata, DisplayMetadata, EditorMetadata, FieldCapabilities, AccessibilityMetadata } from './types';

import * as text from './text';
import * as richText from './rich-text';
import * as date from './date';
import * as singleSelect from './single-select';
import * as multiSelect from './multi-select';
import * as number from './number';
import * as integer from './integer';
import * as decimal from './decimal';
import * as percentage from './percentage';
import * as time from './time';
import * as boolean from './boolean';
import * as email from './email';
import * as url from './url';
import * as file from './file';
import * as phone from './phone';
import * as currency from './currency';
import * as color from './color';
import * as customUserReference from './custom_user_reference';
import * as customEntityReference from './custom_entity_reference';
import * as customOptionReference from './custom_option_reference';
import * as rollupCount from './rollup_count';
import * as rollupSum from './rollup_sum';
import * as rollupAverage from './rollup_average';
import * as rollupConcat from './rollup_concat';
import * as computedFormula from './computed_formula';
import * as computedExpression from './computed_expression';
import * as priority from './priority';
import * as status from './status';
import * as json from './json';
import * as rating from './rating';
import * as slider from './slider';
import * as image from './image';
import * as datetimeLocal from './datetime-local';
import * as address from './address';
import * as coordinates from './coordinates';
import * as textarea from './textarea';
import * as markdown from './markdown';

// Import types for enhanced handlers
import type { EnhancedFieldHandler } from './types';

export const fieldTypes = {
  text,
  'rich-text': richText,
  'rich_text': richText,  // alias
  date,
  datetime: date,  // alias
  select: singleSelect,  // alias for generic select type
  'single-select': singleSelect,
  'single_select': singleSelect,  // alias
  'multi-select': multiSelect, 
  'multi_select': multiSelect,  // alias
  number,
  integer,  // dedicated integer handler
  decimal,  // dedicated decimal handler  
  percentage,  // dedicated percentage handler
  time,  // dedicated time handler
  boolean,
  email,
  url,
  file,
  phone,
  currency,
  color,
  'custom_user_reference': customUserReference,
  'custom_entity_reference': customEntityReference,
  'custom_option_reference': customOptionReference,
  'rollup_count': rollupCount,
  'rollup_sum': rollupSum,
  'rollup_average': rollupAverage,
  'rollup_concat': rollupConcat,
  'computed_formula': computedFormula,
  'computed_expression': computedExpression,
  priority,
  'priority_set': priority,  // alias for archetype fields
  status,
  'status_set': status,  // alias for archetype fields
  json,
  jsonb: json,  // alias
  
  // Phase 3: Visual interaction fields
  rating,
  slider,
  image,
  'datetime-local': datetimeLocal,
  'datetime_local': datetimeLocal,  // alias
  
  // Phase 4: Specialized fields
  address,
  coordinates,
  textarea,
  longtext: textarea,  // alias for long text areas
  markdown
};

export function getFieldHandler(type: string) {
  return fieldTypes[type as keyof typeof fieldTypes] || null;
}

/**
 * Get enhanced field handler with rich metadata support
 * Checks if the field handler implements the enhanced interface
 */
export function getEnhancedFieldHandler(type: string): EnhancedFieldHandler | null {
  const handler = getFieldHandler(type);
  if (!handler) return null;
  
  // Check if handler implements enhanced interface
  if (handler.getValidationMetadata && handler.getDisplayMetadata && handler.getEditorMetadata) {
    return handler as EnhancedFieldHandler;
  }
  
  // Return legacy handler wrapped with default metadata
  return createLegacyWrapper(handler, type);
}

/**
 * Wrap legacy handlers with default metadata implementations
 */
function createLegacyWrapper(handler: any, type: string): EnhancedFieldHandler {
  return {
    ...handler,
    
    getValidationMetadata: (definition: any) => ({
      messages: {
        required: `${definition.name} is required`
      }
    }),
    
    getDisplayMetadata: (definition: any) => ({
      width: 200,
      textAlign: 'left' as const
    }),
    
    getEditorMetadata: (definition: any) => ({
      type: mapTypeToEditor(type)
    }),
    
    getCapabilities: () => ({
      supportsSorting: true,
      supportsFiltering: true,
      supportsGrouping: false,
      supportsAggregation: false,
      requiresSpecialEditor: false,
      hasRichDisplay: false,
      supportsValidation: true,
      supportsFormatting: false
    }),
    
    getAccessibilityMetadata: (definition: any) => ({
      ariaLabel: `${definition.name} input`,
      role: 'textbox'
    })
  };
}

function mapTypeToEditor(type: string): 'text' | 'textarea' | 'select' | 'number' | 'boolean' | 'date' {
  switch (type) {
    case 'number':
    case 'integer':
    case 'decimal':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
    case 'datetime':
      return 'date';
    case 'select':
    case 'single-select':
    case 'single_select':
    case 'multi-select':
    case 'multi_select':
      return 'select';
    case 'longtext':
    case 'rich-text':
    case 'rich_text':
      return 'textarea';
    default:
      return 'text';
  }
}