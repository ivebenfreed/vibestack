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

  // Generate columns from schema fields
  const allColumns = schemaFields.map((fieldDef: any) => {
    // API returns field objects with "name" property
    const fieldName = fieldDef?.name;
    if (!fieldName) {
      fileLog.warn("⚠️ Field missing name property, skipping", { fieldDef });
      return null;
    }
    
    const safeFieldDef: EntityField = fieldDef && typeof fieldDef === "object" ? fieldDef : { name: fieldName, type: "text" };
    const fieldType = String(safeFieldDef.type || "text").toLowerCase();

    // Map DataForge field types to VibeGrid cell types using unified mapping
    const cellType = mapFieldTypeToVibeGridCellType(fieldType);

    // Determine column width based on field type
    const width = getColumnWidth(fieldType, fieldName);

    // Determine if field should be editable
    const isEditable = !['id', 'created_at', 'updated_at'].includes(fieldName) &&
                       safeFieldDef.syncable !== false;

    const column: Column<T> = {
      id: fieldName,
      field: fieldName as keyof T & string,
      name: formatFieldName(fieldName),
      cellType: cellType as any,
      type: fieldType,
      width,
      editable: isEditable,
      // Transfer options from schema field editor metadata
      options: safeFieldDef.editor?.options || [],
      editor: safeFieldDef.editor || null,
      validation: safeFieldDef.validation || null
    };

    fileLog.debug('🔧 Generated column', {
      fieldName,
      fieldType,
      cellType,
      hasOptions: !!(safeFieldDef.editor?.options?.length),
      optionsCount: safeFieldDef.editor?.options?.length || 0
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