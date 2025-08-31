import { createLazyFileRoute } from '@tanstack/react-router'
import React from 'react'
import VibeGrid from '@/components/custom/vibegrid/VibeGrid'

export const Route = createLazyFileRoute('/_authenticated/debug/merged-table-test')({
  component: MergedTableTestPage,
})

function MergedTableTestPage() {
  // Test columns for the merged component
  const testColumns = [
    {
      id: 'id',
      field: 'id',
      title: 'ID',
      cellType: 'text' as const,
      width: 80,
      minWidth: 60,
      maxWidth: 120
    },
    {
      id: 'title',
      field: 'title', 
      title: 'Title',
      cellType: 'text' as const,
      width: 200,
      minWidth: 120,
      maxWidth: 400
    },
    {
      id: 'status',
      field: 'status',
      title: 'Status', 
      cellType: 'text' as const,
      width: 120,
      minWidth: 80,
      maxWidth: 200
    },
    {
      id: 'createdAt',
      field: 'createdAt',
      title: 'Created',
      cellType: 'date' as const,
      width: 150,
      minWidth: 120,
      maxWidth: 200
    }
  ]

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">UltraTable + VibeGrid Merge Test</h1>
        <p className="text-muted-foreground mt-2">
          Testing merged component: UltraTable data loading & rendering + VibeGrid state management
        </p>
      </div>

      <div className="space-y-6">
        {/* Legend State Mode */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Legend State Mode</h2>
          <p className="text-sm text-muted-foreground">
            Uses VibeGrid with Legend State integration - currently empty
          </p>
          <div className="border rounded-lg">
            <VibeGrid
              tableId="test-legendstate-vibegrid"
              entityType="Client"
              columns={testColumns}
              height={400}
              className="h-[400px]"
              useLegendState={true}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-muted/50 rounded-lg">
        <h3 className="font-medium mb-2">Test Instructions:</h3>
        <ul className="text-sm space-y-1 text-muted-foreground">
          <li>• Click cells to test selection in all modes</li>
          <li>• Double-click cells to test editing (UltraTable mode)</li>
          <li>• Click column headers to test sorting</li>
          <li>• Check browser console for event integration logs</li>
          <li>• Verify data loading works in UltraTable mode</li>
        </ul>
      </div>
    </div>
  )
}