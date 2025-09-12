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
  Package,
  Globe,
  Building
} from 'lucide-react'
import { universeContext$, currentOrganizations$, allPersonalWorlds$, allBusinessWorlds$ } from '@/legend-state'

interface EntitiesSectionProps {
  isCollapsed?: boolean
}

export const EntitiesSection = observer(function EntitiesSection({ 
  isCollapsed 
}: EntitiesSectionProps) {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()
  const universeContext = use$(universeContext$)
  const organizations = use$(currentOrganizations$)
  const personalWorlds = use$(allPersonalWorlds$)
  const businessWorlds = use$(allBusinessWorlds$)
  
  const getContextIcon = (contextType: 'personal' | 'business') => {
    return contextType === 'personal' ? Globe : Building
  }
  
  // Get user's entity contexts across personal and organizational contexts
  const getUserEntityContexts = () => {
    const contexts: Array<{
      id: string
      name: string
      type: 'personal' | 'business'
      context: string // personal world name or org name
      worldCount?: number
      totalEntities?: number
    }> = []
    
    // Add personal worlds as entity contexts
    personalWorlds.forEach(world => {
      contexts.push({
        id: `personal-${world.id}`,
        name: world.name,
        type: 'personal',
        context: 'Personal',
        totalEntities: world.entity_count || 0
      })
    })
    
    // Add organization contexts
    organizations.forEach(org => {
      const totalBusinessWorlds = org.businessWorlds?.length || 0
      const totalPersonalWorlds = org.personalWorlds?.length || 0
      const totalWorlds = totalBusinessWorlds + totalPersonalWorlds
      
      contexts.push({
        id: `org-${org.info.id}`,
        name: org.info.name,
        type: 'business',
        context: 'Organization',
        worldCount: totalWorlds,
        totalEntities: 0 // TODO: Sum entities across org's worlds
      })
    })
    
    // Sort by type (personal first) then by entity count
    return contexts.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'personal' ? -1 : 1
      }
      return (b.totalEntities || 0) - (a.totalEntities || 0)
    })
  }
  
  const entityContexts = getUserEntityContexts()
  const totalContexts = entityContexts.length
  const totalPersonalWorlds = personalWorlds.length
  const totalOrgs = organizations.length
  
  if (totalContexts === 0) return null
  
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
            All Entities ({totalPersonalWorlds + totalOrgs} contexts)
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
            {totalPersonalWorlds + totalOrgs}
          </Badge>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-2">
        <div className="space-y-1">
          {/* Personal Entity Contexts */}
          {personalWorlds.length > 0 && (
            <>
              <div className="text-xs text-muted-foreground px-2 mb-1">Personal Contexts</div>
              {personalWorlds.map(world => (
                <Button
                  key={world.id}
                  variant="ghost"
                  className="w-full justify-start px-4 py-1 h-auto font-normal"
                  onClick={() => navigate({ to: `/worlds/${world.id}/entities` })}
                >
                  <Globe className="h-3 w-3 mr-2 text-blue-500" />
                  <span className="flex-1 text-left text-sm truncate">{world.name}</span>
                  {world.entity_count !== undefined && (
                    <Badge variant="outline" className="text-xs ml-1">
                      {world.entity_count}
                    </Badge>
                  )}
                </Button>
              ))}
            </>
          )}
          
          {/* Organization Entity Contexts */}
          {organizations.length > 0 && (
            <>
              {personalWorlds.length > 0 && <div className="h-2" />}
              <div className="text-xs text-muted-foreground px-2 mb-1">Organization Contexts</div>
              {organizations.map(org => {
                const totalWorlds = (org.businessWorlds?.length || 0) + (org.personalWorlds?.length || 0)
                return (
                  <Button
                    key={org.info.id}
                    variant="ghost"
                    className="w-full justify-start px-4 py-1 h-auto font-normal"
                    onClick={() => navigate({ to: `/organizations/${org.info.id}/entities` })}
                  >
                    <Building className="h-3 w-3 mr-2 text-green-600" />
                    <span className="flex-1 text-left text-sm truncate">{org.info.name}</span>
                    <Badge variant="outline" className="text-xs ml-1">
                      {totalWorlds}w
                    </Badge>
                  </Button>
                )
              })}
            </>
          )}
          
          {/* All Entities Link */}
          <div className="h-2" />
          <Button
            variant="ghost"
            className="w-full justify-start px-4 py-1 h-auto font-normal text-muted-foreground"
            onClick={() => navigate({ to: '/entities' })}
          >
            <Database className="h-3 w-3 mr-2" />
            <span className="text-sm">View All Entities</span>
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
})