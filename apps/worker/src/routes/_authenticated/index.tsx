import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/')({
  beforeLoad: async () => {
    // Redirect authenticated users to the universe dashboard
    throw redirect({
      to: '/universe'
    })
  },
})
