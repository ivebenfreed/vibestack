import { observer } from '@legendapp/state/react'
import { useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Users, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Team } from '@/legend-state'

export const TeamsSection = observer(function TeamsSection({ 
  teams,
  isCollapsed 
}: {
  teams: Team[]
  isCollapsed?: boolean
}) {
  const [isOpen, setIsOpen] = useState(true)
  
  if (isCollapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="w-full justify-center">
              <Users className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Teams ({teams.length})
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start px-2 py-1.5 h-auto font-normal"
        >
          <ChevronRight className={cn(
            "h-3 w-3 mr-1 transition-transform",
            isOpen && "rotate-90"
          )} />
          <Users className="h-4 w-4 mr-2" />
          <span className="flex-1 text-left font-medium">Teams</span>
          <Badge variant="secondary" className="ml-auto">
            {teams.length}
          </Badge>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-2">
        {teams.length > 0 ? (
          teams.map(team => (
            <Button
              key={team.id}
              variant="ghost"
              className="w-full justify-start px-6 py-1.5 h-auto font-normal text-xs"
            >
              <div className="flex items-center w-full">
                <span className="flex-1 text-left">{team.name}</span>
                {team.member_count && (
                  <Badge variant="outline" className="ml-auto text-xs">
                    {team.member_count}
                  </Badge>
                )}
              </div>
            </Button>
          ))
        ) : (
          <div className="text-xs text-muted-foreground px-6 py-2">
            No teams yet
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
})