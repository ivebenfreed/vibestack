import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import React from 'react'

console.log('[WARM-START-PERF] ⏱️ dashboard route importing Dashboard at:', performance.now().toFixed(2) + 'ms');
// Direct import - dashboard is core route, load it immediately
import Dashboard from '@/features/dashboard'
console.log('[WARM-START-PERF] ⏱️ dashboard route Dashboard import DONE at:', performance.now().toFixed(2) + 'ms');

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
  React.useEffect(() => {
    console.log('[WARM-START-PERF] ⏱️ OrganizationDashboard component mounted at:', performance.now().toFixed(2) + 'ms');
  }, []);

  return <Dashboard />
}