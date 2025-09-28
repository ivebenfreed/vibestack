import { observer } from '@legendapp/state/react'
import { use$ } from '@legendapp/state/react'
import { useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { OrgContextHeader } from './OrgContextHeader'
import { UniverseWorldsSection } from './UniverseWorldsSection'
import { OrgWorldsSection } from './OrgWorldsSection'
import { EntitiesSection } from './EntitiesSection'
import { QuickLinks } from './QuickLinks'
import { currentOrganizations$, universeHelpers } from '@/legend-state'
import type { OrganizationContext } from '@/legend-state'

export const UnifiedPowerSidebar = observer(function UnifiedPowerSidebar({ 
  isCollapsed 
}: { 
  isCollapsed?: boolean 
}) {
  const organizations = use$(currentOrganizations$)
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null) // null = universe view

  // App initialization phases handle all loading - sidebar should always render

  // Get the currently selected organization
  const currentOrg = selectedOrgId
    ? organizations?.find(org => org?.info?.id === selectedOrgId) || null
    : null

  const handleOrgSelect = (orgId: string | null) => {
    setSelectedOrgId(orgId)
  }

  const isUniverseView = selectedOrgId === null
  
  return (
    <div className="flex flex-col h-full">
      {/* Organization Context Header with Breadcrumb */}
      <div className="flex-shrink-0">
        <OrgContextHeader
          currentOrg={currentOrg}
          organizations={organizations}
          onOrgSelect={handleOrgSelect}
          showUniverseView={true}
          isCollapsed={isCollapsed}
        />
      </div>
      
      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="px-3 py-2 space-y-4">
          <QuickLinks isCollapsed={isCollapsed} />
          
          <Separator className="my-2" />
          
          {/* Context-Specific Content */}
          {isUniverseView ? (
            /* Universe View: Show aggregated data across all organizations */
            <UniverseWorldsSection 
              organizations={organizations}
              isCollapsed={isCollapsed}
            />
          ) : currentOrg ? (
            /* Organization View: Show specific organization content */
            <OrgWorldsSection 
              organization={currentOrg}
              isCollapsed={isCollapsed}
            />
          ) : (
            /* Fallback */
            <div className="text-xs text-muted-foreground px-6 py-2">
              Select an organization to view its content
            </div>
          )}
          
          <Separator className="my-2" />
          <EntitiesSection 
            isCollapsed={isCollapsed}
          />
        </div>
      </ScrollArea>
    </div>
  )
})