import { createFileRoute } from '@tanstack/react-router'
// import Dashboard from '@/features/dashboard' // Old atom-based dashboard
import Dashboard from '@/features/dashboard/index-dexie' // New Dexie-based dashboard
import { ensureAllDomainsLoaded } from '@/domain/ensure-loaded'

export const Route = createFileRoute('/_authenticated/')({
  loader: async () => {
    // Data loading handled by components with Dexie
    console.log('[Dashboard] Using Dexie for data loading');
    return null
  },
  component: Dashboard,
})
