import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/state-machines'
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
  Search,
  FileText,
} from 'lucide-react'
import { searchEntities, type SearchResult } from '@/legend-state/observables/search'
import { observer } from '@legendapp/state/react'
import { universeSchema$, universeLoading$ } from '@/legend-state'

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
]

export const CommandMenu = observer(function CommandMenu() {
  const navigate = useNavigate()
  const { isAdmin, isSuperAdmin } = useAuth()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Use Legend State observables for reactive data access
  const universeSchema = universeSchema$.peek() // Get current schema
  const universeLoading = universeLoading$.peek() // Check if schema is loading

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

  // Search entities when query changes
  useEffect(() => {
    if (query.trim().length < 2) {
      setSearchResults([])
      return
    }

    // Don't search if schema is still loading or not available
    if (universeLoading || !universeSchema?.entities) {
      console.debug('Skipping search: schema not ready', { universeLoading, hasEntities: !!universeSchema?.entities })
      setSearchResults([])
      return
    }

    setSearchLoading(true)
    const searchTimeout = setTimeout(async () => {
      try {
        console.debug('Starting entity search for query:', query)
        const results = await searchEntities(query)
        console.debug('Search results:', results.length, 'items')
        setSearchResults(results)
      } catch (error) {
        console.error('Search error:', error)
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300) // Debounce search

    return () => clearTimeout(searchTimeout)
  }, [query, universeSchema, universeLoading])

  // Filter navigation items that match the query
  const filteredNavItems = navigationItems.filter(item => {
    // Permission filtering
    if (item.id.startsWith('debug') && !isAdmin && !isSuperAdmin) {
      return false
    }
    // Query filtering
    if (query.trim()) {
      return item.label.toLowerCase().includes(query.toLowerCase())
    }
    return true
  })


  return (
    <CommandDialog modal open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder='Search navigation, records, or type a command...'
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <ScrollArea type='hover' className='h-96 pr-1'>
          <CommandEmpty>
            {searchLoading ? 'Searching...' : 'No results found.'}
          </CommandEmpty>

          {/* Navigation Items */}
          {filteredNavItems.length > 0 && (
            <CommandGroup heading="Navigation">
              {filteredNavItems.map((item) => (
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
          )}

          {/* Entity Search Results */}
          {searchResults.length > 0 && (
            <CommandGroup heading={`Records (${searchResults.length})`}>
              {searchResults.slice(0, 20).map((result) => (
                <CommandItem
                  key={`${result.entityName}-${result.recordId}`}
                  value={`${result.recordName} ${result.entityType} ${result.matches.map(m => m.field).join(' ')} ${result.matches[0]?.preview || ''}`}
                  onSelect={() => {
                    runCommand(() => {
                      // Navigate to appropriate entity view
                      const entityRoutes: Record<string, string> = {
                        'WorkTask': '/tasks',
                        'ProjectPortfolio': '/projects',
                        'Client': '/clients',
                        'TeamMember': '/team',
                        'ClientMeeting': '/meetings',
                        'Document': '/documents',
                        'Invoice': '/invoices'
                      }
                      const route = entityRoutes[result.entityName] || '/'
                      navigate({ to: route })
                    })
                  }}
                >
                  <div className='mr-2 flex h-4 w-4 items-center justify-center'>
                    <FileText className='h-4 w-4' />
                  </div>
                  <div className='flex flex-col items-start'>
                    <span className='font-medium'>{result.recordName}</span>
                    <span className='text-xs text-muted-foreground'>
                      {result.entityType} · {result.matches.map(m => m.field).join(', ')}
                    </span>
                    {result.matches[0]?.preview && (
                      <span className='text-xs text-muted-foreground truncate max-w-full'>
                        {result.matches[0].preview.substring(0, 60)}...
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
              {searchResults.length > 20 && (
                <CommandItem disabled>
                  <div className='mr-2 flex h-4 w-4 items-center justify-center'>
                    <Search className='h-4 w-4' />
                  </div>
                  <span className='text-muted-foreground'>...and {searchResults.length - 20} more results</span>
                </CommandItem>
              )}
            </CommandGroup>
          )}
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  )
})