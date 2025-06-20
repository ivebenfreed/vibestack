/**
 * VibeGrid Tasks Example - PURE XSTATE DECLARATIVE PATTERN
 * 
 * 🎯 STABLE ARCHITECTURE: Pure XState with no unnecessary memoization
 * ✅ Direct actor/selector usage (no custom hooks)
 * ✅ Unified VibeGridCellProps interface
 * ✅ Correct CellType values
 * ✅ Atomic row updates
 * ✅ Pure declarative column configuration
 * ✅ No heavy memoization - stable references only
 * ✅ Dynamic entity types from @repo/dataforge
 * ✅ Consistent naming conventions (entityType)
 * 
 * Features Demonstrated:
 * - Pure XState actor/selector patterns
 * - Direct cell type specification with unified props
 * - Relationship resolution with entity adapters
 * - Complete Task entity coverage
 * - Optimal performance without heavy memoization
 * - Dynamic entity type system from CLIENT_DOMAIN_TABLES
 */

import React from 'react'
import { VibeGrid } from '@/components/custom/vibegrid'
// Import entity adapters for relationship resolution
import { 
  useProjectsAtomAdapter, 
  useUsersAtomAdapter
} from '@/components/custom/vibegrid/stores/entityAtomAdapter'
import type { Task } from '@repo/dataforge/client-entities'
import type { VibeColumnDef } from '@/components/custom/vibegrid/types'

// ============================================================================
// STABLE COLUMN DEFINITIONS (MODULE-LEVEL CONSTANTS)
// ============================================================================

const taskColumns: VibeColumnDef<Task>[] = [
  // ID fields - Use explicit cell type for best performance
  {
    id: 'id',
    accessorKey: 'id',
    header: 'ID',
    cellType: 'id',
    cellConfig: { 
      editable: false
    },
    width: 100
  },
  {
    id: 'title',
    accessorKey: 'title',
    header: 'Title',
    cellType: 'text',
    cellConfig: { 
      editable: true 
    },
    width: 200
  },
  {
    id: 'description',
    accessorKey: 'description',
    header: 'Description',
    cellType: 'text', // Changed from richText to text for now
    cellConfig: { 
      editable: true
    },
    width: 250
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    cellType: 'enum',
    cellConfig: {
      editable: true,
      enumValues: {
        'open': 'Open',
        'in_progress': 'In Progress',
        'completed': 'Completed'
      }
    },
    width: 120
  },
  {
    id: 'priority',
    accessorKey: 'priority',
    header: 'Priority',
    cellType: 'enum',
    cellConfig: {
      editable: true,
      enumValues: {
        'low': 'Low',
        'medium': 'Medium',
        'high': 'High'
      }
    },
    width: 100
  },
  {
    id: 'startDate',
    accessorKey: 'startDate',
    header: 'Start Date',
    cellType: 'date',
    cellConfig: { 
      editable: true, 
      format: 'MMM dd, yyyy', 
      showTime: false 
    },
    width: 120
  },
  {
    id: 'dueDate',
    accessorKey: 'dueDate',
    header: 'Due Date',
    cellType: 'date',
    cellConfig: { 
      editable: true, 
      format: 'MMM dd, yyyy', 
      showTime: false 
    },
    width: 120
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: 'Created',
    cellType: 'date',
    cellConfig: { 
      editable: false, 
      format: 'MMM dd, yyyy HH:mm', 
      showTime: true 
    },
    width: 150
  },
  {
    id: 'updatedAt',
    accessorKey: 'updatedAt',
    header: 'Updated',
    cellType: 'date',
    cellConfig: { 
      editable: false, 
      format: 'MMM dd, yyyy HH:mm', 
      showTime: true 
    },
    width: 150
  },
  {
    id: 'projectId',
    accessorKey: 'projectId',
    header: 'Project',
    cellType: 'singleSelectRelationship',
    cellConfig: {
      relationshipType: 'Project',
      displayField: 'name',
      placeholder: 'Select project...'
    },
    width: 200
  },
  {
    id: 'assigneeId',
    accessorKey: 'assigneeId',
    header: 'Assignee',
    cellType: 'singleSelectRelationship',
    cellConfig: {
      relationshipType: 'User',
      displayField: 'name',
      placeholder: 'Select assignee...'
    },
    width: 180
  }
]

// ============================================================================
// ✅ PURE COMPONENT: No React.memo needed for route components
// ============================================================================

export function VibeGridTasksExample() {
  // ✅ ENTITY ADAPTER DEPENDENCIES: Ensure related entities are loaded
  // Load all projects and users for relationship resolution (no pagination needed)
  const { data: projects } = useProjectsAtomAdapter()
  const { data: users } = useUsersAtomAdapter()
  
  return (
    <div className="space-y-6">
      {/* Simple header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">Tasks</h2>
        <p className="text-muted-foreground">
          Manage and track your tasks
        </p>
      </div>

      {/* 🛡️ STABLE XSTATE TASK ENTITY: VibeGrid with consistent props */}
      <VibeGrid<Task>
        entityType="tasks"
        columns={taskColumns}
        title="Task Grid"
        className="border-2 border-primary/20"
        enableBulkActions={true}
        enableColumnResizing={true}
        enableColumnVisibility={true}
        enableSearch={true}
        enableFiltering={true}
        enableSorting={true}
      />
    </div>
  )
} 