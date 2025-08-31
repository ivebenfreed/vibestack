/**
 * Column Generator for UltraTable
 * 
 * Uses the same precomputed columns as VibeGrid for consistency.
 * Falls back to sensible defaults if precomputed columns are not available.
 */

import { getPrecomputedEntityColumns$ } from '@/legend-state/hooks/use-precomputed-entity-columns';
import type { Column } from '../types';
import { uiLog } from '@/logger';
const log = uiLog('components/custom/ultratable/utils/column-generator.ts');

/**
 * Generate columns for an entity type using precomputed columns
 */
export function generateColumns(entityType: string): Column[] {
  try {
    log.info('[UltraTable] generateColumns called for', entityType);
    
    // Use the same precomputed columns as VibeGrid
    const precomputedColumns$ = getPrecomputedEntityColumns$(entityType);
    
    if (!precomputedColumns$) {
      log.warn('[UltraTable] Precomputed columns not available for', entityType, 'using fallback columns');
      return generateFallbackColumns(entityType);
    }
    
    // Get the columns from the observable
    const vibeGridColumns = precomputedColumns$.peek();
    
    if (!vibeGridColumns || vibeGridColumns.length === 0) {
      log.warn('[UltraTable] No precomputed columns found for', entityType, 'using fallback columns');
      return generateFallbackColumns(entityType);
    }
    
    log.info('[UltraTable] Using precomputed columns for', entityType, 'column count:', vibeGridColumns.length);
    log.info('[UltraTable] VibeGrid columns detail:', vibeGridColumns.map(c => ({ id: c.id, field: c.field, cellType: c.cellType })));
    
    // Convert VibeGrid columns to UltraTable column format
    const ultraColumns: Column[] = vibeGridColumns.map((vibeCol: any) => ({
      id: vibeCol.id,
      field: vibeCol.field,
      name: vibeCol.name,
      type: mapVibeGridCellTypeToUltraType(vibeCol.cellType),
      width: vibeCol.width || 150,
      sortable: true,
      resizable: vibeCol.resizable !== false,
      editable: vibeCol.editable !== false,
      visible: true,
      options: vibeCol.options, // For enum/select types
      format: vibeCol.cellType === 'date' ? 'relative' : undefined
    }));
    
    log.info('[UltraTable] Converted columns:', ultraColumns.map(c => `${c.id}:${c.field}:${c.type}`).join(', '));
    
    return ultraColumns;
    
  } catch (error) {
    log.error('[UltraTable] Error generating columns for', entityType, error);
    const fallbackColumns = generateFallbackColumns(entityType);
    log.info('[UltraTable] Fallback columns:', fallbackColumns.map(c => `${c.id}:${c.field}:${c.type}`).join(', '));
    return fallbackColumns;
  }
}

/**
 * Generate fallback columns when schema is not available
 */
function generateFallbackColumns(entityType: string): Column[] {
  const commonColumns: Column[] = [
    {
      id: 'name',
      field: 'name',
      name: 'Name',
      type: 'text',
      width: 200,
      sortable: true,
      resizable: true,
      editable: true,
      visible: true
    },
    {
      id: 'status',
      field: 'status',
      name: 'Status',
      type: 'enum',
      width: 120,
      sortable: true,
      resizable: true,
      editable: true,
      visible: true,
      options: [
        { value: 'active', label: 'Active', color: '#16a34a' },
        { value: 'inactive', label: 'Inactive', color: '#dc2626' },
        { value: 'pending', label: 'Pending', color: '#ea580c' }
      ]
    },
    {
      id: 'created_at',
      field: 'created_at',
      name: 'Created',
      type: 'date',
      width: 140,
      format: 'relative',
      sortable: true,
      resizable: true,
      editable: false,
      visible: true
    },
    {
      id: 'updated_at',
      field: 'updated_at',
      name: 'Updated',
      type: 'date',
      width: 140,
      format: 'relative',
      sortable: true,
      resizable: true,
      editable: false,
      visible: true
    }
  ];
  
  // Add entity-specific columns
  switch (entityType.toLowerCase()) {
    case 'client':
    case 'clients':
      return [
        {
          id: 'company_name',
          field: 'company_name',
          name: 'Company',
          type: 'text',
          width: 200,
          sortable: true,
          resizable: true,
          editable: true,
          visible: true
        },
        {
          id: 'contact_person',
          field: 'contact_person',
          name: 'Contact',
          type: 'text',
          width: 150,
          sortable: true,
          resizable: true,
          editable: true,
          visible: true
        },
        {
          id: 'email',
          field: 'email',
          name: 'Email',
          type: 'text',
          width: 200,
          sortable: true,
          resizable: true,
          editable: true,
          visible: true
        },
        ...commonColumns
      ];
      
    case 'project':
    case 'projects':
      return [
        {
          id: 'title',
          field: 'title',
          name: 'Title',
          type: 'text',
          width: 250,
          sortable: true,
          resizable: true,
          editable: true,
          visible: true
        },
        {
          id: 'client_id',
          field: 'client_id',
          name: 'Client',
          type: 'relationship-single',
          width: 150,
          relationshipType: 'single',
          relationshipTable: 'clients',
          relationshipField: 'id',
          relationshipDisplayField: 'company_name',
          sortable: true,
          resizable: true,
          editable: true,
          visible: true
        },
        {
          id: 'priority',
          field: 'priority',
          name: 'Priority',
          type: 'enum',
          width: 120,
          options: [
            { value: 'low', label: 'Low', color: '#6b7280' },
            { value: 'medium', label: 'Medium', color: '#ea580c' },
            { value: 'high', label: 'High', color: '#dc2626' },
            { value: 'urgent', label: 'Urgent', color: '#991b1b' }
          ],
          sortable: true,
          resizable: true,
          editable: true,
          visible: true
        },
        ...commonColumns
      ];
      
    case 'task':
    case 'tasks':
      return [
        {
          id: 'title',
          field: 'title',
          name: 'Title',
          type: 'text',
          width: 250,
          sortable: true,
          resizable: true,
          editable: true,
          visible: true
        },
        {
          id: 'project_id',
          field: 'project_id',
          name: 'Project',
          type: 'relationship-single',
          width: 150,
          relationshipType: 'single',
          relationshipTable: 'projects',
          relationshipField: 'id',
          relationshipDisplayField: 'title',
          sortable: true,
          resizable: true,
          editable: true,
          visible: true
        },
        {
          id: 'assignee_id',
          field: 'assignee_id',
          name: 'Assignee',
          type: 'relationship-single',
          width: 120,
          relationshipType: 'single',
          relationshipTable: 'users',
          relationshipField: 'id',
          relationshipDisplayField: 'name',
          sortable: true,
          resizable: true,
          editable: true,
          visible: true
        },
        ...commonColumns
      ];
      
    default:
      return commonColumns;
  }
}

/**
 * Map VibeGrid cell type to UltraTable column type
 */
function mapVibeGridCellTypeToUltraType(cellType: string): Column['type'] {
  switch (cellType) {
    case 'text':
      return 'text';
    case 'select':
      return 'enum';
    case 'date':
      return 'date';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'reference':
    case 'reference-single':
      return 'relationship-single';
    case 'reference-multi':
      return 'relationship-multi';
    default:
      return 'text';
  }
}

/**
 * Map schema type to column type (fallback)
 */
function mapSchemaTypeToColumnType(schemaType: string, fieldDef: any): Column['type'] {
  switch (schemaType) {
    case 'string':
      if (fieldDef.enum) return 'enum';
      if (fieldDef.format === 'date-time' || fieldDef.format === 'date') return 'date';
      if (fieldDef.format === 'uuid') return 'uuid';
      return 'text';
      
    case 'number':
    case 'integer':
      return 'number';
      
    case 'boolean':
      return 'boolean';
      
    case 'relationship':
      return fieldDef.relationshipType === 'multi' ? 'relationship-multi' : 'relationship-single';
      
    default:
      return 'text';
  }
}

/**
 * Get default width for a column type
 */
function getDefaultWidthForType(type: string): number {
  switch (type) {
    case 'boolean': return 80;
    case 'number': return 100;
    case 'date': return 140;
    case 'enum': return 120;
    case 'relationship': return 150;
    case 'uuid': return 280;
    default: return 150;
  }
}

/**
 * Format column name from field name
 */
function formatColumnName(fieldName: string): string {
  return fieldName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format enum value for display
 */
function formatEnumValue(value: string): string {
  return value
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generate color for enum value
 */
function generateEnumColor(value: string): string {
  const colors = [
    '#16a34a', // green
    '#2563eb', // blue  
    '#dc2626', // red
    '#ea580c', // orange
    '#7c3aed', // purple
    '#0891b2', // cyan
    '#be123c', // rose
    '#65a30d'  // lime
  ];
  
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) & 0xffffffff;
  }
  
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Sort columns by importance for better UX
 */
function sortColumnsByImportance(columns: Column[], entityType: string): Column[] {
  const importanceOrder = [
    'name', 'title', 'company_name', 'contact_person', 
    'email', 'status', 'priority', 'assignee_id', 
    'project_id', 'client_id', 'created_at', 'updated_at'
  ];
  
  return columns.sort((a, b) => {
    const aIndex = importanceOrder.indexOf(a.id);
    const bIndex = importanceOrder.indexOf(b.id);
    
    // If both are in the importance list, sort by index
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    
    // If only one is in the list, prioritize it
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    
    // If neither is in the list, sort alphabetically
    return a.name.localeCompare(b.name);
  });
}