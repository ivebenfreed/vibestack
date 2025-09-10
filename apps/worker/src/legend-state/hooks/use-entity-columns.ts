/**
 * React hook that generates VibeGrid columns from Legend State schema observable
 * Reactive column generation for dynamic entities
 */

import { useMemo } from 'react'
import { use$ } from '@legendapp/state/react'
import { universeSchema$ } from '../observables'
import type { Column } from '@/components/custom/vibegrid/column-types'
import { log } from '@/logger';
const fileLog = log('legend-state/hooks/use-entity-columns.ts');

/**
 * Generate VibeGrid columns from entity archetype (since schema doesn't have field definitions)
 * We use the archetype to generate sensible default columns
 */
function generateColumnsFromArchetype<T>(entityName: string, archetype: string): Column<T>[] {
  fileLog.info('[useEntityColumns] Generating columns from archetype:', { entityName, archetype })
  
  // Base columns that most entities have
  const baseColumns: Column<T>[] = [
    {
      id: 'id',
      field: 'id' as keyof T & string,
      name: 'ID',
      cellType: 'text' as const,
      width: 200,
      editable: false
    }
  ]
  
  // Archetype-specific columns
  const archetypeColumns: Record<string, Column<T>[]> = {
    task: [
      {
        id: 'title',
        field: 'title' as keyof T & string,
        name: 'Title',
        cellType: 'text' as const,
        width: 250,
        editable: true
      },
      {
        id: 'description',
        field: 'description' as keyof T & string,
        name: 'Description',
        cellType: 'text' as const,
        width: 300,
        editable: true
      },
      {
        id: 'status',
        field: 'status' as keyof T & string,
        name: 'Status',
        cellType: 'text' as const,
        width: 120,
        editable: true
      },
      {
        id: 'priority',
        field: 'priority' as keyof T & string,
        name: 'Priority',
        cellType: 'text' as const,
        width: 100,
        editable: true
      },
      {
        id: 'created_at',
        field: 'created_at' as keyof T & string,
        name: 'Created',
        cellType: 'date' as const,
        width: 150,
        editable: false
      }
    ],
    record: [
      {
        id: 'title',
        field: 'title' as keyof T & string,
        name: 'Title',
        cellType: 'text' as const,
        width: 250,
        editable: true
      },
      {
        id: 'created_at',
        field: 'created_at' as keyof T & string,
        name: 'Created',
        cellType: 'date' as const,
        width: 150,
        editable: false
      },
      {
        id: 'updated_at',
        field: 'updated_at' as keyof T & string,
        name: 'Updated',
        cellType: 'date' as const,
        width: 150,
        editable: false
      }
    ],
    project: [
      {
        id: 'title',
        field: 'title' as keyof T & string,
        name: 'Title',
        cellType: 'text' as const,
        width: 250,
        editable: true
      },
      {
        id: 'description',
        field: 'description' as keyof T & string,
        name: 'Description',
        cellType: 'text' as const,
        width: 300,
        editable: true
      },
      {
        id: 'status',
        field: 'status' as keyof T & string,
        name: 'Status',
        cellType: 'text' as const,
        width: 120,
        editable: true
      }
    ]
  }
  
  const specificColumns = archetypeColumns[archetype] || archetypeColumns.record
  return [...baseColumns, ...specificColumns]
}

/**
 * Generate VibeGrid columns from syncableFields in the schema
 */
function generateColumnsFromSyncableFields<T>(syncableFields: any, entityName: string): Column<T>[] {
  fileLog.info('[useEntityColumns] Generating columns from syncableFields:', { entityName, syncableFields })
  
  const allColumns = Object.entries(syncableFields).map(([fieldName, fieldDef]: [string, any]) => {
    const safeFieldDef = fieldDef && typeof fieldDef === 'object' ? fieldDef : {}
    const fieldType = String(safeFieldDef.type || 'text').toLowerCase()
    
    // Map DataForge field types to VibeGrid cell types
    const getCellType = (type: string): string => {
      switch (type.toLowerCase()) {
        // Date types
        case 'timestamp': 
        case 'date': 
          return 'date'
        case 'datetime':
          return 'datetime'
        
        // Number types
        case 'number': 
        case 'float':
          return 'number'
        case 'integer':
          return 'integer'
        case 'decimal':
          return 'decimal'
        
        // Text types
        case 'text':
          return 'text'
        case 'longtext':
          return 'longtext'
        case 'rich-text':
        case 'rich_text':
          return 'rich-text'
        
        // Boolean types
        case 'boolean': 
        case 'bool': 
          return 'boolean'
        
        // Communication types
        case 'email':
          return 'email'
        case 'url':
          return 'url'
        case 'phone':
          return 'phone'
        
        // Rich data types
        case 'file':
          return 'file'
        case 'currency':
          return 'currency'
        case 'color':
          return 'color'
        
        // Selection types
        case 'single-select':
        case 'single_select':
          return 'single-select'
        case 'multi-select':
        case 'multi_select':
          return 'multi-select'
        
        // Reference types (stored as relationships)
        case 'user_reference':
          return 'user_reference'
        case 'entity_reference':
          return 'entity_reference'
        case 'custom_user_reference':
          return 'custom_user_reference'
        case 'custom_entity_reference':
          return 'custom_entity_reference'
        
        // Rollup types
        case 'rollup_count':
          return 'rollup_count'
        case 'rollup_sum':
          return 'rollup_sum'
        case 'rollup_average':
          return 'rollup_average'
        case 'rollup_concat':
          return 'rollup_concat'
        
        // Computed types
        case 'computed_expression':
          return 'computed_expression'
        case 'computed_formula':
          return 'computed_formula'
        
        // Legacy/compatibility
        case 'select':
          return 'select'
        case 'reference-select':
        case 'reference_select':
          return 'reference-select'
        
        default: 
          return 'text'
      }
    }
    
    // Determine column width based on field type and name
    const getWidth = (type: string, name: string) => {
      // Boolean fields are narrow
      if (type === 'boolean') return 80
      
      // Date/time fields
      if (type.includes('timestamp') || type.includes('date') || type === 'datetime') return 150
      
      // ID fields
      if (name === 'id') return 200
      
      // Communication fields
      if (type === 'email' || name.includes('email')) return 250
      if (type === 'url' || name.includes('url') || name.includes('website')) return 250
      if (type === 'phone' || name.includes('phone')) return 150
      
      // Rich content fields
      if (name.includes('description') || type === 'longtext' || type === 'rich-text') return 300
      
      // Numeric fields
      if (type === 'number' || type === 'integer' || type === 'decimal') return 120
      if (type === 'currency') return 150
      
      // Color fields
      if (type === 'color') return 100
      
      // File fields
      if (type === 'file') return 200
      
      // Reference and relationship fields
      if (type.includes('reference') || type.includes('rollup') || type.includes('relationship')) return 180
      
      // Selection fields
      if (type.includes('select')) return 150
      
      // Default
      return 200
    }
    
    // Determine if field should be editable
    const isEditable = !['id', 'created_at', 'updated_at'].includes(fieldName) && 
                       safeFieldDef.syncable !== false
    
    return {
      id: fieldName,
      field: fieldName as keyof T & string,
      name: formatFieldName(fieldName),
      cellType: getCellType(fieldType) as any,
      width: getWidth(fieldType, fieldName),
      editable: isEditable,
      isSystemField: ['created_at', 'updated_at'].includes(fieldName)
    }
  })
  
  // Separate business fields from system fields
  const businessFields = allColumns.filter(col => !col.isSystemField)
  const systemFields = allColumns.filter(col => col.isSystemField)
  
  // Remove the temporary isSystemField property and return business fields first, then system fields
  const orderedColumns = [...businessFields, ...systemFields].map(col => {
    const { isSystemField, ...column } = col
    return column
  })
  
  fileLog.info('[useEntityColumns] Column ordering:', {
    businessFieldCount: businessFields.length,
    systemFieldCount: systemFields.length,
    totalColumns: orderedColumns.length,
    businessFields: businessFields.map(c => c.id),
    systemFields: systemFields.map(c => c.id)
  })
  
  return orderedColumns
}

/**
 * Format field name for display
 * e.g., "firstName" -> "First Name", "statusId" -> "Status"
 */
function formatFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
    .replace(/Id$/, '') // Remove "Id" suffix
    .replace(/_/g, ' ') // Replace underscores with spaces
    .trim()
}

/**
 * Hook that reactively generates columns for an entity from Legend State schema
 */
export function useEntityColumns<T = any>(entityName: string): {
  columns: Column<T>[]
  isLoading: boolean
  error: string | null
} {
  // Reactively get schema from Legend State
  const schema = use$(universeSchema$)
  
  // Memoized column generation
  const { columns, error } = useMemo(() => {
    if (!schema) {
      return { columns: [], error: null }
    }
    
    if (!schema.entities) {
      return { columns: [], error: 'No entities in schema' }
    }
    
    // Find entity in schema object (case-insensitive)
    const entityDef = schema.entities[entityName] || 
      Object.entries(schema.entities).find(([key]) => 
        key.toLowerCase() === entityName.toLowerCase()
      )?.[1]
    
    fileLog.info('[useEntityColumns] Schema debug:', {
      entityName,
      hasSchemaEntities: !!schema.entities,
      availableEntities: Object.keys(schema.entities),
      entityDef,
      archetype: entityDef?.archetype,
      syncableFields: entityDef?.syncableFields
    })
    
    if (!entityDef) {
      return { 
        columns: [], 
        error: `Entity "${entityName}" not found in schema. Available: ${Object.keys(schema.entities).join(', ')}` 
      }
    }
    
    try {
      // Use syncableFields to generate columns, fall back to archetype-based
      const generatedColumns = entityDef.syncableFields 
        ? generateColumnsFromSyncableFields<T>(entityDef.syncableFields, entityName)
        : generateColumnsFromArchetype<T>(entityName, entityDef.archetype)
      
      fileLog.info(`[useEntityColumns] Generated ${generatedColumns.length} columns for ${entityName}`, generatedColumns)
      return { columns: generatedColumns, error: null }
    } catch (err) {
      return { columns: [], error: `Failed to generate columns: ${err}` }
    }
  }, [schema, entityName])
  
  return {
    columns,
    isLoading: !schema,
    error
  }
}

/**
 * Get a basic fallback column set when schema is not available
 */
export function getBasicEntityColumns<T = any>(): Column<T>[] {
  return [
    {
      id: 'id',
      field: 'id' as keyof T & string,
      name: 'ID',
      cellType: 'text' as const,
      width: 200,
      editable: false
    },
    {
      id: 'title',
      field: 'title' as keyof T & string,
      name: 'Title',
      cellType: 'text' as const,
      width: 250,
      editable: true
    },
    {
      id: 'updatedAt',
      field: 'updatedAt' as keyof T & string,
      name: 'Updated',
      cellType: 'date' as const,
      width: 150,
      editable: false
    }
  ]
}