import { observer } from '@legendapp/state/react'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { 
  ChevronRight, 
  Circle, 
  FolderKanban, 
  CheckSquare, 
  FileText, 
  Database, 
  Paperclip, 
  MessageSquare, 
  Activity 
} from 'lucide-react'

interface EntityGroupInWorldProps {
  entityName: string
  data: {
    archetype: string
    records: any[]
    count: number
  }
  worldId: string
}

function pluralize(str: string): string {
  if (str.endsWith('s')) return str
  if (str.endsWith('y')) return str.slice(0, -1) + 'ies'
  return str + 's'
}

export const EntityGroupInWorld = observer(function EntityGroupInWorld({ 
  entityName, 
  data, 
  worldId 
}: EntityGroupInWorldProps) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()
  
  const getEntityIcon = (archetype: string) => {
    const icons: Record<string, any> = {
      project: FolderKanban,
      task: CheckSquare,
      document: FileText,
      record: Database,
      file: Paperclip,
      discussion: MessageSquare,
      activity: Activity
    }
    return icons[archetype] || Circle
  }
  
  const Icon = getEntityIcon(data.archetype)
  
  // Show first few items inline if only a few
  const showInline = data.count <= 3
  
  if (showInline) {
    return (
      <div className="space-y-0.5 ml-2">
        {data.records.map(record => (
          <Button
            key={record?.id}
            variant="ghost"
            className="w-full justify-start px-2 py-0.5 h-auto font-normal"
            onClick={() => navigate({ to: `/entities/${entityName}/${record?.id}` })}
          >
            <Icon className="h-3 w-3 mr-2" />
            <span className="text-xs truncate">
              {record?.name || record?.title || `${entityName} ${record?.id?.slice(0, 8) || 'unknown'}`}
            </span>
          </Button>
        ))}
      </div>
    )
  }
  
  // Expandable group for many items
  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start px-2 py-0.5 h-auto font-normal"
        >
          <ChevronRight className={cn(
            "h-2 w-2 mr-1 transition-transform",
            expanded && "rotate-90"
          )} />
          <Icon className="h-3 w-3 mr-2" />
          <span className="text-xs flex-1 text-left">{pluralize(entityName)}</span>
          <Badge variant="ghost" className="ml-1 px-1 py-0 text-xs">
            {data.count}
          </Badge>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-4 space-y-0.5">
        {data.records.slice(0, 10).map(record => (
          <Button
            key={record?.id}
            variant="ghost"
            className="w-full justify-start px-2 py-0.5 h-auto font-normal"
            onClick={() => navigate({ to: `/entities/${entityName}/${record?.id}` })}
          >
            <span className="text-xs truncate">
              {record?.name || record?.title || 'Unnamed'}
            </span>
            {record?.status && (
              <Badge variant="outline" className="ml-auto px-1 py-0 text-xs">
                {record?.status}
              </Badge>
            )}
          </Button>
        ))}
        {data.count > 10 && (
          <Button
            variant="ghost"
            className="w-full justify-start px-2 py-0.5 h-auto font-normal text-muted-foreground"
            onClick={() => navigate({ to: `/entities/${entityName}?world=${worldId}` })}
          >
            <span className="text-xs">Show all {data.count} {pluralize(entityName)}...</span>
          </Button>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
})