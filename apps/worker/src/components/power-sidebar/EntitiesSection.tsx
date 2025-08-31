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
  
  // Get all entity types (not individual records)
  const getEntityTypes = () => {
    if (!schema?.entities) return []
    
    const entityTypes: Array<{
      name: string
      archetype: string
      icon: any
    }> = []
    
    // Show all entity types from the schema
    Object.entries(schema.entities).forEach(([entityName, def]: [string, any]) => {
      entityTypes.push({
        name: entityName,
        archetype: def.archetype || 'record',
        icon: getEntityIcon(def.archetype || 'record')
      })
    })
    
    // Sort by archetype priority
    return entityTypes.sort((a, b) => {
      const priority: Record<string, number> = {
        'project': 1,
        'task': 2,
        'document': 3,
        'record': 4,
        'file': 5,
        'discussion': 6,
        'activity': 7,
        'collection': 8
      }
      return (priority[a.archetype] || 99) - (priority[b.archetype] || 99)
    })
  }
  
  const entityTypes = getEntityTypes()
  
  if (entityTypes.length === 0) return null
  
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
            {entityTypes.length}
          </Badge>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-2">
        {entityTypes.map(entity => {
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
            </Button>
          )
        })}
      </CollapsibleContent>
    </Collapsible>
  )
})