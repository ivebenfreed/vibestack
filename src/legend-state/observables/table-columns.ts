/**
 * Table Columns Observable
 * 
 * Computed observables that derive column definitions from schema data.
 * Provides optimal column structure for VibeGrid and other table components.
 * Uses existing universe schema data - no expensive database queries.
 */

import { observable, computed } from '@legendapp/state';
import { universeSchema$, universeOrgId$ } from '../observables';
import { getEntity$ } from '../observables';
import { log } from '@/logger';

const fileLog = log('legend-state/table-columns');

export interface TableColumn {
  id: string;
  label: string;
  width: number;
  type: 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'currency' | 'select' | 'multiselect' | 'reference';
  cellType?: string; // Original field type from schema for rendering
  fieldSchema?: any; // Complete field schema for enhanced formatting
  required?: boolean;
  sortable?: boolean;
  editable?: boolean;
  // Reference field information
  referenceType?: 'user_reference' | 'entity_reference' | 'priority_option' | 'status_option' | 'task_type_option' | 'category_option';
  referenceEntity?: string;
  // NEW: System options configuration
  systemOptionType?: string; // e.g., 'priority', 'status', 'task_type'
  systemArchetype?: string;   // e.g., 'task', 'project', 'record'
  // NOTE: isResolved and baseField properties deprecated as of September 2025
}

/**
 * Get table columns for a specific entity
 * Uses schema data already loaded in universeSchema$ - no API calls
 */
export const getEntityColumns$ = (entityName: string) => computed(() => {
  const schema = universeSchema$.get();
  const orgId = universeOrgId$.get();
  
  if (!schema || !orgId || !schema.entities) {
    fileLog.debug(`Schema not ready for entity ${entityName}`, { schema: !!schema, orgId: !!orgId });
    return [];
  }

  const entity = schema.entities[entityName];
  if (!entity) {
    fileLog.debug(`Entity ${entityName} not found in schema`, { 
      availableEntities: Object.keys(schema.entities || {}) 
    });
    return [];
  }

  const columns: TableColumn[] = [];

  // Process entity fields from schema - PURE DYNAMIC APPROACH
  // NEW: Handle Legend State observables - check allFields first, then fallback to legacy paths
  const allFields = entity.allFields || {};
  const legacyFields = entity.business_metadata?.fields || entity.fields || [];
  
  // Convert allFields object to array format, accessing Legend State observables with .peek()
  const fieldsArray = Object.keys(allFields || {}).length > 0 
    ? Object.entries(allFields).map(([fieldName, fieldObs]) => {
        // Access Legend State observable properties with .peek()
        const fieldData = fieldObs;
        return {
          name: fieldName,
          type: fieldData.type?.peek?.() || fieldData.type,
          label: fieldData.label?.peek?.() || fieldData.label,
          required: fieldData.required?.peek?.() || fieldData.required || false,
          defaultValue: fieldData.defaultValue?.peek?.() || fieldData.defaultValue
        };
      })
    : legacyFields;
  
  // No filtering - process ALL fields from schema (including system fields)
  
  for (const field of fieldsArray) {
    const isSystemField = ['id', 'created_at', 'updated_at'].includes(field.name);
    
    const column: TableColumn = {
      id: field.name,
      label: field.label || formatFieldLabel(field.name),
      width: getDefaultWidth(field.type),
      type: mapFieldType(field.type),
      required: field.required || false,
      sortable: true,
      editable: !isSystemField,  // System fields are not editable
      // Add cellType to pass through the original field type for rendering
      cellType: field.type,
      // Attach field schema for enhanced formatting (colors, badges, etc.)
      fieldSchema: field
    };

    // Handle reference fields
    if (isReferenceField(field.type)) {
      column.referenceType = field.type as any;
      column.type = 'select'; // Reference fields are rendered as selects
      column.cellType = 'select'; // FIXED: Ensure cellType is set for reference fields

      // System options are deprecated - modern system uses custom fields with enum arrays

      // Infer target entity for entity_reference
      if (field.type === 'entity_reference') {
        column.referenceEntity = inferTargetEntity(field.name, entity.archetype);
      }
    }

    // Handle single-select fields with enum arrays
    if (field.type === 'single-select' && field.enum && Array.isArray(field.enum)) {
      column.type = 'select';
      column.cellType = 'select';
      column.enumOptions = field.enum; // Let ComboboxEditor handle the formatting
      
      fileLog.info(`✅ Single-select field configured: ${field.name}`, {
        entityName,
        columnId: column.id,
        enumOptions: column.enumOptions.slice(0, 3)
      });
    }

    // Enhanced Option Detection: Analyze data to detect select fields
    if ((column.type === 'text' || column.type === 'json') && shouldDetectOptions(field.name)) {
      const detectedOptions = detectColumnOptions(entityName, field.name);
      if (detectedOptions && detectedOptions.length > 0) {
        // Determine if this should be a multi-select tags field
        const isTagsField = isTagsFieldName(field.name);
        column.type = isTagsField ? 'tags' : 'select';
        column.cellType = isTagsField ? 'tags' : 'select'; // FIXED: Ensure cellType is set for ALL auto-detected select fields
        column.options = detectedOptions;

        fileLog.info(`🎯 Auto-detected ${isTagsField ? 'tags' : 'select'} field: ${field.name}`, {
          entityName,
          columnId: column.id,
          detectedOptions: detectedOptions.slice(0, 3),
          isTagsField,
          cellType: column.cellType // Added cellType to debug logs
        });
      }
    }

    columns.push(column);

    // NOTE: _resolved columns are deprecated as of September 2025
    // The new relationship system handles reference resolution differently
    // No longer adding _resolved columns to prevent sync conflicts
  }

  fileLog.debug(`Generated ${columns.length} columns for ${entityName}`, {
    entityName,
    columnIds: columns.map(c => c.id),
    referenceFields: columns.filter(c => c.referenceType).map(c => ({ id: c.id, type: c.referenceType }))
  });

  return columns;
});

/**
 * Get columns for all entities (for debugging/admin views)
 */
export const allEntityColumns$ = computed(() => {
  const schema = universeSchema$.get();
  
  if (!schema?.entities) {
    return {};
  }

  const entityColumns: Record<string, TableColumn[]> = {};
  
  for (const entityName of Object.keys(schema.entities || {})) {
    entityColumns[entityName] = getEntityColumns$(entityName).get();
  }

  return entityColumns;
});

/**
 * Helper function to create columns observable for a specific entity
 * This is the main function components should use
 */
export const createEntityColumnsObservable = (entityName: string) => {
  return getEntityColumns$(entityName);
};

// Helper functions
function formatFieldLabel(fieldName: string): string {
  return fieldName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function mapFieldType(fieldType: string): TableColumn['type'] {
  switch (fieldType) {
    case 'text':
    case 'email':
    case 'url':
      return 'text';
    case 'number':
    case 'decimal':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'date';
    case 'datetime':
    case 'timestamp':
    case 'timestamptz':
      return 'datetime';
    case 'currency':
      return 'currency'; // Add currency type mapping
    case 'priority_option':
    case 'status_option':
    case 'task_type_option':
    case 'category_option':
    case 'user_reference':
    case 'entity_reference':
    case 'custom_option_reference':
      return 'select';
    case 'json':
    case 'jsonb':
      return 'json'; // JSON fields that may be auto-detected as select
    default:
      return 'text';
  }
}

function getDefaultWidth(fieldType: string): number {
  switch (fieldType) {
    case 'boolean':
      return 80;
    case 'number':
    case 'integer':
      return 100;
    case 'currency':
      return 120; // Add currency width
    case 'date':
      return 120;
    case 'datetime':
    case 'timestamp':
      return 160;
    case 'priority_option':
    case 'status_option':
      return 120;
    case 'user_reference':
      return 180;
    case 'email':
      return 200;
    case 'url':
      return 250;
    default:
      return 150;
  }
}

function isReferenceField(fieldType: string): boolean {
  return [
    'priority_option',
    'status_option',
    'category_option',
    'task_type_option',
    'discussion_type_option',
    'custom_option_reference',
    'user_reference',
    'entity_reference'
  ].includes(fieldType);
}

function inferTargetEntity(fieldName: string, archetype?: string): string | undefined {
  // Handle self-references first (parent relationships)
  if (fieldName.startsWith('parent_') && archetype) {
    // parent_task_id in task entity -> Task
    return archetype.charAt(0).toUpperCase() + archetype.slice(1);
  }
  
  // Handle specific patterns
  if (fieldName === 'project_id') return 'Project';
  if (fieldName === 'task_id') return 'Task';
  if (fieldName === 'document_id') return 'Document';
  if (fieldName === 'file_id') return 'File';
  if (fieldName === 'discussion_id') return 'Discussion';
  if (fieldName === 'collection_id') return 'Collection';
  if (fieldName === 'record_id') return 'Record';
  if (fieldName === 'activity_id') return 'Activity';
  
  // Generic pattern: remove _id suffix and capitalize
  if (fieldName.endsWith('_id')) {
    const baseName = fieldName.replace(/_id$/, '');
    return baseName.charAt(0).toUpperCase() + baseName.slice(1);
  }
  
  return undefined;
}

/**
 * Determine if a field should have its options auto-detected from data
 */
function shouldDetectOptions(fieldName: string): boolean {
  // Known fields that should be select fields based on common patterns
  const selectFieldPatterns = [
    'label', 'labels', 'category', 'type', 'kind', 'tag', 'tags', 
    'status', 'state', 'priority', 'level', 'grade', 'class'
  ];
  
  const lowerFieldName = fieldName.toLowerCase();
  return selectFieldPatterns.some(pattern => 
    lowerFieldName.includes(pattern)
  );
}

/**
 * Determine if a field should be treated as a tags/multi-select field
 */
function isTagsFieldName(fieldName: string): boolean {
  // Fields that should be multi-select tags rather than single select
  const tagsFieldPatterns = ['tags', 'tag', 'labels', 'keywords', 'categories'];
  const lowerFieldName = fieldName.toLowerCase();
  
  return tagsFieldPatterns.some(pattern => 
    lowerFieldName.includes(pattern)
  );
}

/**
 * Detect select options by analyzing actual data values
 */
function detectColumnOptions(entityName: string, fieldName: string): Array<{ value: string; label: string }> | null {
  try {
    // Get the entity data from Legend State
    const entityObs = getEntity$(entityName);
    if (!entityObs) {
      fileLog.debug(`Entity observable not available for ${entityName}`);
      return null;
    }
    
    const entityData = entityObs.peek();
    if (!entityData || typeof entityData !== 'object') {
      fileLog.debug(`No data available for ${entityName}`);
      return null;
    }
    
    // Extract unique values from the field
    const uniqueValues = new Set<string>();
    const records = Object.values(entityData);
    
    for (const record of records) {
      if (record && typeof record === 'object' && fieldName in record) {
        const value = record[fieldName as keyof typeof record];
        if (value && typeof value === 'string' && value.trim()) {
          uniqueValues.add(value.trim());
        }
      }
    }
    
    // Convert to options if we have reasonable values (2-20 unique options)
    const values = Array.from(uniqueValues).sort();
    if (values.length >= 2 && values.length <= 20) {
      return values.map(value => ({
        value,
        label: value.charAt(0).toUpperCase() + value.slice(1) // Capitalize first letter
      }));
    }
    
    return null;
  } catch (error) {
    fileLog.warn(`Failed to detect options for ${entityName}.${fieldName}:`, error);
    return null;
  }
}

// Export helper for backward compatibility
export const getColumnsForEntity = (entityName: string): TableColumn[] => {
  return getEntityColumns$(entityName).get();
};

// Expose to window for debugging and editor components
if (typeof window !== 'undefined') {
  (window as any).getColumnsForEntity = getColumnsForEntity;
}