import { observer } from '@legendapp/state/react'
import { use$ } from '@legendapp/state/react'
import { useState, useMemo } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ChevronRight, Sparkles, Building2 } from 'lucide-react'
import { universeSchema$, getEntity$ } from '@/legend-state'
import { EntityGroupInWorld } from './EntityGroupInWorld'

interface WorldData {
  id: string
  name: string
  description?: string
  universe_id?: string
  state: 'exploring' | 'developing' | 'active' | 'paused' | 'archived'
  world_type: 'personal' | 'business' | 'client' | 'department' | 'project_domain'
  priority: 'low' | 'medium' | 'high' | 'critical'
}

export const WorldFolder = observer(function WorldFolder({ 
  world, 
  isPersonal = false 
}: {
  world: WorldData
  isPersonal: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const schema = use$(universeSchema$)
  
  // Get ALL entities that belong to this world
  const worldEntities = useMemo(() => {
    if (!schema?.entities) return {}
    
    const entitiesByType: Record<string, {
      archetype: string
      records: any[]
      count: number
    }> = {}
    
    Object.entries(schema.entities).forEach(([entityName, def]: [string, any]) => {
      const entityObs = getEntity$(entityName)
      if (!entityObs) return
      
      const allRecords = Object.values(entityObs.get())
      
      const worldRecords = allRecords.filter((record: any) => {
        return record.world_id === world.id ||
               record.parent_world_id === world.id ||
               (isPersonal && record.universe_id === world.universe_id)
      })
      
      if (worldRecords.length > 0) {
        entitiesByType[entityName] = {
          archetype: def.archetype,
          records: worldRecords,
          count: worldRecords.length
        }
      }
    })
    
    return entitiesByType
  }, [schema, world.id, world.universe_id, isPersonal])
  
  const totalCount = Object.values(worldEntities).reduce(
    (sum, group) => sum + group.count, 
    0
  )
  
  const getStateBadgeVariant = (state: string): "default" | "secondary" | "outline" | "destructive" => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      active: 'default',
      developing: 'secondary',
      exploring: 'outline',
      paused: 'secondary',
      archived: 'secondary'
    }
    return variants[state] || 'secondary'
  }
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start px-2 py-1 h-auto font-normal"
        >
          <ChevronRight className={cn(
            "h-3 w-3 mr-1 transition-transform",
            isOpen && "rotate-90"
          )} />
          {isPersonal ? (
            <Sparkles className="h-3 w-3 mr-2" />
          ) : (
            <Building2 className="h-3 w-3 mr-2" />
          )}
          <span className="flex-1 text-left text-sm">{world.name}</span>
          <Badge variant={getStateBadgeVariant(world.state)} className="ml-1 px-1 py-0 text-xs">
            {world.state}
          </Badge>
          <Badge variant="outline" className="ml-1 px-1.5 py-0 text-xs">
            {totalCount}
          </Badge>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-4">
        {totalCount > 0 ? (
          Object.entries(worldEntities)
            .sort(([, a], [, b]) => {
              const priority: Record<string, number> = {
                'project': 1,
                'task': 2,
                'document': 3,
                'record': 4,
                'file': 5
              }
              return (priority[a.archetype] || 99) - (priority[b.archetype] || 99)
            })
            .map(([entityName, data]) => (
              <EntityGroupInWorld 
                key={entityName}
                entityName={entityName}
                data={data}
                worldId={world.id}
              />
            ))
        ) : (
          <div className="text-xs text-muted-foreground px-4 py-1">
            No entities yet
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
})