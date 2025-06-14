import { createLazyFileRoute, getRouteApi } from '@tanstack/react-router'
import React from 'react'

// Import the debug page component with lazy loading
const DataTableAtomDebugPage = React.lazy(() => import('../../../features/debug/DataTableAtomPage'))

const routeApi = getRouteApi('/_authenticated/debug/data-table-atom')

function DebugDataTableAtomComponent() {
  // ✅ CORRECTED PATTERN: Component gets loader data and populates atoms
  const loaderData = routeApi.useLoaderData()
  
  console.log(`🔄 [DebugDataTableAtomComponent] Rendering with loader data:`, {
    tasksCount: loaderData.tasks.length,
    projectsCount: loaderData.projects.length,
    usersCount: loaderData.users.length
  })
  
  return (
    <div>
      <React.Suspense fallback={<div>Loading debug page...</div>}>
        <DataTableAtomDebugPage loaderData={loaderData} />
      </React.Suspense>
    </div>
  )
}

export const Route = createLazyFileRoute('/_authenticated/debug/data-table-atom')({
  component: DebugDataTableAtomComponent,
}) 