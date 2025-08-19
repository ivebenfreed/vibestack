import { createFileRoute } from '@tanstack/react-router'
import Dashboard from '@/features/dashboard' // Main dashboard

export const Route = createFileRoute('/_authenticated/')({
  loader: async () => {
    // Data loading handled by components
    return null
  },
  component: Dashboard,
})
