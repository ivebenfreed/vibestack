import { createFileRoute } from '@tanstack/react-router'
import { VibeGridTasksExample } from '@/features/debug/components/VibeGridTasksExample'

// Simple test component to isolate the issue
function TestComponent() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Test Route - With VibeGridTasksExample Import</h1>
      <p>If you can see this, the VibeGridTasksExample import is working correctly.</p>
      <p>Note: We're not rendering the component yet, just importing it.</p>
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/debug/vibegrid-tasks')({
  component: VibeGridTasksExample,
}) 