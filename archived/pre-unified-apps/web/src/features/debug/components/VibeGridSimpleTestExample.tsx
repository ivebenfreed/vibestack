/**
 * VibeGrid Simple Test Example - Performance Comparison
 * 
 * Tests the TanStack-native approach vs the current XState-heavy approach
 * ✅ Instant sorting/pagination
 * ✅ Persistent preferences per table
 * ✅ No XState overhead for basic operations
 */

import React from 'react'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { VibeGridSimpleTest } from '@/components/custom/vibegrid/components/VibeGridSimpleTest'

// Use Task type for testing
interface Task {
  id: string
  title: string
  status: 'open' | 'in_progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
  assigneeId?: string
  projectId?: string
  dueDate?: string
  createdAt: string
}

// Create sample data
const generateSampleTasks = (count: number): Task[] => {
  const statuses: Task['status'][] = ['open', 'in_progress', 'completed']
  const priorities: Task['priority'][] = ['low', 'medium', 'high']
  
  return Array.from({ length: count }, (_, i) => ({
    id: `task-${i + 1}`,
    title: `Task ${i + 1}: ${['Fix bug in', 'Implement feature for', 'Review code for', 'Update documentation for', 'Test integration with'][i % 5]} ${['user auth', 'dashboard', 'data sync', 'notifications', 'reporting'][Math.floor(i / 5) % 5]}`,
    status: statuses[i % statuses.length],
    priority: priorities[i % priorities.length],
    assigneeId: `user-${(i % 3) + 1}`,
    projectId: `project-${(i % 2) + 1}`,
    dueDate: new Date(Date.now() + (i * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
    createdAt: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString(),
  }))
}

// ============================================================================
// Column Definitions
// ============================================================================

const columnHelper = createColumnHelper<Task>()

const taskColumns: ColumnDef<Task>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    size: 100,
    cell: ({ getValue }) => (
      <code className="text-xs bg-muted px-1 py-0.5 rounded">
        {getValue() as string}
      </code>
    ),
  },
  
  {
    accessorKey: 'title',
    header: 'Title',
    size: 300,
    cell: ({ getValue }) => (
      <div className="font-medium">
        {getValue() as string}
      </div>
    ),
  },
  
  {
    accessorKey: 'status',
    header: 'Status',
    size: 120,
    cell: ({ getValue }) => {
      const status = getValue() as Task['status']
      const statusColors = {
        open: 'bg-gray-100 text-gray-800 border-gray-300',
        in_progress: 'bg-blue-100 text-blue-800 border-blue-300',
        completed: 'bg-green-100 text-green-800 border-green-300',
      }
      
      return (
        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border ${statusColors[status]}`}>
          {status.replace('_', ' ')}
        </span>
      )
    },
  },
  
  {
    accessorKey: 'priority',
    header: 'Priority',
    size: 100,
    cell: ({ getValue }) => {
      const priority = getValue() as Task['priority']
      const priorityColors = {
        low: 'text-gray-600',
        medium: 'text-yellow-600',
        high: 'text-red-600',
      }
      
      return (
        <span className={`font-medium ${priorityColors[priority]}`}>
          {priority}
        </span>
      )
    },
  },
  
  {
    accessorKey: 'dueDate',
    header: 'Due Date',
    size: 120,
    cell: ({ getValue }) => {
      const date = getValue() as string | undefined
      return date ? new Date(date).toLocaleDateString() : '—'
    },
  },
  
  {
    accessorKey: 'createdAt',
    header: 'Created',
    size: 120,
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString(),
  },
]

// ============================================================================
// Test Component
// ============================================================================

export function VibeGridSimpleTestExample() {
  // Generate different sized datasets for performance testing
  const smallData = generateSampleTasks(25)
  const mediumData = generateSampleTasks(100)
  const largeData = generateSampleTasks(500)
  
  return (
    <div className="space-y-8 p-6">
      
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">VibeGrid Architecture Test</h1>
        <p className="text-muted-foreground">
          Comparing TanStack-native approach vs current XState-heavy implementation
        </p>
        
        <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="text-yellow-800 dark:text-yellow-200 font-medium mb-2">
            🧪 Performance Test Instructions
          </div>
          <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
            <li>• Try sorting different columns - should be <strong>instant</strong></li>
            <li>• Change page size - should be <strong>instant</strong></li>
            <li>• Navigate pages - should be <strong>instant</strong></li>
            <li>• Preferences auto-save to localStorage and persist across refreshes</li>
            <li>• Open DevTools Performance tab to measure render times</li>
          </ul>
        </div>
      </div>
      
      {/* Small Dataset Test */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Small Dataset (25 rows)</h2>
        <VibeGridSimpleTest
          data={smallData}
          columns={taskColumns}
          tableId="tasks-small"
          title="Tasks Table - Small Dataset"
        />
      </div>
      
      {/* Medium Dataset Test */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Medium Dataset (100 rows)</h2>
        <VibeGridSimpleTest
          data={mediumData}
          columns={taskColumns}
          tableId="tasks-medium"
          title="Tasks Table - Medium Dataset"
        />
      </div>
      
      {/* Large Dataset Test */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Large Dataset (500 rows)</h2>
        <VibeGridSimpleTest
          data={largeData}
          columns={taskColumns}
          tableId="tasks-large"
          title="Tasks Table - Large Dataset"
        />
      </div>
      
      {/* Architecture Comparison */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
          <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
            ❌ Current XState-Heavy Approach
          </h3>
          <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
            <li>• 521 lines in tableOrchestrator.ts</li>
            <li>• 428 lines in tableStateManager.ts</li>
            <li>• Every sort/filter triggers XState transition</li>
            <li>• Complex state synchronization</li>
            <li>• ~50ms delay on interactions</li>
            <li>• Fighting TanStack's native optimizations</li>
          </ul>
        </div>
        
        <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
          <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">
            ✅ New TanStack-Native Approach
          </h3>
          <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
            <li>• ~150 lines total (simple component)</li>
            <li>• TanStack manages all its own state</li>
            <li>• Instant interactions (no delays)</li>
            <li>• Simple localStorage persistence</li>
            <li>• Native TanStack optimizations work</li>
            <li>• Easy to understand and maintain</li>
          </ul>
        </div>
      </div>
      
      {/* Next Steps */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
          🎯 Next Steps for Migration
        </h3>
        <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside">
          <li>Validate this approach meets performance requirements</li>
          <li>Add minimal XState machine for persistence (if needed)</li>
          <li>Integrate with existing cell components</li>
          <li>Add event bus for domain operations (save/create/delete)</li>
          <li>Create drop-in replacement for current VibeGrid</li>
          <li>Gradual migration across different entity types</li>
        </ol>
      </div>
    </div>
  )
} 