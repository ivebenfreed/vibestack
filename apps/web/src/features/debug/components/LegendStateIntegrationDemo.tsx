/**
 * VibeGrid with Legend State Integration
 * Using the actual VibeGrid table component with Legend State
 */

import React from 'react'
import { VibeGrid } from '@/components/custom/vibegrid'
import { Badge } from '@/components/ui/badge'

export function LegendStateIntegrationDemo() {
  const columns = [
    {
      id: 'title',
      field: 'title',
      name: 'Title',
      cellType: 'text' as const,
      width: 200,
      editable: true
    },
    {
      id: 'description', 
      field: 'description',
      name: 'Description',
      cellType: 'text' as const,
      width: 300,
      editable: true
    },
    {
      id: 'status',
      field: 'status', 
      name: 'Status',
      cellType: 'enum' as const,
      width: 120,
      editable: true,
      options: [
        { value: 'todo', label: 'To Do' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' }
      ]
    },
    {
      id: 'priority',
      field: 'priority',
      name: 'Priority', 
      cellType: 'enum' as const,
      width: 100,
      editable: true,
      options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' }
      ]
    },
    {
      id: 'created_at',
      field: 'created_at',
      name: 'Created',
      cellType: 'date' as const,
      width: 150,
      editable: false
    }
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">VibeGrid + Legend State Integration</h1>
        <div className="flex gap-2">
          <Badge variant="outline">Full Table</Badge>
          <Badge variant="secondary">Inline Editing</Badge>
          <Badge variant="default">Legend State</Badge>
        </div>
      </div>

      <div className="h-[600px] border rounded-lg">
        <VibeGrid
          entityType="Task"
          columns={columns}
          useLegendState={true}
          tableId="debug-tasks-table"
          className="h-full"
        />
      </div>
    </div>
  )
}