import { observer } from '@legendapp/state/react'
import { use$ } from '@legendapp/state/react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { 
  Globe,
  Users,
  AlertCircle,
  Activity,
  FolderKanban,
  Home
} from 'lucide-react'
import { allActiveWorlds$, allTeams$, allPersonalWorlds$, allBusinessWorlds$ } from '@/legend-state'
interface WorkContextProps {
  isCollapsed?: boolean
}

export const QuickLinks = observer(function WorkContext({ 
  isCollapsed 
}: WorkContextProps) {
  const navigate = useNavigate()
  const activeWorlds = use$(allActiveWorlds$)
  const allTeams = use$(allTeams$)
  const personalWorlds = use$(allPersonalWorlds$)
  const businessWorlds = use$(allBusinessWorlds$)
  
  // Get high priority worlds
  const highPriorityWorlds = [
    ...personalWorlds.filter(w => w?.priority === 'high' || w?.priority === 'critical'),
    ...businessWorlds.filter(w => w?.priority === 'high' || w?.priority === 'critical')
  ]
  
  // Essential navigation items
  const essentialLinks = [
    { icon: Home, label: 'Dashboard', href: '/' },
    { icon: Activity, label: 'Activity', href: '/activity' },
  ]
  
  if (isCollapsed) {
    return (
      <TooltipProvider>
        <div className="space-y-1">
          {/* Essential links */}
          {essentialLinks.map(link => {
            const Icon = link.icon
            return (
              <Tooltip key={link.href}>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="w-full justify-center"
                    onClick={() => navigate({ to: link.href })}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {link.label}
                </TooltipContent>
              </Tooltip>
            )
          })}
          
          {/* Active worlds */}
          {activeWorlds.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-full justify-center">
                  <Globe className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                Active Worlds ({activeWorlds.length})
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>
    )
  }
  
  return (
    <div className="space-y-2">
      {/* Essential Links */}
      <div className="space-y-0.5">
        <div className="text-xs text-muted-foreground px-2 mb-1">Quick Access</div>
        {essentialLinks.map(link => {
          const Icon = link.icon
          return (
            <Button
              key={link.href}
              variant="ghost"
              className="w-full justify-start px-2 py-1 h-auto font-normal"
              onClick={() => navigate({ to: link.href })}
            >
              <Icon className="h-4 w-4 mr-2" />
              <span className="text-sm">{link.label}</span>
            </Button>
          )
        })}
      </div>
      
      {/* Active Worlds Work Context */}
      {activeWorlds.length > 0 && (
        <div className="space-y-0.5">
          <div className="text-xs text-muted-foreground px-2 mb-1 flex items-center justify-between">
            <span>Active Work</span>
            <Badge variant="secondary" className="text-xs">
              {activeWorlds.length}
            </Badge>
          </div>
          {activeWorlds.slice(0, 5).map(world => (
            <Button
              key={world?.id}
              variant="ghost"
              className="w-full justify-start px-2 py-1 h-auto font-normal"
              onClick={() => navigate({ to: `/worlds/${world?.id}` })}
            >
              <Globe className="h-3 w-3 mr-2" />
              <span className="text-xs flex-1 text-left truncate">{world?.name}</span>
              {world?.priority === 'high' || world?.priority === 'critical' ? (
                <AlertCircle className="h-3 w-3 text-orange-500" />
              ) : null}
            </Button>
          ))}
          {activeWorlds.length > 5 && (
            <Button
              variant="ghost"
              className="w-full justify-start px-2 py-1 h-auto font-normal text-xs text-muted-foreground"
              onClick={() => navigate({ to: '/worlds?filter=active' })}
            >
              <span className="ml-5">+{activeWorlds.length - 5} more...</span>
            </Button>
          )}
        </div>
      )}
      
      {/* High Priority Worlds */}
      {highPriorityWorlds.length > 0 && (
        <div className="space-y-0.5">
          <div className="text-xs text-muted-foreground px-2 mb-1 flex items-center justify-between">
            <span>High Priority</span>
            <Badge variant="destructive" className="text-xs">
              {highPriorityWorlds.length}
            </Badge>
          </div>
          {highPriorityWorlds.slice(0, 3).map(world => (
            <Button
              key={world?.id}
              variant="ghost"
              className="w-full justify-start px-2 py-1 h-auto font-normal"
              onClick={() => navigate({ to: `/worlds/${world?.id}` })}
            >
              <AlertCircle className="h-3 w-3 mr-2 text-orange-500" />
              <span className="text-xs flex-1 text-left truncate">{world?.name}</span>
              <Badge variant="outline" className="text-xs">
                {world?.priority}
              </Badge>
            </Button>
          ))}
        </div>
      )}
      
      {/* Active Teams */}
      {allTeams.length > 0 && (
        <div className="space-y-0.5">
          <div className="text-xs text-muted-foreground px-2 mb-1 flex items-center justify-between">
            <span>My Teams</span>
            <Badge variant="secondary" className="text-xs">
              {allTeams.length}
            </Badge>
          </div>
          {allTeams.slice(0, 3).map(team => (
            <Button
              key={team?.id}
              variant="ghost"
              className="w-full justify-start px-2 py-1 h-auto font-normal"
              onClick={() => navigate({ to: `/teams/${team?.id}` })}
            >
              <Users className="h-3 w-3 mr-2" />
              <span className="text-xs flex-1 text-left truncate">{team?.name}</span>
              <Badge variant="outline" className="text-xs">
                {team?.user_role || 'member'}
              </Badge>
            </Button>
          ))}
          {allTeams.length > 3 && (
            <Button
              variant="ghost"
              className="w-full justify-start px-2 py-1 h-auto font-normal text-xs text-muted-foreground"
              onClick={() => navigate({ to: '/teams' })}
            >
              <span className="ml-5">+{allTeams.length - 3} more teams...</span>
            </Button>
          )}
        </div>
      )}
    </div>
  )
})