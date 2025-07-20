import { createFileRoute } from '@tanstack/react-router'
import ProjectsPage from '@/features/projects'
import { db } from '@repo/dataforge/dexie-schema'
import { syncProcessView } from '@/components/custom/vibegriddex/utils/syncViewProcessor'
import type { Column } from '@/components/custom/vibegriddex/column-types'
import type { Project } from '@repo/dataforge/client-entities'

export const Route = createFileRoute('/_authenticated/projects/')({
  staleTime: 30_000, // Cache for 30 seconds
  loader: async () => {
    console.log('[Projects Route] Loading projects data from Dexie')
    
    // Define columns matching the Projects component
    const columns: Column<Project>[] = [
      { id: 'name', field: 'name', name: 'Name', cellType: 'text', width: 250 },
      { id: 'description', field: 'description', name: 'Description', cellType: 'text', width: 400 },
      { id: 'status', field: 'status', name: 'Status', cellType: 'enum', width: 150,
        options: [
          { value: 'active', label: 'Active' },
          { value: 'in_progress', label: 'In Progress' },
          { value: 'completed', label: 'Completed' },
          { value: 'on_hold', label: 'On Hold' }
        ]
      },
      { id: 'priority', field: 'priority', name: 'Priority', cellType: 'enum', width: 120,
        options: [
          { value: 'low', label: 'Low' },
          { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' },
          { value: 'critical', label: 'Critical' }
        ]
      },
      { id: 'startDate', field: 'startDate', name: 'Start Date', cellType: 'date', width: 150 },
      { id: 'endDate', field: 'endDate', name: 'End Date', cellType: 'date', width: 150 },
      { id: 'ownerId', field: 'ownerId', name: 'Owner', cellType: 'relationship-single',
        width: 180, relationshipTable: 'users', relationshipDisplayField: 'name' },
      { id: 'tags', field: 'tags', name: 'Tags', cellType: 'relationship-multi',
        width: 250, relationshipTable: 'tags', relationshipDisplayField: 'name' },
      { id: 'createdAt', field: 'createdAt', name: 'Created', cellType: 'date', width: 150, editable: false },
      { id: 'updatedAt', field: 'updatedAt', name: 'Updated', cellType: 'date', width: 150, editable: false }
    ]
    
    // Load all necessary data in parallel
    const [projects, users, tags] = await Promise.all([
      db.projects.toArray(),
      db.users.toArray(),
      db.tags.toArray()
    ])
    
    // Create relationship data map
    const relationshipData: Record<string, any> = {
      users: Object.fromEntries(users.map(u => [u.id, u])),
      tags: Object.fromEntries(tags.map(t => [t.id, t]))
    }
    
    // Create relationship resolvers
    const relationshipResolvers: Record<string, (id: string | string[]) => string> = {
      ownerId: (id: string | string[]) => {
        if (Array.isArray(id)) return id.join(', ')
        const user = relationshipData.users[id]
        return user?.name || user?.email || id
      },
      tags: (ids: string | string[]) => {
        if (!Array.isArray(ids)) return ''
        return ids.map(id => {
          const tag = relationshipData.tags[id]
          return tag?.name || id
        }).join(', ')
      }
    }
    
    // Process view data to match VibeGridDex expectations
    const processedData = syncProcessView({
      entities: projects,
      columns: columns,
      sortBy: [],
      filters: [],
      groupBy: [],
      columnVisibility: Object.fromEntries(columns.map(col => [col.id, true])),
      columnOrder: columns.map(col => col.id),
      rowHeight: 40,
      enableSelectionColumn: true,
      relationshipResolvers
    })
    
    console.log('[Projects Route] Processed data:', {
      projectCount: projects.length,
      processedRowCount: processedData.processedRows.length,
      columnCount: processedData.visibleColumns.length
    })
    
    return {
      projects,
      relationshipData,
      initialData: {
        processedRows: processedData.processedRows,
        visibleColumns: processedData.visibleColumns,
        coordinateMapping: processedData.coordinateMapping,
        relationshipData,
        relationshipResolvers
      }
    }
  },
  component: ProjectsPage,
}) 