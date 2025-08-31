import { observer } from '@legendapp/state/react'
import { useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Globe, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorldFolder } from './WorldFolder'

interface UniverseData {
  id: string
  name: string
  description?: string
  owner_id: string
}

interface WorldData {
  id: string
  name: string
  description?: string
  universe_id?: string
  state: 'exploring' | 'developing' | 'active' | 'paused' | 'archived'
  world_type: 'personal' | 'business' | 'client' | 'department' | 'project_domain'
  priority: 'low' | 'medium' | 'high' | 'critical'
}

export const UniverseSection = observer(function UniverseSection({ 
  universe, 
  personalWorlds,
  isCollapsed 
}: {
  universe: UniverseData
  personalWorlds: WorldData[]
  isCollapsed?: boolean
}) {
  const [isOpen, setIsOpen] = useState(true)
  
  if (!universe) return null
  
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
            {universe.name} ({personalWorlds.length} worlds)
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
          <Globe className="h-4 w-4 mr-2" />
          <span className="flex-1 text-left font-medium">{universe.name}</span>
          <Badge variant="secondary" className="ml-auto">
            {personalWorlds.length}
          </Badge>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-2">
        {personalWorlds.length > 0 ? (
          personalWorlds.map(world => (
            <WorldFolder 
              key={world.id} 
              world={world}
              isPersonal={true}
            />
          ))
        ) : (
          <div className="text-xs text-muted-foreground px-6 py-2">
            No personal worlds yet
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
})