/**
 * Example of VibeGrid with Legend State integration
 * Demonstrates onSave operations connected to Legend State mutations
 */

import React, { useState } from 'react'
import { VibeGrid } from '@/components/custom/vibegrid'
import type { Column } from '@/components/custom/vibegrid/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// Example columns for testing
const taskColumns: Column[] = [
  {
    id: 'title',
    field: 'title',
    name: 'Title',
    type: 'text',
    width: 200,
    sortable: true,
    filterable: true
  },
  {
    id: 'status',
    field: 'status', 
    name: 'Status',
    type: 'text',
    width: 120,
    sortable: true,
    filterable: true
  },
  {
    id: 'priority',
    field: 'priority',
    name: 'Priority', 
    type: 'text',
    width: 100,
    sortable: true
  },
  {
    id: 'createdAt',
    field: 'createdAt',
    name: 'Created',
    type: 'date',
    width: 140,
    sortable: true
  }
]

export function VibeGridLegendStateExample() {
  const [operationLog, setOperationLog] = useState<string[]>([])
  
  const logOperation = (operation: string) => {
    setOperationLog(prev => [
      `${new Date().toLocaleTimeString()}: ${operation}`,
      ...prev.slice(0, 9) // Keep last 10 operations
    ])
  }
  
  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">VibeGrid with Legend State</h2>
        <div className="flex gap-2">
          <Badge variant="outline">Legend State Integration</Badge>
          <Badge variant="secondary">Mutation Support</Badge>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="border rounded-lg">
            <VibeGrid
              tableId="legend-state-tasks"
              entityType="task"
              height={400}
              useLegendState={true}
              enableSorting={true}
              enableFiltering={true}
              enableSelectionColumn={true}
              enableDragAndDrop={true}
              // Mutation handlers that will be connected to Legend State
              onEntityUpdate={async (rowId: string, updates: Record<string, any>) => {
                logOperation(`UPDATE: ${rowId} - ${JSON.stringify(updates)}`)
                // This will be handled by the table machine -> Legend State
              }}
              onBatchEntityUpdate={async (updates: Array<{ id: string; updates: Record<string, any> }>) => {
                logOperation(`BATCH UPDATE: ${updates.length} entities`)
                // This will be handled by the table machine -> Legend State
              }}
            />
          </div>
          
          <div className="mt-4 text-sm text-muted-foreground">
            <p className="font-medium">Legend State Features:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Data sourced from <code>getEntity$('task')</code> observable</li>
              <li>View state (sorting, filtering) stored in Legend State</li>
              <li>Automatic persistence via Legend State</li>
              <li>Real-time updates via WebSocket notifications</li>
              <li><strong>NEW:</strong> onSave connected to Legend State mutations</li>
              <li><strong>NEW:</strong> Batch operations for multi-copy/drag</li>
            </ul>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-2">Test Operations</h3>
            <div className="space-y-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full"
                onClick={() => logOperation('Manual test: Create new task')}
              >
                Create New Task
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full"
                onClick={() => logOperation('Manual test: Copy selected rows')}
              >
                Copy Selected Rows
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full"
                onClick={() => logOperation('Manual test: Batch update')}
              >
                Batch Update
              </Button>
            </div>
          </div>
          
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-2">Operation Log</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {operationLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">No operations yet</p>
              ) : (
                operationLog.map((op, i) => (
                  <div key={i} className="text-xs font-mono bg-muted p-2 rounded">
                    {op}
                  </div>
                ))
              )}
            </div>
            <Button 
              size="sm" 
              variant="ghost" 
              className="w-full mt-2"
              onClick={() => setOperationLog([])}
            >
              Clear Log
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}