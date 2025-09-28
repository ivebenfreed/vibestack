import { observer } from '@legendapp/state/react'
import { use$ } from '@legendapp/state/react'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { currentOrganizations$, universeHelpers } from '@/legend-state'
import { EntitiesSection } from './EntitiesSection'
import { Building2, ChevronDown, Settings, Users, CreditCard } from 'lucide-react'

export const TraditionalOrgSidebar = observer(({ isCollapsed }: { isCollapsed?: boolean }) => {
  const organizations = use$(currentOrganizations$)
  const navigate = useNavigate()

  // Get org ID from URL path - safer than useParams during initialization
  const getCurrentOrgId = () => {
    if (typeof window === 'undefined') return null
    const path = window.location.pathname
    const orgMatch = path.match(/\/org\/([^\/]+)/)
    return orgMatch ? orgMatch[1] : null
  }

  const orgId = getCurrentOrgId()
  const currentOrg = organizations.find(org => org.info.id === orgId)

  console.log('[TraditionalSidebar] Universe loaded:', universeHelpers.isLoaded())
  console.log('[TraditionalSidebar] Organizations:', organizations.length)
  console.log('[TraditionalSidebar] Current org ID:', orgId)
  console.log('[TraditionalSidebar] Current org:', currentOrg?.info?.name)

  const handleOrgChange = (newOrgId: string) => {
    navigate({
      to: '/org/$orgId/dashboard',
      params: { orgId: newOrgId }
    })
  }

  if (!universeHelpers.isLoaded()) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Loading organizations...
      </div>
    )
  }

  // If no current org, show org selector
  if (!currentOrg) {
    return (
      <div className="p-4 space-y-4">
        <div className="text-sm font-medium">Select Organization</div>
        <Select value="" onValueChange={handleOrgChange}>
          <SelectTrigger>
            <SelectValue placeholder="Choose organization..." />
          </SelectTrigger>
          <SelectContent>
            {organizations.map(org => (
              <SelectItem key={org.info.id} value={org.info.id}>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span>{org.info.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  if (isCollapsed) {
    return (
      <div className="p-2 space-y-2">
        <Building2 className="h-6 w-6 mx-auto text-primary" />
        {currentOrg && (
          <div className="text-xs text-center text-muted-foreground">
            {currentOrg.info.name.slice(0, 3)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Organization Selector */}
      <div className="p-3 border-b space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Organization</span>
        </div>

        <Select value={orgId || ''} onValueChange={handleOrgChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select organization">
              {currentOrg && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span>{currentOrg.info.name}</span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {organizations.map(org => (
              <SelectItem key={org.info.id} value={org.info.id}>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span>{org.info.name}</span>
                  </div>
                  <Badge variant="outline" className="ml-2 text-xs">
                    {org.info.type === 'personal' ? 'Personal' : 'Business'}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Badge variant="secondary" className="text-xs w-fit">
          Traditional Mode
        </Badge>
      </div>

      {/* Current Organization Info */}
      {currentOrg && (
        <div className="p-3 border-b">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Current Context</span>
              <Badge variant="outline" className="text-xs capitalize">
                {currentOrg.info.role}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Member since {new Date(currentOrg.info.joinedAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      )}

      {/* Organization Content - Only current org */}
      <ScrollArea className="flex-1">
        {currentOrg && (
          <EntitiesSection
            organizationId={currentOrg.info.id}
            isCollapsed={false}
          />
        )}
      </ScrollArea>

      {/* Organization Actions */}
      {currentOrg && ['admin', 'owner'].includes(currentOrg.info.role) && (
        <div className="p-3 border-t space-y-2">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            Organization Settings
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => navigate({
              to: '/settings/organization',
              search: { orgId: currentOrg.info.id }
            })}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => navigate({
              to: '/settings/members',
              search: { orgId: currentOrg.info.id }
            })}
          >
            <Users className="h-4 w-4 mr-2" />
            Members
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => navigate({
              to: '/settings/billing',
              search: { orgId: currentOrg.info.id }
            })}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Billing
          </Button>
        </div>
      )}
    </div>
  )
})