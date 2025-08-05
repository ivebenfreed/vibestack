import { createFileRoute } from '@tanstack/react-router'
// import Dashboard from '@/features/dashboard' // Old atom-based dashboard
import Dashboard from '@/features/dashboard/index-dexie' // New Dexie-based dashboard
import { ensureAllDomainsLoaded } from '@/domain/ensure-loaded'

export const Route = createFileRoute('/_authenticated/')({
  loader: async () => {
    // DISABLED: TypeORM removal - ensureAllDomainsLoaded triggers PGLite initialization
    // Super fast path - completely skip if all data is loaded
    // This makes subsequent navigations instant
    // await ensureAllDomainsLoaded() // This returns immediately if data exists
    
    console.log('[Dashboard] Skipping domain loading - TypeORM disabled');
    return null
  },
  component: Dashboard,
})
