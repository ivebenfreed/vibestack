/**
 * Field Types - Simple file-based field system
 * 
 * Each field type has its own file with all logic:
 * - getDefaultValue()
 * - validate() 
 * - getSqlType()
 * - getSqlDefault()
 */

import * as text from './text';
import * as richText from './rich-text';
import * as date from './date';
import * as singleSelect from './single-select';
import * as multiSelect from './multi-select';
import * as number from './number';
import * as boolean from './boolean';
import * as email from './email';
import * as url from './url';
import * as file from './file';
import * as phone from './phone';
import * as currency from './currency';
import * as color from './color';
import * as customUserReference from './custom_user_reference';
import * as customEntityReference from './custom_entity_reference';
import * as rollupCount from './rollup_count';
import * as rollupSum from './rollup_sum';
import * as rollupAverage from './rollup_average';
import * as rollupConcat from './rollup_concat';

export const fieldTypes = {
  text,
  longtext: text,  // alias
  'rich-text': richText,
  'rich_text': richText,  // alias
  date,
  datetime: date,  // alias
  'single-select': singleSelect,
  'single_select': singleSelect,  // alias
  'multi-select': multiSelect, 
  'multi_select': multiSelect,  // alias
  number,
  integer: number,  // alias
  decimal: number,  // alias
  boolean,
  email,
  url,
  file,
  phone,
  currency,
  color,
  'custom_user_reference': customUserReference,
  'custom_entity_reference': customEntityReference,
  'rollup_count': rollupCount,
  'rollup_sum': rollupSum,
  'rollup_average': rollupAverage,
  'rollup_concat': rollupConcat
};

export function getFieldHandler(type: string) {
  return fieldTypes[type as keyof typeof fieldTypes] || null;
}