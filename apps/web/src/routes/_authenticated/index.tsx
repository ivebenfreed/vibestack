import { createFileRoute } from '@tanstack/react-router'
import Dashboard from '@/features/dashboard'
import { ensureAllDomainsLoaded } from '@/domain/ensure-loaded'

export const Route = createFileRoute('/_authenticated/')({
  loader: async () => {
    // Super fast path - completely skip if all data is loaded
    // This makes subsequent navigations instant
    await ensureAllDomainsLoaded() // This returns immediately if data exists
    
    return null
  },
  component: Dashboard,
})
