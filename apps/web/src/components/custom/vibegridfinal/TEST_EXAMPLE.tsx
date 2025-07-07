/**
 * TEST EXAMPLE - VibeGridFinal Verification
 * 
 * Quick test to verify all Phase 2.5 fixes work correctly:
 * ✅ Badge components from shadcn
 * ✅ Select components from shadcn  
 * ✅ BaseEntity types from original
 * ✅ Complete enum dropdown functionality
 */

import React from 'react'
import { VibeGridFinal } from './core/VibeGridFinal'
import type { BaseEntity } from './types'

// Test data matching original BaseEntity
interface TestEntity extends BaseEntity {
  id: string
  name: string
  status: 'active' | 'pending' | 'completed'
  priority: 'low' | 'medium' | 'high'
  count: number
  isEnabled: boolean
  createdAt: string
}

const testData: TestEntity[] = [
  {
    id: '1',
    name: 'Test Item 1',
    status: 'active',
    priority: 'high',
    count: 42,
    isEnabled: true,
    createdAt: '2024-01-01'
  },
  {
    id: '2', 
    name: 'Test Item 2',
    status: 'pending',
    priority: 'medium',
    count: 15,
    isEnabled: false,
    createdAt: '2024-01-02'
  }
]

const testColumns: any[] = [
  {
    id: 'name',
    accessorKey: 'name' as keyof TestEntity,
    header: 'Name',
    meta: {
      cellType: 'text' as const,
      config: { editable: true }
    }
  },
  {
    id: 'status',
    accessorKey: 'status' as keyof TestEntity,
    header: 'Status',
    meta: {
      cellType: 'enum' as const,
      config: {
        editable: true,
        enumValues: {
          active: 'Active',
          pending: 'Pending', 
          completed: 'Completed'
        }
      }
    }
  },
  {
    id: 'priority',
    accessorKey: 'priority' as keyof TestEntity,
    header: 'Priority',
    meta: {
      cellType: 'enum' as const,
      config: {
        editable: true,
        enumValues: {
          low: 'Low Priority',
          medium: 'Medium Priority',
          high: 'High Priority'
        }
      }
    }
  },
  {
    id: 'count',
    accessorKey: 'count' as keyof TestEntity,
    header: 'Count',
    meta: {
      cellType: 'number' as const,
      config: { editable: true }
    }
  },
  {
    id: 'isEnabled',
    accessorKey: 'isEnabled' as keyof TestEntity,
    header: 'Enabled',
    meta: {
      cellType: 'boolean' as const,
      config: { editable: true }
    }
  }
]

export const TestVibeGridFinal: React.FC = () => {
  const handleSave = React.useCallback(async (entityId: string, columnId: string, value: any) => {
    console.log('🔥 TEST SAVE:', { entityId, columnId, value })
    // Simulated save with delay
    await new Promise(resolve => setTimeout(resolve, 100))
  }, [])

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">🧪 VibeGridFinal Test</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Testing Phase 2.5 fixes: Badge, Select, BaseEntity, Enum dropdown
      </p>
      
      <VibeGridFinal
        data={testData}
        columns={testColumns}
        onSave={handleSave}
        enableSorting={true}
        enablePagination={true}
        enableGlobalSearch={true}
        enableHorizontalScrolling={true}
        debugMode={true}
        className="border rounded-lg"
      />
      
      <div className="mt-4 text-sm text-muted-foreground">
        <h3 className="font-semibold">Test Features:</h3>
        <ul className="list-disc list-inside mt-2">
          <li>✅ Click on Status/Priority cells to test enum dropdowns</li>
          <li>✅ Use arrow keys for keyboard navigation in dropdowns</li>
          <li>✅ Test boolean toggle (Enabled column)</li>
          <li>✅ Test number editing (Count column)</li>
          <li>✅ Test global search functionality</li>
          <li>✅ Test page size selection with shadcn Select</li>
        </ul>
      </div>
    </div>
  )
} 