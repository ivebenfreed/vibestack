import { observer } from '@legendapp/state/react'
import { useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Building, ChevronRight, Crown, Shield, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrganizationContext } from '@/legend-state'

function getRoleIcon(role: string) {
  switch (role) {
    case 'owner':
      return <Crown className="h-3 w-3" />
    case 'admin':
      return <Shield className="h-3 w-3" />
    case 'manager':
      return <User className="h-3 w-3" />
    default:
      return <User className="h-3 w-3" />
  }
}

function getRoleColor(role: string) {
  switch (role) {
    case 'owner':
      return 'text-yellow-600'
    case 'admin':
      return 'text-red-600'
    case 'manager':
      return 'text-blue-600'
    default:
      return 'text-gray-600'
  }
}

export const OrganizationsSection = observer(function OrganizationsSection({ 
  organizations,
  isCollapsed 
}: {
  organizations: OrganizationContext[]
  isCollapsed?: boolean
}) {
  const [isOpen, setIsOpen] = useState(true)
  
  if (isCollapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="w-full justify-center">
              <Building className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Organizations ({organizations.length})
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
          <Building className="h-4 w-4 mr-2" />
          <span className="flex-1 text-left font-medium">Organizations</span>
          <Badge variant="secondary" className="ml-auto">
            {organizations.length}
          </Badge>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-2">
        {organizations.length > 0 ? (
          organizations.map(org => (
            <Button
              key={org.info.id}
              variant="ghost"
              className="w-full justify-start px-6 py-1.5 h-auto font-normal text-xs"
            >
              <div className="flex items-center w-full">
                <span className="flex-1 text-left">{org.info.name}</span>
                <div className="flex items-center gap-1 ml-auto">
                  <div className={cn("flex items-center", getRoleColor(org.info.role))}>
                    {getRoleIcon(org.info.role)}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {(org.businessWorlds?.length || 0) + (org.personalWorlds?.length || 0)}
                  </Badge>
                </div>
              </div>
            </Button>
          ))
        ) : (
          <div className="text-xs text-muted-foreground px-6 py-2">
            No organizations yet
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
})