/**
 * VibeGridFinal Demo - Interactive testing of the new declarative data grid
 * 
 * Comprehensive demo showing all features and capabilities
 */

import { createFileRoute } from '@tanstack/react-router'
import { useSelector } from '@xstate/store/react'
import { useState } from 'react'
import { shallowEqual } from '@xstate/store'
import { tasksAtom } from '@/domain/task'
import { projectsAtom } from '@/domain/project'
import { usersAtom } from '@/domain/user'
import { VibeGridFinal } from '@/components/custom/vibegridfinal/core/VibeGridFinal'
import { createDirectUsagePattern, createSaveHandler, createBalancedSelector } from '@/components/custom/vibegridfinal/utils/DirectUsagePattern'
import type { EntityName } from '@/components/custom/vibegridfinal/core/EntityRegistry'

export const Route = createFileRoute('/_authenticated/debug/vibegridfinal-demo')({
  component: VibeGridFinalDemoPage
})

type DemoEntity = 'Task' | 'Project' | 'User'

function VibeGridFinalDemoPage() {
  const [selectedEntity, setSelectedEntity] = useState<DemoEntity>('Task')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [height, setHeight] = useState<string>('600px')

  // Get data for all entities
  const tasks = useSelector(tasksAtom, (tasksRecord) => Object.values(tasksRecord), shallowEqual)
  const projects = useSelector(projectsAtom, (projectsRecord) => Object.values(projectsRecord), shallowEqual)
  const users = useSelector(usersAtom, (usersRecord) => Object.values(usersRecord), shallowEqual)

  // Get current entity data
  const getCurrentData = () => {
    switch (selectedEntity) {
      case 'Task': return tasks
      case 'Project': return projects
      case 'User': return users
      default: return []
    }
  }

  // Create save handler for current entity
  const handleSave = createSaveHandler(selectedEntity as EntityName, async (id: string, updates) => {
    console.log(`💾 VibeGridFinal ${selectedEntity} Save:`, { id, updates })
    // In production, this would call the appropriate domain service
  })

  // Create usage pattern for current entity
  const createUsagePattern = () => {
    const useBalancedSelector = createBalancedSelector(() => {
      switch (selectedEntity) {
        case 'Task': return useSelector(tasksAtom, (record) => record, shallowEqual)
        case 'Project': return useSelector(projectsAtom, (record) => record, shallowEqual)
        case 'User': return useSelector(usersAtom, (record) => record, shallowEqual)
        default: return {}
      }
    })

    return createDirectUsagePattern({
      useBalancedSelector,
      handleSave,
      columns: [], // Auto-resolved from entity name
      relationshipData: {}, // Auto-resolved from entity name
      entityName: selectedEntity as EntityName
    })
  }

  const currentData = getCurrentData()
  const usagePattern = createUsagePattern()

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">VibeGridFinal Interactive Demo</h1>
          <p className="text-muted-foreground">
            Test the declarative data grid with different entities, themes, and configurations
          </p>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <label className="block text-sm font-medium mb-2">Entity Type</label>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value as DemoEntity)}
              className="w-full p-2 border rounded-md"
            >
              <option value="Task">Task ({tasks.length} items)</option>
              <option value="Project">Project ({projects.length} items)</option>
              <option value="User">User ({users.length} items)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Theme</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
              className="w-full p-2 border rounded-md"
            >
              <option value="light">Light Theme</option>
              <option value="dark">Dark Theme</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Height</label>
            <select
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-full p-2 border rounded-md"
            >
              <option value="400px">400px</option>
              <option value="600px">600px</option>
              <option value="800px">800px</option>
              <option value="100vh">Full Height</option>
            </select>
          </div>

          <div className="flex items-end">
            <div className="text-sm">
              <div className="font-medium">Data Count</div>
              <div className="text-muted-foreground">{currentData.length} {selectedEntity.toLowerCase()}s</div>
            </div>
          </div>
        </div>

        {/* Grid Container */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{selectedEntity} Data Grid</h2>
            <div className="text-sm text-muted-foreground">
              Declarative API: entityName="{selectedEntity}"
            </div>
          </div>

          <div className={`border rounded-lg ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
            <VibeGridFinal
              entityName={selectedEntity as EntityName}
              data={currentData}
              onSave={handleSave}
              height={height}
              theme={theme}
              className="h-full"
              __usagePattern={usagePattern}
            />
          </div>
        </div>

        {/* Feature Showcase */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold text-green-600 mb-2">✅ Declarative API</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Single entity name automatically resolves all configuration
            </p>
            <code className="text-xs bg-muted p-2 rounded block">
              entityName="{selectedEntity}"
            </code>
          </div>

          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold text-green-600 mb-2">✅ Auto-Configuration</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Columns and relationships resolved from DataForge
            </p>
            <div className="text-xs text-muted-foreground">
              No manual column configuration required
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold text-green-600 mb-2">✅ Type Safety</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Full compile-time type checking
            </p>
            <div className="text-xs text-muted-foreground">
              EntityName → EntityType validation
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold text-blue-600 mb-2">🎨 Theme Support</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Dynamic light/dark theme switching
            </p>
            <div className="text-xs text-muted-foreground">
              Current: {theme} mode
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold text-blue-600 mb-2">⚡ Performance</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Intelligent batching and virtualization
            </p>
            <div className="text-xs text-muted-foreground">
              Batch operations, clipboard support
            </div>
          </div>

          <div className="p-4 border rounded-lg">
            <h3 className="font-semibold text-blue-600 mb-2">🛡️ Production Ready</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Error boundaries and proper logging
            </p>
            <div className="text-xs text-muted-foreground">
              Zero console pollution
            </div>
          </div>
        </div>

        {/* Editor Testing */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Editor Capabilities</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            {[
              'Text Input',
              'Number Input', 
              'Boolean Select',
              'Date Picker',
              'Enum Dropdown',
              'Single Relationship',
              'Multi Relationship',
              'Read-only Fields'
            ].map(editor => (
              <div key={editor} className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded">
                <span className="text-green-600">✏️</span>
                <span className="text-green-800">{editor}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-semibold text-blue-800 mb-3">Interactive Testing Instructions</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
            <div>
              <h5 className="font-medium mb-2">Grid Operations:</h5>
              <ul className="space-y-1">
                <li>• Click cells to edit (non-system fields)</li>
                <li>• Use Tab/Enter to navigate and commit</li>
                <li>• Escape to cancel edits</li>
                <li>• Click column headers to sort</li>
              </ul>
            </div>
            <div>
              <h5 className="font-medium mb-2">Entity Switching:</h5>
              <ul className="space-y-1">
                <li>• Change entity type to see different data</li>
                <li>• Columns auto-resolve per entity</li>
                <li>• Relationships auto-configured</li>
                <li>• All editors available per column type</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}