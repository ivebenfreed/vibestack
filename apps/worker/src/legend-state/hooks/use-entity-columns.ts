/**
 * React hook that generates VibeGrid columns from Legend State schema observable
 * Reactive column generation for dynamic entities
 */

import { useMemo } from 'react'
import { use$ } from '@legendapp/state/react'
import { orgContext$ } from '../observables'
import type { Column } from '@/components/custom/vibegrid/column-types'
import { stateLog } from '@/logger';
const log = stateLog('legend-state/hooks/use-entity-columns.ts');

/**
 * Generate VibeGrid columns from entity archetype (since schema doesn't have field definitions)
 * We use the archetype to generate sensible default columns
 */
function generateColumnsFromArchetype<T>(entityName: string, archetype: string): Column<T>[] {
  log.info('[useEntityColumns] Generating columns from archetype:', { entityName, archetype })
  
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
  log.info('[useEntityColumns] Generating columns from syncableFields:', { entityName, syncableFields })
  
  const allColumns = Object.entries(syncableFields).map(([fieldName, fieldDef]: [string, any]) => {
    const safeFieldDef = fieldDef && typeof fieldDef === 'object' ? fieldDef : {}
    const fieldType = String(safeFieldDef.type || 'text').toLowerCase()
    
    // Map schema field types to VibeGrid cell types
    const getCellType = (type: string) => {
      switch (type) {
        case 'timestamp': 
        case 'date': 
        case 'datetime': 
          return 'date'
        case 'number': 
        case 'integer': 
        case 'float': 
          return 'number'
        case 'boolean': 
        case 'bool': 
          return 'boolean'
        default: 
          return 'text'
      }
    }
    
    // Determine column width based on field type and name
    const getWidth = (type: string, name: string) => {
      if (type === 'boolean') return 80
      if (type.includes('timestamp') || type.includes('date')) return 150
      if (name === 'id') return 200
      if (name.includes('email')) return 250
      if (name.includes('description')) return 300
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
  
  log.info('[useEntityColumns] Column ordering:', {
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
  const schema = use$(orgContext$.schema)
  
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
    
    log.info('[useEntityColumns] Schema debug:', {
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
      
      log.info(`[useEntityColumns] Generated ${generatedColumns.length} columns for ${entityName}`, generatedColumns)
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