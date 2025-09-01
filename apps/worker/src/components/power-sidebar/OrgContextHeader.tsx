import { observer } from '@legendapp/state/react'
import { useState } from 'react'
import { Globe, ChevronDown, Building, User, Crown, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { OrganizationContext } from '@/legend-state'

interface OrgContextHeaderProps {
  currentOrg: OrganizationContext | null
  organizations: OrganizationContext[]
  onOrgSelect: (orgId: string | null) => void // null = universe view
  showUniverseView?: boolean
  isCollapsed?: boolean
}

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

function getOrgIcon(type: string) {
  return type === 'personal' ? <User className="h-4 w-4" /> : <Building className="h-4 w-4" />
}

export const OrgContextHeader = observer(function OrgContextHeader({
  currentOrg,
  organizations,
  onOrgSelect,
  showUniverseView = true,
  isCollapsed
}: OrgContextHeaderProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  if (isCollapsed) {
    return null
  }

  // Calculate total worlds count for current org
  const currentOrgWorldsCount = currentOrg 
    ? (currentOrg.personalWorlds?.length || 0) + (currentOrg.businessWorlds?.length || 0)
    : 0

  // Calculate universe totals
  const universeTotals = organizations.reduce((acc, org) => {
    acc.personalWorlds += org.personalWorlds?.length || 0
    acc.businessWorlds += org.businessWorlds?.length || 0
    acc.teams += org.teams?.length || 0
    return acc
  }, { personalWorlds: 0, businessWorlds: 0, teams: 0 })

  const isUniverseView = !currentOrg

  return (
    <div className="px-3 py-2">
      {/* Organization Context Breadcrumb */}
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between px-2 py-2 h-auto font-normal"
          >
            <div className="flex items-center gap-2">
              {isUniverseView ? (
                <>
                  <Globe className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-lg">My Universe</span>
                </>
              ) : (
                <>
                  {getOrgIcon(currentOrg.info.type || 'business')}
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-sm">{currentOrg.info.name}</span>
                    <div className="flex items-center gap-1">
                      <div className={cn("flex items-center", getRoleColor(currentOrg.info.role))}>
                        {getRoleIcon(currentOrg.info.role)}
                      </div>
                      <span className="text-xs text-muted-foreground">{currentOrg.info.role}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent className="w-72" align="start">
          {/* Universe View Option */}
          {showUniverseView && (
            <>
              <DropdownMenuItem 
                onClick={() => onOrgSelect(null)}
                className={cn(
                  "flex items-center gap-3 p-3",
                  isUniverseView && "bg-accent"
                )}
              >
                <Globe className="h-4 w-4 text-primary" />
                <div className="flex-1">
                  <div className="font-medium">My Universe</div>
                  <div className="text-xs text-muted-foreground">
                    All organizations • {universeTotals.personalWorlds + universeTotals.businessWorlds} worlds
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {/* Personal Organizations */}
          {organizations.filter(org => org.info.type === 'personal').map(org => (
            <DropdownMenuItem
              key={org.info.id}
              onClick={() => onOrgSelect(org.info.id)}
              className={cn(
                "flex items-center gap-3 p-3",
                currentOrg?.info.id === org.info.id && "bg-accent"
              )}
            >
              <User className="h-4 w-4" />
              <div className="flex-1">
                <div className="font-medium text-sm">{org.info.name}</div>
                <div className="text-xs text-muted-foreground">
                  Personal • {(org.personalWorlds?.length || 0) + (org.businessWorlds?.length || 0)} worlds
                </div>
              </div>
              <div className="flex items-center gap-1">
                <div className={cn("flex items-center", getRoleColor(org.info.role))}>
                  {getRoleIcon(org.info.role)}
                </div>
              </div>
            </DropdownMenuItem>
          ))}

          {/* Business Organizations */}
          {organizations.filter(org => org.info.type !== 'personal').length > 0 && (
            <>
              <DropdownMenuSeparator />
              {organizations.filter(org => org.info.type !== 'personal').map(org => (
                <DropdownMenuItem
                  key={org.info.id}
                  onClick={() => onOrgSelect(org.info.id)}
                  className={cn(
                    "flex items-center gap-3 p-3",
                    currentOrg?.info.id === org.info.id && "bg-accent"
                  )}
                >
                  <Building className="h-4 w-4" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{org.info.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Business • {(org.personalWorlds?.length || 0) + (org.businessWorlds?.length || 0)} worlds • {org.teams?.length || 0} teams
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={cn("flex items-center", getRoleColor(org.info.role))}>
                      {getRoleIcon(org.info.role)}
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Context Summary */}
      <div className="mt-3 space-y-2">
        {isUniverseView ? (
          <>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Personal Worlds</span>
              <Badge variant="outline" className="text-xs">
                {universeTotals.personalWorlds}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Business Worlds</span>
              <Badge variant="outline" className="text-xs">
                {universeTotals.businessWorlds}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Organizations</span>
              <Badge variant="outline" className="text-xs">
                {organizations.length}
              </Badge>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Worlds</span>
              <Badge variant="outline" className="text-xs">
                {currentOrgWorldsCount}
              </Badge>
            </div>
            {currentOrg && currentOrg.teams && currentOrg.teams.length > 0 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Teams</span>
                <Badge variant="outline" className="text-xs">
                  {currentOrg.teams.length}
                </Badge>
              </div>
            )}
          </>
        )}
      </div>
      
      <Separator className="mt-3" />
    </div>
  )
})