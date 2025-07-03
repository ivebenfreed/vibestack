import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Home, 
  FolderKanban, 
  CheckSquare, 
  Settings, 
  Bug,
  MessageSquare,
  Package,
  HelpCircle,
} from 'lucide-react'

const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', href: '/', icon: Home },
  { id: 'projects', label: 'Projects', href: '/projects', icon: FolderKanban },
  { id: 'tasks', label: 'Tasks', href: '/tasks', icon: CheckSquare },
  { id: 'tasks-kanban', label: 'Tasks Kanban', href: '/tasks?view=kanban', icon: CheckSquare },
  { id: 'tasks-timeline', label: 'Tasks Timeline', href: '/tasks?view=timeline', icon: CheckSquare },
  { id: 'apps', label: 'Apps', href: '/apps', icon: Package },
  { id: 'chats', label: 'Chats', href: '/chats', icon: MessageSquare },
  { id: 'help-center', label: 'Help Center', href: '/help-center', icon: HelpCircle },
  { id: 'settings', label: 'Settings', href: '/settings', icon: Settings },
  { id: 'debug', label: 'Debug', href: '/debug', icon: Bug },
  { id: 'debug-sync', label: 'Debug - Sync', href: '/debug/sync', icon: Bug },
  { id: 'debug-database', label: 'Debug - Database', href: '/debug/database', icon: Bug },
  { id: 'debug-vibegrid', label: 'Debug - VibeGridOptimus', href: '/debug/grid-optimus-projects', icon: Bug },
]

export function CommandMenu() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runCommand = (command: () => unknown) => {
    setOpen(false)
    command()
  }

  return (
    <CommandDialog modal open={open} onOpenChange={setOpen}>
      <CommandInput placeholder='Type a command or search...' />
      <CommandList>
        <ScrollArea type='hover' className='h-72 pr-1'>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {navigationItems.map((item) => (
              <CommandItem
                key={item.id}
                value={item.label}
                onSelect={() => {
                  runCommand(() => navigate({ to: item.href }))
                }}
              >
                <div className='mr-2 flex h-4 w-4 items-center justify-center'>
                  <item.icon className='h-4 w-4' />
                </div>
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  )
}