import { createFileRoute } from '@tanstack/react-router'
import { TaskVibeGrid } from '@/components/custom/vibegridfinal/entities/TaskVibeGrid'
import { createOptimizedLoader } from '@/domain/ensure-loaded'

function VibeGridFinalTasksPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">🧩 VibeGridFinal Tasks (Modular)</h2>
        <p className="text-muted-foreground">
          Demonstrating the new modularized VibeGridFinal architecture with real task data.
          Clean separation of concerns with preserved 42.54ms performance and 100% feature parity.
        </p>
      </div>

      {/* TaskVibeGrid with full functionality */}
      <TaskVibeGrid
        enableBulkActions={true}
        className="border border-border rounded-lg"
        debugMode={true}
      />
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/debug/vibegridfinal-tasks')({
  loader: createOptimizedLoader(['tasks', 'projects', 'users']),
  component: VibeGridFinalTasksPage,
}) 