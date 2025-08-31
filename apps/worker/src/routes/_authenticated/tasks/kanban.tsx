import { createFileRoute } from '@tanstack/react-router'

const KanbanPlaceholder = () => (
  <div className="flex items-center justify-center h-96">
    <div className="text-center">
      <div className="text-xl font-semibold mb-4">Kanban Board</div>
      <p className="text-muted-foreground">Coming soon - kanban component is being updated</p>
    </div>
  </div>
)

export const Route = createFileRoute('/_authenticated/tasks/kanban')({
  loader: async () => {
    return {}
  },
  component: KanbanPlaceholder,
})