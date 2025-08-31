import { createFileRoute } from '@tanstack/react-router'

const TimelinePlaceholder = () => (
  <div className="flex items-center justify-center h-96">
    <div className="text-center">
      <div className="text-xl font-semibold mb-4">Timeline View</div>
      <p className="text-muted-foreground">Coming soon - timeline component is being updated</p>
    </div>
  </div>
)

export const Route = createFileRoute('/_authenticated/tasks/timeline')({
  component: TimelinePlaceholder,
})