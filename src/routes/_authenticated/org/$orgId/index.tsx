import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

const orgIndexRouteSchema = z.object({
  orgId: z.string()
})

export const Route = createFileRoute('/_authenticated/org/$orgId/')({
  params: {
    parse: (params) => orgIndexRouteSchema.parse(params),
    stringify: ({ orgId }) => ({ orgId })
  },
  loader: async ({ params }) => {
    // Redirect to dashboard subroute
    throw redirect({
      to: '/org/$orgId/dashboard',
      params: { orgId: params.orgId }
    })
  },
})