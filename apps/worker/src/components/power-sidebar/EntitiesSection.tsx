import { observer } from '@legendapp/state/react'
import { use$ } from '@legendapp/state/react'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { 
  ChevronRight, 
  Database, 
  Circle,
  FolderKanban,
  CheckSquare,
  FileText,
  Paperclip,
  MessageSquare,
  Activity,
  Package
} from 'lucide-react'
import { orgContext$, getEntity$ } from '@/legend-state'
import type { NavigationMode } from '@/legend-state/observables/navigation-mode'

interface EntitiesSectionProps {
  mode: NavigationMode
  isCollapsed?: boolean
}

export const EntitiesSection = observer(function EntitiesSection({ 
  mode, 
  isCollapsed 
}: EntitiesSectionProps) {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()
  const schema = use$(orgContext$.schema)
  
  const getEntityIcon = (archetype: string) => {
    const icons: Record<string, any> = {
      project: FolderKanban,
      task: CheckSquare,
      document: FileText,
      record: Database,
      file: Paperclip,
      discussion: MessageSquare,
      activity: Activity,
      collection: Package
    }
    return icons[archetype] || Circle
  }
  
  // Get all entities not already shown in worlds
  const orphanEntities = () => {
    if (!schema?.entities) return []
    
    const entityGroups: Array<{
      name: string
      archetype: string
      count: number
      icon: any
    }> = []
    
    Object.entries(schema.entities).forEach(([entityName, def]: [string, any]) => {
      const entityObs = getEntity$(entityName)
      if (!entityObs) return
      
      const allRecords = Object.values(entityObs.get())
      
      // Filter based on mode
      const filteredRecords = allRecords.filter((record: any) => {
        if (mode === 'personal') {
          return record.universe_id || record.is_personal
        } else if (mode === 'work') {
          return !record.universe_id && !record.is_personal
        }
        return true // 'all' mode
      })
      
      // Only show entities without world associations
      const orphans = filteredRecords.filter((record: any) => 
        !record.world_id && !record.parent_world_id
      )
      
      if (orphans.length > 0) {
        entityGroups.push({
          name: entityName,
          archetype: def.archetype,
          count: orphans.length,
          icon: getEntityIcon(def.archetype)
        })
      }
    })
    
    return entityGroups.sort((a, b) => {
      const priority: Record<string, number> = {
        'project': 1,
        'task': 2,
        'document': 3,
        'record': 4,
        'file': 5
      }
      return (priority[a.archetype] || 99) - (priority[b.archetype] || 99)
    })
  }
  
  const entities = orphanEntities()
  
  if (entities.length === 0) return null
  
  if (isCollapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="w-full justify-center">
              <Database className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            All Entities
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
          <Database className="h-4 w-4 mr-2" />
          <span className="flex-1 text-left font-medium">All Entities</span>
          <Badge variant="secondary" className="ml-auto">
            {entities.reduce((sum, e) => sum + e.count, 0)}
          </Badge>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-2">
        {entities.map(entity => {
          const Icon = entity.icon
          return (
            <Button
              key={entity.name}
              variant="ghost"
              className="w-full justify-start px-4 py-1 h-auto font-normal"
              onClick={() => navigate({ to: `/entities/${entity.name}` })}
            >
              <Icon className="h-3 w-3 mr-2" />
              <span className="flex-1 text-left text-sm">{entity.name}</span>
              <Badge variant="outline" className="ml-1 px-1 py-0 text-xs">
                {entity.count}
              </Badge>
            </Button>
          )
        })}
      </CollapsibleContent>
    </Collapsible>
  )
})