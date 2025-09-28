import { observer } from '@legendapp/state/react'
import { useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Globe, ChevronRight, User, Building } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorldFolder } from './WorldFolder'
import type { World, OrganizationContext } from '@/legend-state'

interface UniverseWorldsSectionProps {
  organizations: OrganizationContext[]
  isCollapsed?: boolean
}

export const UniverseWorldsSection = observer(function UniverseWorldsSection({ 
  organizations,
  isCollapsed 
}: UniverseWorldsSectionProps) {
  const [isPersonalOpen, setIsPersonalOpen] = useState(true)
  const [isBusinessOpen, setIsBusinessOpen] = useState(true)
  
  // Aggregate all worlds across organizations
  const allPersonalWorlds: (World & { orgName?: string; orgType?: string })[] = []
  const allBusinessWorlds: (World & { orgName?: string; orgType?: string })[] = []
  
  organizations.forEach(org => {
    org?.personalWorlds?.forEach(world => {
      allPersonalWorlds.push({
        ...world,
        orgName: org?.info?.name,
        orgType: org?.info?.type || 'business'
      })
    })
    org?.businessWorlds?.forEach(world => {
      allBusinessWorlds.push({
        ...world,
        orgName: org?.info?.name,
        orgType: org?.info?.type || 'business'
      })
    })
  })
  
  if (isCollapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="w-full justify-center">
              <Globe className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Universe ({allPersonalWorlds.length + allBusinessWorlds.length} worlds)
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
  
  return (
    <div className="space-y-2">
      {/* Personal Worlds Across All Organizations */}
      {allPersonalWorlds.length > 0 && (
        <Collapsible open={isPersonalOpen} onOpenChange={setIsPersonalOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start px-2 py-1.5 h-auto font-normal"
            >
              <ChevronRight className={cn(
                "h-3 w-3 mr-1 transition-transform",
                isPersonalOpen && "rotate-90"
              )} />
              <User className="h-4 w-4 mr-2" />
              <span className="flex-1 text-left font-medium">Personal Worlds</span>
              <Badge variant="secondary" className="ml-auto">
                {allPersonalWorlds.length}
              </Badge>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="ml-2">
            {allPersonalWorlds.map(world => (
              <div key={world?.id} className="space-y-1">
                <WorldFolder 
                  world={world}
                  isPersonal={true}
                />
                {world.orgName && (
                  <div className="px-6 text-xs text-muted-foreground flex items-center gap-1">
                    {world.orgType === 'personal' ? (
                      <User className="h-3 w-3" />
                    ) : (
                      <Building className="h-3 w-3" />
                    )}
                    {world.orgName}
                  </div>
                )}
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Business Worlds Across All Organizations */}
      {allBusinessWorlds.length > 0 && (
        <Collapsible open={isBusinessOpen} onOpenChange={setIsBusinessOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start px-2 py-1.5 h-auto font-normal"
            >
              <ChevronRight className={cn(
                "h-3 w-3 mr-1 transition-transform",
                isBusinessOpen && "rotate-90"
              )} />
              <Building className="h-4 w-4 mr-2" />
              <span className="flex-1 text-left font-medium">Business Worlds</span>
              <Badge variant="secondary" className="ml-auto">
                {allBusinessWorlds.length}
              </Badge>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="ml-2">
            {allBusinessWorlds.map(world => (
              <div key={world?.id} className="space-y-1">
                <WorldFolder 
                  world={world}
                  isPersonal={false}
                />
                {world.orgName && (
                  <div className="px-6 text-xs text-muted-foreground flex items-center gap-1">
                    {world.orgType === 'personal' ? (
                      <User className="h-3 w-3" />
                    ) : (
                      <Building className="h-3 w-3" />
                    )}
                    {world.orgName}
                    {world?.team_name && ` • ${world?.team_name}`}
                  </div>
                )}
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Empty State */}
      {allPersonalWorlds.length === 0 && allBusinessWorlds.length === 0 && (
        <div className="text-xs text-muted-foreground px-6 py-4 text-center">
          No worlds found across your organizations
        </div>
      )}
    </div>
  )
})