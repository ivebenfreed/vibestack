import { observer } from '@legendapp/state/react'
import { useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { User, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorldFolder } from './WorldFolder'
import type { World } from '@/legend-state'

export const PersonalSection = observer(function PersonalSection({ 
  personalWorlds,
  isCollapsed 
}: {
  personalWorlds: World[]
  isCollapsed?: boolean
}) {
  const [isOpen, setIsOpen] = useState(true)
  
  if (isCollapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="w-full justify-center">
              <User className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Personal ({personalWorlds.length} worlds)
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
          <User className="h-4 w-4 mr-2" />
          <span className="flex-1 text-left font-medium">Personal</span>
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