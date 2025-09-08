/**
 * Table Columns Observable
 * 
 * Computed observables that derive column definitions from schema data.
 * Provides optimal column structure for VibeGrid and other table components.
 * Uses existing universe schema data - no expensive database queries.
 */

import { observable, computed } from '@legendapp/state';
import { universeSchema$, universeOrgId$ } from '../observables';
import { stateLog } from '@/logger';

const log = stateLog('legend-state/table-columns');

export interface TableColumn {
  id: string;
  label: string;
  width: number;
  type: 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'select' | 'multiselect' | 'reference';
  required?: boolean;
  sortable?: boolean;
  editable?: boolean;
  // Reference field information
  referenceType?: 'user_reference' | 'entity_reference' | 'priority_option' | 'status_option' | 'task_type_option';
  referenceEntity?: string;
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
    log.debug(`Schema not ready for entity ${entityName}`, { schema: !!schema, orgId: !!orgId });
    return [];
  }

  const entity = schema.entities[entityName];
  if (!entity) {
    log.debug(`Entity ${entityName} not found in schema`, { 
      availableEntities: Object.keys(schema.entities) 
    });
    return [];
  }

  const columns: TableColumn[] = [];
  
  // Add base system columns (always present)
  columns.push(
    { id: 'id', label: 'ID', width: 300, type: 'text', sortable: true, editable: false },
    { id: 'created_at', label: 'Created', width: 180, type: 'datetime', sortable: true, editable: false },
    { id: 'updated_at', label: 'Updated', width: 180, type: 'datetime', sortable: true, editable: false }
  );

  // Process entity fields from schema
  const fields = entity.business_metadata?.fields || entity.fields || [];
  
  for (const field of fields) {
    const column: TableColumn = {
      id: field.name,
      label: field.label || formatFieldLabel(field.name),
      width: getDefaultWidth(field.type),
      type: mapFieldType(field.type),
      required: field.required || false,
      sortable: true,
      editable: true
    };

    // Handle reference fields
    if (isReferenceField(field.type)) {
      column.referenceType = field.type as any;
      column.type = 'select'; // Reference fields are rendered as selects
      
      // Infer target entity for entity_reference
      if (field.type === 'entity_reference') {
        column.referenceEntity = inferTargetEntity(field.name, entity.archetype);
      }
    }

    columns.push(column);

    // NOTE: _resolved columns are deprecated as of September 2025
    // The new relationship system handles reference resolution differently
    // No longer adding _resolved columns to prevent sync conflicts
  }

  log.debug(`Generated ${columns.length} columns for ${entityName}`, {
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
  
  for (const entityName of Object.keys(schema.entities)) {
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
      return 'datetime';
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
      return 'text'; // JSON fields rendered as text for now
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

// Export helper for backward compatibility
export const getColumnsForEntity = (entityName: string): TableColumn[] => {
  return getEntityColumns$(entityName).get();
};