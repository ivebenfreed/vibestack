import { observer } from '@legendapp/state/react'
import { use$ } from '@legendapp/state/react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Building, Crown, Shield, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UniverseHeader } from './UniverseHeader'
import { PersonalSection } from './PersonalSection'
import { EntitiesSection } from './EntitiesSection'
import { QuickLinks } from './QuickLinks'
import { allPersonalWorlds$, currentOrganizations$, universeHelpers } from '@/legend-state'
import type { OrganizationContext } from '@/legend-state'

function getRoleIcon(role: string) {
  switch (role) {
    case 'owner':
      return <Crown className="h-3 w-3" />
    case 'admin':
      return <Shield className="h-3 w-3" />
    case 'manager':
      return <User className="h-3 w-3" />
    default:
      return <User className="h-3 w-3" />
  }
}

function getRoleColor(role: string) {
  switch (role) {
    case 'owner':
      return 'text-yellow-600'
    case 'admin':
      return 'text-red-600'
    case 'manager':
      return 'text-blue-600'
    default:
      return 'text-gray-600'
  }
}

export const PowerSidebar = observer(function PowerSidebar({ isCollapsed }: { isCollapsed?: boolean }) {
  const personalWorlds = use$(allPersonalWorlds$)
  const organizations = use$(currentOrganizations$)
  const summary = universeHelpers.getSummary()
  
  // Show loading state if data isn't ready
  if (!universeHelpers.isLoaded()) {
    return <div className="p-4 text-sm text-muted-foreground">Loading universe...</div>
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Universe Header */}
      <div className="flex-shrink-0">
        <UniverseHeader 
          totalPersonalWorlds={summary.totalPersonalWorlds}
          totalOrganizations={summary.totalOrganizations}
          isCollapsed={isCollapsed}
        />
      </div>
      
      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="px-3 py-2 space-y-4">
          <QuickLinks isCollapsed={isCollapsed} />
          
          {/* Personal Section */}
          {personalWorlds.length > 0 && (
            <>
              <Separator className="my-2" />
              <PersonalSection 
                personalWorlds={personalWorlds}
                isCollapsed={isCollapsed}
              />
            </>
          )}
          
          {/* Organizations as Top-Level Items */}
          {organizations.length > 0 && (
            <>
              <Separator className="my-2" />
              {organizations.map(org => (
                isCollapsed ? (
                  <TooltipProvider key={org.info.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="w-full justify-center">
                          <Building className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {org.info.name} ({org.info.role})
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <Button
                    key={org.info.id}
                    variant="ghost"
                    className="w-full justify-start px-2 py-1.5 h-auto font-normal"
                  >
                    <Building className="h-4 w-4 mr-2" />
                    <span className="flex-1 text-left font-medium">{org.info.name}</span>
                    <div className="flex items-center gap-1 ml-auto">
                      <div className={cn("flex items-center", getRoleColor(org.info.role))}>
                        {getRoleIcon(org.info.role)}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {(org.businessWorlds?.length || 0) + (org.personalWorlds?.length || 0)}
                      </Badge>
                    </div>
                  </Button>
                )
              ))}
            </>
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