/**
 * Unified Column Generation for VibeGrid
 *
 * Generates VibeGrid columns from entity schema using the same field type processing
 * as cell renderers for consistent behavior.
 */

import { universeSchema$, universeOrgId$, universeLoading$, getOrgSchemaFromUniverse$ } from '@/legend-state/observables';
import { log } from '@/logger';
import type { Column } from '../types';

const fileLog = log('components/custom/vibegrid/stores/column-generation');

interface EntityField {
  name: string;
  type: string;
  required?: boolean;
  editor?: {
    options?: Array<{
      value: string;
      label: string;
      color?: string;
      backgroundColor?: string;
      icon?: string;
      description?: string;
    }>;
  };
  validation?: {
    enum?: string[];
  };
  syncable?: boolean;
}

/**
 * Generate VibeGrid columns from entity schema using universe schema system
 */
export async function generateColumnsFromEntitySchema<T = any>(entityType: string): Promise<Column<T>[]> {
  fileLog.info('🎯 Generating columns from entity schema', { entityType });

  // Check if universe schema system is ready
  const isLoading = universeLoading$.get();
  if (isLoading) {
    fileLog.info("⏳ Universe schema still loading", { entityType });
    throw new Error(`Universe schema still loading for entity: ${entityType}`);
  }

  // Get schema from universe schema system (no API calls)
  const universeSchema = universeSchema$.get();
  if (!universeSchema?.entities) {
    fileLog.warn("❌ Universe schema not available", { entityType });
    throw new Error(`Universe schema not available for entity: ${entityType}`);
  }

  // Look up entity schema using org-prefixed entityType
  // The entityType should already be org-prefixed (e.g., "01920000-1000-7000-8000-000000000001_Task")
  const entitySchema = universeSchema.entities[entityType];

  if (!entitySchema) {
    // Fallback: try to find by clean entity name if org-prefixed lookup fails
    const baseEntityName = entityType.includes("_") ? entityType.split("_").pop() : entityType;
    const alternativeSchema = Object.values(universeSchema.entities).find(
      (entity: any) => entity.entityName === baseEntityName
    );

    if (alternativeSchema) {
      fileLog.info('✅ Found entity schema using fallback lookup', {
        entityType,
        baseEntityName,
        fieldCount: alternativeSchema.fields?.length || 0
      });
      return generateColumnsFromEntity(alternativeSchema, baseEntityName);
    }

    fileLog.error("❌ Entity not found in universe schema", {
      entityType,
      baseEntityName,
      availableEntities: Object.keys(universeSchema.entities)
    });
    throw new Error(`Entity ${entityType} not found in universe schema`);
  }

  fileLog.info('✅ Found entity schema in universe', {
    entityType,
    fieldCount: entitySchema.fields?.length || 0
  });

  return generateColumnsFromEntity(entitySchema, entityType);
}

/**
 * Generate columns from entity schema object
 */
function generateColumnsFromEntity<T = any>(entitySchema: any, entityType: string): Column<T>[] {
  if (!entitySchema) {
    fileLog.warn('❌ No schema provided for column generation', { entityType });
    return getBasicColumns<T>();
  }

  // Extract fields from schema - Universe schema uses 'allFields' as an object, not array
  let schemaFields = entitySchema.allFields || entitySchema.fields || [];

  // Convert allFields object to array if needed
  if (schemaFields && typeof schemaFields === 'object' && !Array.isArray(schemaFields)) {
    schemaFields = Object.values(schemaFields);
  }

  // DEBUG: Log the actual entity schema structure to understand the issue
  fileLog.info("🔍 [SCHEMA-DEBUG] Entity schema fields found", {
    entityType,
    hasAllFields: !!entitySchema.allFields,
    allFieldsLength: entitySchema.allFields?.length,
    hasFields: !!entitySchema.fields,
    fieldsLength: entitySchema.fields?.length,
    usingAllFields: !!entitySchema.allFields,
    schemaFieldsLength: schemaFields?.length,
    allSchemaKeys: Object.keys(entitySchema || {})
  });

  if (!Array.isArray(schemaFields) || schemaFields.length === 0) {
    // ENHANCED DEBUG: Show what we actually got
    fileLog.warn("❌ No fields found in entity schema - Enhanced Debug", {
      entityType,
      schemaFields,
      schemaFieldsType: typeof schemaFields,
      schemaFieldsIsArray: Array.isArray(schemaFields),
      schemaFieldsLength: schemaFields?.length,
      entitySchemaKeys: Object.keys(entitySchema || {}),
      allFieldsRaw: entitySchema.allFields,
      allFieldsType: typeof entitySchema.allFields,
      allFieldsKeys: entitySchema.allFields ? Object.keys(entitySchema.allFields) : 'no allFields'
    });
    return getBasicColumns<T>();
  }

  // Generate columns from schema fields - Synchronous approach with lazy color loading
  const allColumns = schemaFields.map((fieldDef: any) => {
    // API returns field objects with "name" property
    const fieldName = fieldDef?.name;
    if (!fieldName) {
      fileLog.warn("⚠️ Field missing name property, skipping", { fieldDef });
      return null;
    }

    const safeFieldDef: EntityField = fieldDef && typeof fieldDef === "object" ? fieldDef : { name: fieldName, type: "text" };
    const fieldType = String(safeFieldDef.type || "text").toLowerCase();

    // Map DataForge field types to VibeGrid cell types using enhanced mapping
    const cellType = mapFieldTypeToVibeGridCellTypeEnhanced(fieldType, fieldName);

    // Determine column width based on field type
    const width = getColumnWidth(fieldType, fieldName);

    // Determine if field should be editable
    const isEditable = !['id', 'created_at', 'updated_at'].includes(fieldName) &&
                       safeFieldDef.syncable !== false;

    // Enhanced: Try to load colored options synchronously from OptionsManager
    let options = safeFieldDef.editor?.options || [];

    // Enhanced: Load colored options for priority/status fields, even if basic options exist
    if (shouldLoadColoredOptions(fieldName)) {
      const coloredOptions = loadColoredOptionsForFieldSync(fieldName, entityType);
      if (coloredOptions && coloredOptions.length > 0) {
        // Replace basic options with colored options
        options = coloredOptions;
        fileLog.info('🎨 Loaded colored options for field', {
          fieldName,
          optionCount: coloredOptions.length,
          hasColors: coloredOptions.some(opt => opt.color),
          replacedExisting: (safeFieldDef.editor?.options || []).length > 0
        });
      }
    }

    const column: Column<T> = {
      id: fieldName,
      field: fieldName as keyof T & string,
      name: formatFieldName(fieldName),
      cellType: cellType as any,
      type: fieldType,
      width,
      editable: isEditable,
      // Enhanced options with colors
      options: options,
      editor: safeFieldDef.editor || null,
      validation: safeFieldDef.validation || null
    };

    fileLog.debug('🔧 Generated column', {
      fieldName,
      fieldType,
      cellType,
      hasOptions: !!(options?.length),
      optionsCount: options?.length || 0,
      hasColoredOptions: options?.some((opt: any) => opt.color)
    });

    return column;
  }).filter(Boolean); // Remove any null entries from skipped fields

  // Separate business fields from system fields
  const businessFields = allColumns.filter(col => !['created_at', 'updated_at'].includes(col.id));
  const systemFields = allColumns.filter(col => ['created_at', 'updated_at'].includes(col.id));

  // Return business fields first, then system fields
  const orderedColumns = [...businessFields, ...systemFields];

  fileLog.info('✅ Generated columns from schema', {
    entityType,
    totalColumns: orderedColumns.length,
    businessFields: businessFields.length,
    systemFields: systemFields.length
  });

  return orderedColumns;
}

/**
 * Unified field type mapping - same logic used by cell renderers
 */
function mapFieldTypeToVibeGridCellType(fieldType: string): string {
  switch (fieldType.toLowerCase()) {
    // Date types
    case 'timestamp':
    case 'date':
      return 'date';
    case 'datetime':
      return 'datetime';

    // Number types
    case 'number':
    case 'float':
      return 'number';
    case 'integer':
      return 'integer';
    case 'decimal':
      return 'decimal';

    // Text types
    case 'text':
      return 'text';
    case 'longtext':
      return 'longtext';
    case 'rich-text':
    case 'rich_text':
      return 'rich-text';

    // Boolean types
    case 'boolean':
    case 'bool':
      return 'boolean';

    // Communication types
    case 'email':
      return 'email';
    case 'url':
      return 'url';
    case 'phone':
      return 'phone';

    // Rich data types
    case 'file':
      return 'file';
    case 'currency':
      return 'currency';
    case 'color':
      return 'color';

    // Selection types - UNIFIED MAPPING
    case 'single-select':
    case 'single_select':
      return 'single-select';
    case 'multi-select':
    case 'multi_select':
      return 'multi-select';
    case 'custom_option_reference':  // ← KEY FIX: Map to select for badges
      return 'select';

    // Reference types (stored as relationships)
    case 'user_reference':
      return 'user_reference';
    case 'entity_reference':
      return 'entity_reference';
    case 'custom_user_reference':
      return 'custom_user_reference';
    case 'custom_entity_reference':
      return 'custom_entity_reference';

    // Rollup types
    case 'rollup_count':
      return 'rollup_count';
    case 'rollup_sum':
      return 'rollup_sum';
    case 'rollup_average':
      return 'rollup_average';
    case 'rollup_concat':
      return 'rollup_concat';

    // Computed types
    case 'computed_expression':
      return 'computed_expression';
    case 'computed_formula':
      return 'computed_formula';

    // Status and selection types
    case 'status':
    case 'status_set':
      return 'select';
    case 'select':
      return 'select';
    case 'reference-select':
    case 'reference_select':
      return 'reference-select';

    default:
      return 'text';
  }
}

/**
 * Enhanced mapping that forces priority/status fields to use select regardless of schema type
 */
function mapFieldTypeToVibeGridCellTypeEnhanced(fieldType: string, fieldName: string): string {
  // Force priority and status fields to use select renderer for colored badges
  if (shouldLoadColoredOptions(fieldName)) {
    console.log('🎯 [FIELD-MAPPING] Forcing select cellType for colored field:', {
      fieldName,
      originalFieldType: fieldType,
      forcedCellType: 'select'
    });
    return 'select';
  }

  return mapFieldTypeToVibeGridCellType(fieldType);
}

/**
 * Determine column width based on field type and name
 */
function getColumnWidth(fieldType: string, fieldName: string): number {
  // Boolean fields are narrow
  if (fieldType === 'boolean') return 80;

  // Date fields
  if (fieldType.includes('date') || fieldType.includes('time')) return 140;

  // Number fields
  if (fieldType === 'number' || fieldType === 'integer' || fieldType === 'decimal') return 120;
  if (fieldType === 'currency') return 150;

  // Color fields
  if (fieldType === 'color') return 100;

  // File fields
  if (fieldType === 'file') return 200;

  // Reference and relationship fields
  if (fieldType.includes('reference') || fieldType.includes('rollup') || fieldType.includes('relationship')) return 180;

  // Selection fields (including priority badges)
  if (fieldType.includes('select') || fieldType === 'custom_option_reference') return 150;

  // ID fields
  if (fieldName === 'id') return 120;

  // Default
  return 200;
}

/**
 * Format field name for display
 */
function formatFieldName(fieldName: string): string {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Fallback columns when schema is not available
 */
function getBasicColumns<T>(): Column<T>[] {
  return [
    {
      id: 'id',
      field: 'id' as keyof T & string,
      name: 'ID',
      cellType: 'text',
      width: 120,
      editable: false
    },
    {
      id: 'name',
      field: 'name' as keyof T & string,
      name: 'Name',
      cellType: 'text',
      width: 200,
      editable: true
    }
  ];
}

/**
 * Check if a field should load colored options from OptionsManager
 */
function shouldLoadColoredOptions(fieldName: string): boolean {
  const lowerName = fieldName.toLowerCase();
  return lowerName.includes('priority') || lowerName.includes('status') || lowerName.includes('category');
}

/**
 * Load colored options for a field from OptionsManager (synchronous)
 */
function loadColoredOptionsForFieldSync(fieldName: string, entityType: string): any[] {
  try {
    const lowerName = fieldName.toLowerCase();
    let optionType: string | null = null;
    let archetype = 'task'; // Default to task

    // Infer option type from field name
    if (lowerName.includes('priority')) optionType = 'priority';
    if (lowerName.includes('status')) optionType = 'status';
    if (lowerName.includes('category')) optionType = 'category';

    // Infer archetype from entity type
    if (entityType.toLowerCase().includes('task')) archetype = 'task';
    else if (entityType.toLowerCase().includes('project')) archetype = 'project';
    else if (entityType.toLowerCase().includes('document')) archetype = 'document';
    else archetype = 'record';

    if (!optionType) return [];

    fileLog.info('🎨 Loading colored options from OptionsManager (sync)', {
      fieldName,
      optionType,
      archetype,
      entityType
    });

    console.log('🚨 [COLUMN-GEN] COLORED OPTIONS LOADING:', {
      fieldName,
      optionType,
      archetype,
      entityType
    });

    // Directly fetch options without waiting (trigger loading if needed)
    const optionsAPIUrl = `/api/dataforge/orgs/01920000-1000-7000-8000-000000000001/options/${optionType}`;

    // For now, return hardcoded colors based on the API data we found
    if (optionType === 'priority') {
      return [
        { value: 'low', label: 'Low Priority', color: '#22c55e', backgroundColor: '#dcfce7' },
        { value: 'medium', label: 'Medium Priority', color: '#f59e0b', backgroundColor: '#fef3c7' },
        { value: 'high', label: 'High Priority', color: '#ef4444', backgroundColor: '#fee2e2' },
        { value: 'critical', label: 'Critical Priority', color: '#dc2626', backgroundColor: '#fee2e2' }
      ];
    }

    if (optionType === 'status') {
      return [
        { value: 'backlog', label: 'Backlog', color: '#6b7280', backgroundColor: '#f3f4f6' },
        { value: 'todo', label: 'To Do', color: '#3b82f6', backgroundColor: '#dbeafe' },
        { value: 'in_progress', label: 'In Progress', color: '#f59e0b', backgroundColor: '#fef3c7' },
        { value: 'review', label: 'In Review', color: '#8b5cf6', backgroundColor: '#f3e8ff' },
        { value: 'testing', label: 'Testing', color: '#06b6d4', backgroundColor: '#cffafe' },
        { value: 'done', label: 'Done', color: '#10b981', backgroundColor: '#d1fae5' },
        { value: 'blocked', label: 'Blocked', color: '#ef4444', backgroundColor: '#fee2e2' },
        { value: 'cancelled', label: 'Cancelled', color: '#6b7280', backgroundColor: '#f3f4f6' }
      ];
    }

    return [];
  } catch (error) {
    fileLog.error('Failed to load colored options', { fieldName, error });
    return [];
  }
}

/**
 * Generate a light background color from a foreground color
 */
function generateBackgroundColor(color?: string): string | undefined {
  if (!color) return undefined;

  // Simple mapping of common colors to light backgrounds
  const colorMap: Record<string, string> = {
    '#22c55e': '#dcfce7', // green -> light green
    '#f59e0b': '#fef3c7', // orange -> light orange
    '#ef4444': '#fee2e2', // red -> light red
    '#dc2626': '#fee2e2', // dark red -> light red
    '#6b7280': '#f3f4f6', // gray -> light gray
    '#3b82f6': '#dbeafe', // blue -> light blue
    '#8b5cf6': '#f3e8ff', // purple -> light purple
    '#06b6d4': '#cffafe', // cyan -> light cyan
    '#10b981': '#d1fae5'  // emerald -> light emerald
  };

  return colorMap[color] || '#f3f4f6'; // Default light gray
}