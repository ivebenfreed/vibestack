/**
 * Precomputed entity column configurations using Legend State observables
 * Avoids regenerating columns on every table load
 */

import { observable } from '@legendapp/state'
import type { Column } from '@/components/custom/vibegrid/column-types'
import { log } from '@/logger';
const fileLog = log('legend-state/hooks/use-precomputed-entity-columns.ts');

// Precomputed column configurations for each entity
const entityColumnsCache = new Map<string, any>()

/**
 * Get schema-based columns for any entity
 * Dynamically generates columns based on entity schema fields
 */
function getSchemaBasedColumns<T>(entityName: string, schema?: any): Column<T>[] {
  const columns: Column<T>[] = []
  
  // Support multiple schema field structures
  // Priority: syncableFields (from schema client) > fields > businessMetadata.fields
  const schemaFields = schema?.syncableFields || schema?.fields || schema?.businessMetadata?.fields
  
  // If we have schema fields, use them to generate columns
  // Schema fields can be either an array or an object
  if (schemaFields && (Array.isArray(schemaFields) || typeof schemaFields === 'object')) {
    // Add ID column first (always present but not in schema fields)
    columns.push({
      id: 'id',
      field: 'id' as keyof T & string,
      name: 'ID',
      cellType: 'text' as const,
      width: 200,
      editable: false
    })
    
    // Convert to array format if it's an object
    const fieldsArray = Array.isArray(schemaFields) 
      ? schemaFields 
      : Object.entries(schemaFields).map(([name, def]: [string, any]) => ({ 
          name, 
          ...(typeof def === 'object' ? def : { type: def })
        }))
    
    // Generate columns from schema fields
    fieldsArray.forEach((fieldDef: any) => {
      const fieldName = fieldDef.name
      
      // Skip system fields that we handle separately
      if (['id', 'organization_id', 'created_by'].includes(fieldName)) {
        return
      }
      
      // Determine cell type based on field type
      let cellType: Column<T>['cellType'] = 'text'
      let options: any[] | undefined
      
      if (fieldDef.cellType) {
        cellType = fieldDef.cellType
      } else if (fieldDef.type === 'select' || fieldDef.type === 'status' || fieldDef.type === 'status_set' || fieldDef.enumOptions) {
        cellType = 'select'
        options = fieldDef.enumOptions
      } else if (fieldDef.type === 'boolean') {
        cellType = 'checkbox'
      } else if (fieldDef.type === 'integer' || fieldDef.type === 'number' || fieldDef.type === 'decimal') {
        cellType = 'number'
      } else if (fieldDef.type === 'date' || fieldDef.type === 'datetime') {
        cellType = 'date'
      } else if (fieldDef.type === 'email' || fieldName.includes('email')) {
        cellType = 'text' // Could be enhanced to 'email' type
      } else if (fieldDef.type === 'rich_text' || fieldDef.type === 'longtext') {
        cellType = 'text' // Could be enhanced to support rich text
      }
      
      // Add field-specific options for select fields
      if (fieldName === 'status' && !options) {
        options = [
          { value: 'not_started', label: 'Not Started', color: '#6B7280', backgroundColor: '#F3F4F6' },
          { value: 'active', label: 'Active', color: '#065F46', backgroundColor: '#D1FAE5' },
          { value: 'in_progress', label: 'In Progress', color: '#92400E', backgroundColor: '#FEF3C7' },
          { value: 'done', label: 'Done', color: '#065F46', backgroundColor: '#D1FAE5' },
          { value: 'completed', label: 'Completed', color: '#065F46', backgroundColor: '#D1FAE5' },
          { value: 'archived', label: 'Archived', color: '#6B7280', backgroundColor: '#F3F4F6' }
        ]
      } else if (fieldName === 'priority' && !options) {
        options = [
          { value: 'low', label: 'Low', color: '#4B5563', backgroundColor: '#F3F4F6' },
          { value: 'medium', label: 'Medium', color: '#92400E', backgroundColor: '#FEF3C7' },
          { value: 'high', label: 'High', color: '#991B1B', backgroundColor: '#FEE2E2' },
          { value: 'critical', label: 'Critical', color: '#7F1D1D', backgroundColor: '#FEE2E2' }
        ]
      }
      
      // Calculate appropriate width based on field type
      let width = 150
      if (fieldName === 'name' || fieldName === 'title') width = 250
      else if (fieldName.includes('email')) width = 250
      else if (fieldName.includes('description') || fieldName.includes('notes') || fieldName.includes('content')) width = 300
      else if (fieldName === 'status' || fieldName === 'priority') width = 140
      else if (fieldName.includes('phone')) width = 150
      else if (fieldName.includes('company')) width = 200
      
      // If we have options, ensure cellType is 'select'
      if (options && options.length > 0) {
        cellType = 'select'
        fileLog.info(`[use-precomputed-entity-columns] Setting cellType to 'select' for field ${fieldName} with ${options.length} options`)
      }

      columns.push({
        id: fieldName,
        field: fieldName as keyof T & string,
        name: fieldName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        cellType,
        width,
        editable: !fieldDef.serverOnly && fieldName !== 'created_at' && fieldName !== 'updated_at',
        options
      })
    })
    
    // Add timestamp columns at the end if not already added
    if (!columns.find(col => col.id === 'created_at')) {
      columns.push({
        id: 'created_at',
        field: 'created_at' as keyof T & string,
        name: 'Created',
        cellType: 'date' as const,
        width: 150,
        editable: false
      })
    }
    
    if (!columns.find(col => col.id === 'updated_at')) {
      columns.push({
        id: 'updated_at',
        field: 'updated_at' as keyof T & string,
        name: 'Updated',
        cellType: 'date' as const,
        width: 150,
        editable: false
      })
    }
    
    return columns
  }
  
  // Fallback to basic columns if no schema available
  return getBasicColumns<T>()
}

/**
 * Basic fallback columns when schema is not available
 */
function getBasicColumns<T>(): Column<T>[] {
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
      id: 'name',
      field: 'name' as keyof T & string,
      name: 'Name',
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
  ]
}

// Removed hardcoded Task and Project column definitions
// Now using schema-based column generation for all entities

/**
 * Normalize entity name to handle plural/singular and case variations
 */
function normalizeEntityName(entityName: string): string {
  // Remove org prefix if present (e.g., "01920000-1000-7000-8000-000000000001_clients" -> "clients")
  const cleanName = entityName.includes('_') && entityName.match(/^[0-9a-f-]+_(.+)$/i) 
    ? entityName.split('_').slice(1).join('_') 
    : entityName
  
  // Handle plural to singular mapping
  const pluralToSingular: Record<string, string> = {
    'clients': 'Client',
    'tasks': 'Task', 
    'projects': 'Project',
    'meetings': 'Meeting',
    'contracts': 'Contract',
    'invoices': 'Invoice',
    'expenses': 'Expense',
    'files': 'File',
    'discussions': 'Discussion',
    'timesheets': 'Timesheet'
  }
  
  // Check plural mapping first
  const lowerName = cleanName.toLowerCase()
  if (pluralToSingular[lowerName]) {
    return pluralToSingular[lowerName]
  }
  
  // Capitalize first letter for singular forms
  return cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase()
}

/**
 * Get precomputed columns observable for an entity
 * No longer used - kept for backwards compatibility
 * @deprecated Use usePrecomputedEntityColumns with schema instead
 */
export function getPrecomputedEntityColumns$<T = any>(entityName: string) {
  const cacheKey = entityName.toLowerCase()
  
  if (!entityColumnsCache.has(cacheKey)) {
    // Create observable with basic columns as fallback
    const columns$ = observable(getBasicColumns<T>())
    entityColumnsCache.set(cacheKey, columns$)
    
    fileLog.info(`[getPrecomputedEntityColumns$] Created basic columns fallback for ${entityName}`)
  }
  
  return entityColumnsCache.get(cacheKey)
}

/**
 * Hook that returns schema-based columns for an entity
 * Dynamically generates columns based on entity schema
 */
export function usePrecomputedEntityColumns<T = any>(entityName: string, schema?: any): {
  columns: Column<T>[]
  isLoading: boolean
  error: string | null
} {
  // Generate columns based on schema if available
  const columns = getSchemaBasedColumns<T>(entityName, schema)
  
  return {
    columns,
    isLoading: false,
    error: null
  }
}

/**
 * Clear the entity columns cache (for testing/debugging)
 */
export function clearEntityColumnsCache() {
  entityColumnsCache.clear()
  fileLog.info('[clearEntityColumnsCache] Cleared all cached entity column observables')
}