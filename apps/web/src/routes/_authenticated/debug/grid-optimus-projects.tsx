import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import { VibeGridOptimus } from '@/components/custom/vibegridoptimus/VibeGridOptimus'
import { useSelector } from '@xstate/store/react'
import { projectsAtom, updateProjectUI } from '@/domain/project'
import { shallowEqual } from '@xstate/store'
import { useTheme } from '@/context/theme-context'
import { useStableEntityArray } from '@/hooks/useStableEntityArray'

export const Route = createFileRoute('/_authenticated/debug/grid-optimus-projects')({
  component: GridOptimusProjectsPage,
})

function GridOptimusProjectsPage() {
  // Get theme and resolve 'system' to actual theme
  const { theme } = useTheme()
  const effectiveTheme = React.useMemo(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return theme
  }, [theme])

  // Use XState atoms for data with stable array
  const projects = useStableEntityArray(projectsAtom)
  
  // State management
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Debug logging
  console.log('[GridOptimus] Projects:', projects.length)
  
  // Error handling for automatic save
  const handleSaveError = React.useCallback((error: Error) => {
    console.error('❌ Failed to update project:', error)
    setError(error.message)
  }, [])

  
  // Show loading/empty state if no data
  if (projects.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">VibeGridOptimus - Declarative API Test</h1>
        <div className="border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">No projects found. Please create some projects first.</p>
          <p className="text-sm text-muted-foreground mt-2">Projects: {projects.length}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">VibeGridOptimus - Declarative API</h1>
        <p className="text-muted-foreground">
          Clean declarative API with automatic configuration • {projects.length} projects
        </p>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <div className="text-sm text-destructive">{error}</div>
        </div>
      )}

      <div className="bg-green-50 border border-green-200 rounded-lg p-4 dark:bg-green-950 dark:border-green-800">
        <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">
          🚀 Transformed VibeGridOptimus
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm text-green-700 dark:text-green-300">
          <div>
            <strong>Before:</strong> 20+ props with complex generics
            <pre className="mt-1 text-xs bg-green-100 dark:bg-green-900 p-2 rounded">
{`<VibeGridOptimus<Project>
  data={projects}
  columns={enhancedColumns}
  onUpdate={handleUpdate}
  sortColumns={sortColumns}
  onSortColumnsChange={setSortColumns}
  // ... many more props
/>`}
            </pre>
          </div>
          <div>
            <strong>After:</strong> 9 clean props with entity name
            <pre className="mt-1 text-xs bg-green-100 dark:bg-green-900 p-2 rounded">
{`<VibeGridOptimus
  entityName="Project"
  data={projects}
  onSave={handleSave}
  height="600px"
  theme="dark"
/>`}
            </pre>
          </div>
        </div>
      </div>

      <div className="h-full flex flex-col">
        <VibeGridOptimus
          entityName="Project"
          data={projects}
          height="calc(100vh - 400px)"
          theme={effectiveTheme}
          isLoading={isLoading}
          error={error}
          className="flex-1"
        />
      </div>
    </div>
  )
}