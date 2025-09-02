import { createFileRoute } from '@tanstack/react-router'
import Dashboard from '@/features/dashboard'
import { z } from 'zod'

const orgDashboardRouteSchema = z.object({
  orgId: z.string()
})

export const Route = createFileRoute('/_authenticated/org/$orgId/dashboard')({
  params: {
    parse: (params) => orgDashboardRouteSchema.parse(params),
    stringify: ({ orgId }) => ({ orgId })
  },
  loader: async ({ params }) => {
    // Organization ID is available in params.orgId
    // Data loading will be handled by Dashboard component based on URL params
    return { organizationId: params.orgId }
  },
  component: OrganizationDashboard,
})

function OrganizationDashboard() {
  return <Dashboard />
}