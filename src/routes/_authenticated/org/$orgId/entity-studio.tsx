import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import React from 'react'

// ⚡ PERFORMANCE: Lazy load Entity Studio to reduce initial bundle size
const EntityStudio = React.lazy(() => import('@/features/entity-studio'))

const entityStudioRouteSchema = z.object({
  orgId: z.string()
})

export const Route = createFileRoute('/_authenticated/org/$orgId/entity-studio')({
  params: {
    parse: (params) => entityStudioRouteSchema.parse(params),
    stringify: ({ orgId }) => ({ orgId })
  },
  loader: ({ params }) => {
    // ⚡ PERFORMANCE: Make loader synchronous to eliminate async overhead
    // Data loading will be handled by EntityStudio component based on URL params
    return { organizationId: params.orgId }
  },
  component: EntityStudioPage,
})

function EntityStudioPage() {
  return (
    <React.Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading Entity Studio...</p>
        </div>
      </div>
    }>
      <EntityStudio />
    </React.Suspense>
  )
}
