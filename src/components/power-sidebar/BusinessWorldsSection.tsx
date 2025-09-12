import { observer } from '@legendapp/state/react'
import { useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Building2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorldFolder } from './WorldFolder'

interface WorldData {
  id: string
  name: string
  description?: string
  universe_id?: string
  state: 'exploring' | 'developing' | 'active' | 'paused' | 'archived'
  world_type: 'personal' | 'business' | 'client' | 'department' | 'project_domain'
  priority: 'low' | 'medium' | 'high' | 'critical'
}

export const BusinessWorldsSection = observer(function BusinessWorldsSection({ 
  worlds,
  isCollapsed 
}: {
  worlds: WorldData[]
  isCollapsed?: boolean
}) {
  const [isOpen, setIsOpen] = useState(true)
  
  if (isCollapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="w-full justify-center">
              <Building2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Business Worlds ({worlds.length})
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
          <Building2 className="h-4 w-4 mr-2" />
          <span className="flex-1 text-left font-medium">Business Worlds</span>
          <Badge variant="secondary" className="ml-auto">
            {worlds.length}
          </Badge>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-2">
        {worlds.length > 0 ? (
          worlds.map(world => (
            <WorldFolder 
              key={world.id} 
              world={world}
              isPersonal={false}
            />
          ))
        ) : (
          <div className="text-xs text-muted-foreground px-6 py-2">
            No business worlds yet
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
})