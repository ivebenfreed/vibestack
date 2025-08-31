import { observer } from '@legendapp/state/react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { 
  Home,
  FolderKanban,
  CheckSquare,
  Settings,
  Activity,
  Grid3X3
} from 'lucide-react'
import type { NavigationMode } from '@/legend-state/observables/navigation-mode'

interface QuickLinksProps {
  mode: NavigationMode
  isCollapsed?: boolean
}

interface LinkItem {
  icon: any
  label: string
  href: string
  modes: NavigationMode[]
}

const quickLinks: LinkItem[] = [
  { icon: Home, label: 'Dashboard', href: '/', modes: ['all', 'personal', 'work'] },
  { icon: FolderKanban, label: 'Projects', href: '/entities/project', modes: ['all', 'work'] },
  { icon: CheckSquare, label: 'Tasks', href: '/entities/task', modes: ['all', 'personal', 'work'] },
  { icon: Activity, label: 'Activity', href: '/activity', modes: ['all', 'personal', 'work'] },
  { icon: Grid3X3, label: 'All Entities', href: '/entities', modes: ['all'] },
  { icon: Settings, label: 'Settings', href: '/settings', modes: ['all'] }
]

export const QuickLinks = observer(function QuickLinks({ 
  mode, 
  isCollapsed 
}: QuickLinksProps) {
  const navigate = useNavigate()
  
  const visibleLinks = quickLinks.filter(link => link.modes.includes(mode))
  
  if (isCollapsed) {
    return (
      <TooltipProvider>
        <div className="space-y-1">
          {visibleLinks.map(link => {
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
        </div>
      </TooltipProvider>
    )
  }
  
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground px-2 mb-1">Quick Links</div>
      {visibleLinks.map(link => {
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
  )
})