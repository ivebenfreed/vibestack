import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import React from 'react'

// ⚡ PERFORMANCE: Lazy load dashboard to reduce initial bundle size
const Dashboard = React.lazy(() => import('@/features/dashboard'))

const orgDashboardRouteSchema = z.object({
  orgId: z.string()
})

export const Route = createFileRoute('/_authenticated/org/$orgId/dashboard')({
  params: {
    parse: (params) => orgDashboardRouteSchema.parse(params),
    stringify: ({ orgId }) => ({ orgId })
  },
  loader: ({ params }) => {
    // ⚡ PERFORMANCE: Make loader synchronous to eliminate async overhead
    // Data loading will be handled by Dashboard component based on URL params
    return { organizationId: params.orgId }
  },
  component: OrganizationDashboard,
})

function OrganizationDashboard() {
  return (
    <React.Suspense fallback={<div className="flex items-center justify-center py-8">Loading dashboard...</div>}>
      <Dashboard />
    </React.Suspense>
  )
}