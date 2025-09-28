import { createFileRoute, useNavigate } from '@tanstack/react-router'
import * as React from 'react'

export const Route = createFileRoute('/_authenticated/')({
  component: AuthenticatedIndexHandler,
})

function AuthenticatedIndexHandler() {
  const navigate = useNavigate()

  React.useEffect(() => {
    // Check for last selected organization in localStorage (client-side only)
    try {
      const lastOrgId = localStorage.getItem('lastSelectedOrganization')
      if (lastOrgId) {
        // Redirect to last selected organization
        navigate({
          to: '/org/$orgId/dashboard',
          params: { orgId: lastOrgId },
          replace: true
        })
        return
      }
    } catch (error) {
      console.warn('Failed to read organization preference:', error)
    }

    // No stored org preference - redirect to organization selection screen
    navigate({
      to: '/choose-organization',
      replace: true
    })
  }, [navigate])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  )
}
