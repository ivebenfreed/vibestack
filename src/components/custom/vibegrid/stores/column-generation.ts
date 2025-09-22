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
 * Generate VibeGrid columns from entity schema with unified field type processing
 */
export async function generateColumnsFromEntitySchema<T = any>(entityType: string): Promise<Column<T>[]> {
  fileLog.info('🎯 Generating columns from entity schema', { entityType });

  let schema;
  let isLoading = false;

  try {
    // Try to check if schema system is still loading
    isLoading = universeLoading$.get();
    fileLog.info("🚨 [DEBUG] Universe loading state", { entityType, isLoading });
  } catch (loadingError) {
    fileLog.info("🚨 [DEBUG] Cannot check loading state, universe not ready", { entityType, error: loadingError.message });
    throw new Error(`Universe schema system not ready for entity: ${entityType}`);
  }

  if (isLoading) {
    fileLog.info("🚨 [DEBUG] Universe schema still loading, retrying later", { entityType });
    throw new Error(`Universe schema still loading for entity: ${entityType}`);
  }

  // Get organization ID for direct API call
  let orgId = universeOrgId$.get();
  if (!orgId && entityType.includes("_")) {
    const parts = entityType.split("_");
    if (parts.length >= 2 && parts[0].match(/^[0-9a-fA-F-]+$/)) {
      orgId = parts[0];
    }
  }

  if (!orgId) {
    throw new Error(`Cannot determine org ID for entity: ${entityType}`);
  }

  // Direct API call to get schema since universe schema isn't working
  try {
    fileLog.info('📡 Fetching schema directly from API', { entityType, orgId });
    const response = await fetch(`/api/dataforge/orgs/${orgId}/schema`);
    if (!response.ok) {
      throw new Error(`Schema API returned ${response.status}: ${response.statusText}`);
    }
    const apiSchema = await response.json();
    const baseEntityName = entityType.includes("_") ? entityType.split("_").pop() : entityType;
    const entitySchema = apiSchema.schema?.find((entity: any) => entity.entityName === baseEntityName);

    if (!entitySchema) {
      throw new Error(`Entity ${baseEntityName} not found in schema`);
    }

    fileLog.info('✅ Fetched entity schema from API', {
      entityType,
      baseEntityName,
      hasSchema: !!entitySchema,
      fieldCount: entitySchema.fields?.length || 0
    });

    schema = { entities: [entitySchema] };
  } catch (schemaError) {
    fileLog.error("❌ Direct API schema fetch failed", { entityType, orgId, error: schemaError.message });
    throw schemaError;
  }

  // Try to get schema from Legend State observables first
  const baseEntityName = entityType.includes("_") ? entityType.split("_").pop() : entityType;
  fileLog.info("🚨 [DEBUG] Entity name extraction", {
    originalEntityType: entityType,
    baseEntityName,
    hasSchema: !!schema,
    hasEntities: !!schema?.entities,
    entitiesCount: schema?.entities?.length || 0,
    availableEntities: schema?.entities?.map((e: any) => e.entityName) || []
  });

  let entitySchema = schema?.entities?.find((entity: any) => {
    return entity.entityName === baseEntityName;
  });

  fileLog.info("🚨 [DEBUG] Looking for entitySchema", {
    entityType,
    baseEntityName,
    hasEntities: !!schema?.entities,
    entitySchema: !!entitySchema,
    searchResult: entitySchema ? 'FOUND' : 'NOT_FOUND'
  });
  if (entitySchema) {
    fileLog.info("🚨 [DEBUG] Found entitySchema from universe", {
      entityType,
      entitySchemaKeys: Object.keys(entitySchema),
      fieldsType: typeof entitySchema.fields,
      fieldsIsArray: Array.isArray(entitySchema.fields),
      fieldsLength: entitySchema.fields?.length,
      fieldsKeys: entitySchema.fields && typeof entitySchema.fields === "object" ? Object.keys(entitySchema.fields) : null
    });
  }


  if (!entitySchema) {
    fileLog.warn('❌ No schema found for entity (tried both observables and API)', { entityType });
    return getBasicColumns<T>();
  }

  // Extract fields from schema (fields is the standard property)
  // Extract fields from schema - API returns fields as an array, not object
  const schemaFields = entitySchema.fields || [];

  if (!Array.isArray(schemaFields) || schemaFields.length === 0) {
    fileLog.warn("❌ No fields found in entity schema", { entityType });
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