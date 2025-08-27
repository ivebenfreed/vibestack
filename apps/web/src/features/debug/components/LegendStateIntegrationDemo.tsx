/**
 * VibeGrid with Legend State Integration
 * Using the actual VibeGrid table component with Legend State
 */

import React from 'react'
import { VibeGrid } from '@/components/custom/vibegrid'
import { Badge } from '@/components/ui/badge'
import { usePrecomputedEntityColumns } from '@/legend-state/hooks/use-precomputed-entity-columns'
import { entityOperations } from '@/legend-state'

export function LegendStateIntegrationDemo() {
  const { columns, isLoading, error } = usePrecomputedEntityColumns('Client')
  
  console.log('[LegendStateIntegrationDemo] Precomputed columns:', { 
    columns, 
    isLoading, 
    error, 
    referenceColumns: columns.filter(col => col.cellType?.startsWith('reference')).length,
    totalColumns: columns.length
  })

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
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-lg font-semibold">Loading schema...</div>
              <div className="text-sm text-muted-foreground">Generating dynamic columns</div>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-red-600">
              <div className="text-lg font-semibold">Schema Error</div>
              <div className="text-sm">{error}</div>
            </div>
          </div>
        ) : columns.length > 0 ? (
          <VibeGrid
            entityType="Client"
            columns={columns}
            tableId="debug-clients-table"
            className="h-full"
            onEntityUpdate={async (rowId: string, updates: Record<string, any>) => {
              console.log('🔄 LegendStateIntegrationDemo: Entity update requested', { rowId, updates });
              try {
                await entityOperations.updateEntity('Client', rowId, updates);
                console.log('✅ LegendStateIntegrationDemo: Entity updated successfully', { rowId, updates });
              } catch (error) {
                console.error('❌ LegendStateIntegrationDemo: Entity update failed', { rowId, updates, error });
                throw error;
              }
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <div className="text-lg font-semibold">No Columns</div>
              <div className="text-sm">No schema fields found for Client entity</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}