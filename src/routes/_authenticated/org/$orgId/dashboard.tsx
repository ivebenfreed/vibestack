import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import React from 'react'
import Dashboard from '@/features/dashboard'

const orgDashboardRouteSchema = z.object({
  orgId: z.string()
})

export const Route = createFileRoute('/_authenticated/org/$orgId/dashboard')({
  params: {
    parse: (params) => orgDashboardRouteSchema.parse(params),
    stringify: ({ orgId }) => ({ orgId })
  },
  loader: ({ params }) => {
    return { organizationId: params.orgId }
  },
  component: Dashboard,
})