/**
 * Organization Selection Screen
 *
 * Shown to first-time users who need to choose their organization.
 * Stores the selection in localStorage for future sessions.
 */

import { useNavigate } from '@tanstack/react-router'
import { useUnifiedAuth } from '@/legend-state/hooks/use-unified-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building, Users, Globe } from 'lucide-react'

export function OrganizationSelectionScreen() {
  const navigate = useNavigate()
  const { userOrganizations } = useUnifiedAuth()

  const handleSelectOrganization = (orgId: string) => {
    // Store selected org in localStorage
    try {
      localStorage.setItem('lastSelectedOrganization', orgId)
    } catch (error) {
      console.warn('Failed to store organization preference:', error)
    }

    // Navigate to the selected organization
    navigate({
      to: '/org/$orgId/dashboard',
      params: { orgId }
    })
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Choose Your Organization</h1>
          <p className="text-muted-foreground">
            Select the organization you'd like to work with. You can change this anytime.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {userOrganizations?.map(org => (
            <Card
              key={org?.id || 'unknown'}
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => org?.id && handleSelectOrganization(org.id)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Building className="h-5 w-5" />
                  {org?.name}
                </CardTitle>
                <CardDescription>
                  {org?.role} • {org?.domain || 'Organization'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation()
                    org?.id && handleSelectOrganization(org.id)
                  }}
                >
                  Enter Organization
                </Button>
              </CardContent>
            </Card>
          )) || []}
        </div>

        {userOrganizations?.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Organizations Found</h3>
              <p className="text-muted-foreground mb-4">
                You don't have access to any organizations yet.
              </p>
              <Button variant="outline">
                Contact Support
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}