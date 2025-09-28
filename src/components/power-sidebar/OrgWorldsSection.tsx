import { observer } from '@legendapp/state/react'
import { useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { User, Building, ChevronRight, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorldFolder } from './WorldFolder'
import type { OrganizationContext } from '@/legend-state'

interface OrgWorldsSectionProps {
  organization: OrganizationContext
  isCollapsed?: boolean
}

export const OrgWorldsSection = observer(function OrgWorldsSection({ 
  organization,
  isCollapsed 
}: OrgWorldsSectionProps) {
  const [isPersonalOpen, setIsPersonalOpen] = useState(true)
  const [isBusinessOpen, setIsBusinessOpen] = useState(true)
  const [isTeamsOpen, setIsTeamsOpen] = useState(true)
  
  const { personalWorlds = [], businessWorlds = [], teams = [] } = organization
  const isPersonalOrg = organization?.info?.type === 'personal'
  
  if (isCollapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="w-full justify-center">
              {isPersonalOrg ? <User className="h-4 w-4" /> : <Building className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {organization?.info?.name} ({personalWorlds.length + businessWorlds.length} worlds)
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
  
  return (
    <div className="space-y-2">
      {/* Personal Worlds in this Organization */}
      {personalWorlds.length > 0 && (
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
              <span className="flex-1 text-left font-medium">
                {isPersonalOrg ? 'My Worlds' : 'Personal Worlds'}
              </span>
              <Badge variant="secondary" className="ml-auto">
                {personalWorlds.length}
              </Badge>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="ml-2">
            {personalWorlds.map(world => (
              <WorldFolder 
                key={world?.id}
                world={world}
                isPersonal={true}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Business Worlds in this Organization */}
      {businessWorlds.length > 0 && (
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
                {businessWorlds.length}
              </Badge>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="ml-2">
            {businessWorlds.map(world => (
              <div key={world?.id} className="space-y-1">
                <WorldFolder 
                  world={world}
                  isPersonal={false}
                />
                {world?.team_name && (
                  <div className="px-6 text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {world?.team_name}
                  </div>
                )}
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Teams in this Organization */}
      {teams.length > 0 && (
        <Collapsible open={isTeamsOpen} onOpenChange={setIsTeamsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start px-2 py-1.5 h-auto font-normal"
            >
              <ChevronRight className={cn(
                "h-3 w-3 mr-1 transition-transform",
                isTeamsOpen && "rotate-90"
              )} />
              <Users className="h-4 w-4 mr-2" />
              <span className="flex-1 text-left font-medium">Teams</span>
              <Badge variant="secondary" className="ml-auto">
                {teams.length}
              </Badge>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="ml-2">
            {teams.map(team => (
              <Button
                key={team.team_id}
                variant="ghost"
                className="w-full justify-start px-6 py-1.5 h-auto font-normal text-xs"
              >
                <Users className="h-3 w-3 mr-2" />
                <div className="flex flex-col items-start flex-1">
                  <span className="font-medium">{team?.team_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {team?.team_role} • {team?.team_type}
                  </span>
                </div>
              </Button>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Empty State */}
      {personalWorlds.length === 0 && businessWorlds.length === 0 && (
        <div className="text-xs text-muted-foreground px-6 py-2">
          No worlds in this organization yet
        </div>
      )}
    </div>
  )
})