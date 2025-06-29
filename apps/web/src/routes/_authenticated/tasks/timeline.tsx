import { createFileRoute } from '@tanstack/react-router'
import { ReactFlowProvider } from '@xyflow/react'
import { TasksTimeline } from '@/features/tasks/timeline/TasksTimeline'

export const Route = createFileRoute('/_authenticated/tasks/timeline')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="flex flex-col h-full">
      <ReactFlowProvider>
        <TasksTimeline />
      </ReactFlowProvider>
    </div>
  )
}