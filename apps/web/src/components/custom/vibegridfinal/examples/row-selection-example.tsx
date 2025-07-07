/**
 * Row Selection Example for VibeGridFinal
 * 
 * Demonstrates how to use the native TanStack row selection feature
 */

import React from 'react'
import { VibeGridFinal } from '../core/VibeGridFinal'
import type { ColumnDef } from '@tanstack/react-table'

// Example entity type
interface ExampleEntity {
  id: string
  name: string
  email: string
  status: 'active' | 'inactive'
  createdAt: string
}

// Example data
const exampleData: ExampleEntity[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    status: 'active',
    createdAt: '2024-01-01'
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    status: 'inactive',
    createdAt: '2024-01-02'
  },
  // Add more example data as needed
]

// Example columns
const exampleColumns: ColumnDef<ExampleEntity>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
  {
    accessorKey: 'status',
    header: 'Status',
  },
  {
    accessorKey: 'createdAt',
    header: 'Created At',
  },
]

export function RowSelectionExample() {
  // Handle bulk actions
  const handleBulkAction = async (selectedIds: string[], action: string) => {
    console.log(`Performing ${action} on selected items:`, selectedIds)
    
    switch (action) {
      case 'delete':
        // Implement bulk delete logic
        console.log('Bulk deleting:', selectedIds)
        break
      case 'edit':
        // Implement bulk edit logic
        console.log('Bulk editing:', selectedIds)
        break
      default:
        console.log('Unknown action:', action)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Row Selection Example</h1>
      
      <VibeGridFinal
        data={exampleData}
        columns={exampleColumns}
        enableRowSelection={true}
        onBulkAction={handleBulkAction}
        enableGlobalSearch={true}
        enableSorting={true}
        enablePagination={true}
        tableId="row-selection-example"
        debugMode={false}
      />
    </div>
  )
}

// Alternative: External row selection state management
export function ExternalRowSelectionExample() {
  const [rowSelection, setRowSelection] = React.useState({})

  const handleBulkAction = async (selectedIds: string[], action: string) => {
    console.log(`External state - ${action} on:`, selectedIds)
    
    // Clear selection after action
    setRowSelection({})
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">External Row Selection State</h1>
      
      <div className="mb-4 text-sm text-muted-foreground">
        Selected: {Object.keys(rowSelection).filter(key => rowSelection[key as keyof typeof rowSelection]).length} items
      </div>
      
      <VibeGridFinal
        data={exampleData}
        columns={exampleColumns}
        enableRowSelection={true}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        onBulkAction={handleBulkAction}
        enableGlobalSearch={true}
        tableId="external-row-selection-example"
      />
    </div>
  )
} 