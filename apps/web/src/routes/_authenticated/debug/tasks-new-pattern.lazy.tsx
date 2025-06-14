import { createLazyFileRoute } from '@tanstack/react-router'
import TasksNewPattern from '@/features/tasks/pages/tasks-new-pattern'

export const Route = createLazyFileRoute('/_authenticated/debug/tasks-new-pattern')({
  component: TasksNewPattern,
}) 