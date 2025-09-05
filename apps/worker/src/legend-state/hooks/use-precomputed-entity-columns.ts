/**
 * Precomputed entity column configurations using Legend State observables
 * Avoids regenerating columns on every table load
 */

import { observable } from '@legendapp/state'
import type { Column } from '@/components/custom/vibegrid/column-types'
import { stateLog } from '@/logger';
const log = stateLog('legend-state/hooks/use-precomputed-entity-columns.ts');

// Precomputed column configurations for each entity
const entityColumnsCache = new Map<string, any>()

/**
 * Client entity columns with reference cell types
 */
function getClientColumns<T>(): Column<T>[] {
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
      id: 'email',
      field: 'email' as keyof T & string,
      name: 'Email',
      cellType: 'text' as const,
      width: 250,
      editable: true
    },
    {
      id: 'phone',
      field: 'phone' as keyof T & string,
      name: 'Phone',
      cellType: 'text' as const,
      width: 150,
      editable: true
    },
    {
      id: 'priority',
      field: 'priority' as keyof T & string,
      name: 'Priority',
      cellType: 'select' as const,
      width: 120,
      editable: true,
      options: [
        { value: 'low', label: 'Low', color: '#10B981' },
        { value: 'medium', label: 'Medium', color: '#F59E0B' },
        { value: 'high', label: 'High', color: '#F97316' },
        { value: 'critical', label: 'Critical', color: '#EF4444' }
      ]
    },
    {
      id: 'status',
      field: 'status' as keyof T & string,
      name: 'Status',
      cellType: 'select' as const,
      width: 140,
      editable: true,
      options: [
        { value: 'active', label: 'Active', color: '#10B981' },
        { value: 'inactive', label: 'Inactive', color: '#6B7280' },
        { value: 'pending', label: 'Pending', color: '#F59E0B' },
        { value: 'on_hold', label: 'On Hold', color: '#8B5CF6' },
        { value: 'archived', label: 'Archived', color: '#6B7280' },
        { value: 'deleted', label: 'Deleted', color: '#EF4444' }
      ]
    },
    {
      id: 'company',
      field: 'company' as keyof T & string,
      name: 'Company',
      cellType: 'text' as const,
      width: 200,
      editable: true
    },
    {
      id: 'notes',
      field: 'notes' as keyof T & string,
      name: 'Notes',
      cellType: 'text' as const,
      width: 300,
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

/**
 * Task entity columns with reference cell types
 */
function getTaskColumns<T>(): Column<T>[] {
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
      id: 'description',
      field: 'description' as keyof T & string,
      name: 'Description',
      cellType: 'text' as const,
      width: 300,
      editable: true
    },
    {
      id: 'priority_option',
      field: 'priority_option' as keyof T & string,
      name: 'Priority',
      cellType: 'reference-select' as const,
      referenceType: 'system',
      systemOptionType: 'priority',
      systemArchetype: 'task',
      width: 120,
      editable: true
    },
    {
      id: 'status_option',
      field: 'status_option' as keyof T & string,
      name: 'Status',
      cellType: 'reference-select' as const,
      referenceType: 'system',
      systemOptionType: 'status',
      systemArchetype: 'task',
      width: 140,
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

/**
 * Project entity columns with reference cell types
 */
function getProjectColumns<T>(): Column<T>[] {
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
      id: 'description',
      field: 'description' as keyof T & string,
      name: 'Description',
      cellType: 'text' as const,
      width: 300,
      editable: true
    },
    {
      id: 'priority_option',
      field: 'priority_option' as keyof T & string,
      name: 'Priority',
      cellType: 'reference-select' as const,
      referenceType: 'system',
      systemOptionType: 'priority',
      systemArchetype: 'project',
      width: 120,
      editable: true
    },
    {
      id: 'status_option',
      field: 'status_option' as keyof T & string,
      name: 'Status',
      cellType: 'reference-select' as const,
      referenceType: 'system',
      systemOptionType: 'status',
      systemArchetype: 'project',
      width: 140,
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
 * Column factory function - maps entity names to their column configurations
 */
const entityColumnFactories: Record<string, <T>() => Column<T>[]> = {
  Client: getClientColumns,
  Task: getTaskColumns,
  Project: getProjectColumns
}

/**
 * Get precomputed columns observable for an entity
 * Uses cached observables to avoid regeneration on every table load
 */
export function getPrecomputedEntityColumns$<T = any>(entityName: string) {
  const cacheKey = entityName.toLowerCase()
  
  if (!entityColumnsCache.has(cacheKey)) {
    // Normalize the entity name to handle plural/singular and case variations
    const normalizedName = normalizeEntityName(entityName)
    
    // Get the column factory for this entity
    const columnFactory = entityColumnFactories[normalizedName] || entityColumnFactories.Client
    
    // Create observable with precomputed columns
    const columns$ = observable(columnFactory<T>())
    
    entityColumnsCache.set(cacheKey, columns$)
    
    log.info(`[getPrecomputedEntityColumns$] Created cached observable for ${entityName}`, {
      originalName: entityName,
      normalizedName: normalizedName,
      columnCount: columnFactory<T>().length,
      referenceColumns: columnFactory<T>().filter(col => col.cellType?.startsWith('reference')).length
    })
  }
  
  return entityColumnsCache.get(cacheKey)
}

/**
 * Hook that returns precomputed columns for an entity using Legend State observable
 * Much more efficient than dynamic generation - columns are cached and reused
 */
export function usePrecomputedEntityColumns<T = any>(entityName: string): {
  columns: Column<T>[]
  isLoading: boolean
  error: string | null
} {
  const columns$ = getPrecomputedEntityColumns$<T>(entityName)
  
  // The observable contains precomputed columns, no loading state needed
  return {
    columns: columns$.get(),
    isLoading: false,
    error: null
  }
}

/**
 * Clear the entity columns cache (for testing/debugging)
 */
export function clearEntityColumnsCache() {
  entityColumnsCache.clear()
  log.info('[clearEntityColumnsCache] Cleared all cached entity column observables')
}