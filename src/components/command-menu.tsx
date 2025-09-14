import { useEffect, useState, useMemo } from 'react'
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
import { observer, use$ } from '@legendapp/state/react'
import { universeSchema$, universeLoading$ } from '@/legend-state'
import { useSearch } from '@/context/search-context'
import { EntityNameUtils } from '@/lib/entity-name-utils'

// Base navigation items that don't depend on universe context
const baseNavigationItems = [
  { id: 'dashboard', label: 'Dashboard', href: '/', icon: Home },
  { id: 'universe', label: 'Universe', href: '/universe', icon: Home },
  { id: 'apps', label: 'Apps', href: '/apps', icon: Package },
  { id: 'chats', label: 'Chats', href: '/chats', icon: MessageSquare },
  { id: 'help-center', label: 'Help Center', href: '/help-center', icon: HelpCircle },
  { id: 'settings', label: 'Settings', href: '/settings', icon: Settings },
  { id: 'debug', label: 'Debug', href: '/debug', icon: Bug },
  { id: 'debug-sync', label: 'Debug - Sync', href: '/debug/sync', icon: Bug },
  { id: 'debug-database', label: 'Debug - Database', href: '/debug/database', icon: Bug },
]

// Entity icon mapping based on archetype or name patterns
const getEntityIcon = (entityName: string, archetype?: string) => {
  // Check archetype first
  if (archetype) {
    switch (archetype) {
      case 'project': return FolderKanban
      case 'task': return CheckSquare
      case 'person': return Home // You might want to import Users icon
      case 'meeting': return MessageSquare
      default: break
    }
  }

  // Fallback to name-based mapping
  const lowercaseName = entityName.toLowerCase()
  if (lowercaseName.includes('task')) return CheckSquare
  if (lowercaseName.includes('project')) return FolderKanban
  if (lowercaseName.includes('client') || lowercaseName.includes('contact')) return Home
  if (lowercaseName.includes('meeting')) return MessageSquare
  if (lowercaseName.includes('document')) return FileText

  // Default icon
  return FileText
}

export const CommandMenu = observer(function CommandMenu() {
  const navigate = useNavigate()
  const { isAdmin, isSuperAdmin, currentOrganization } = useAuth()
  const { open, setOpen } = useSearch()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Use Legend State observables for reactive data access
  const universeSchema = use$(universeSchema$)
  const universeLoading = use$(universeLoading$)
  const currentOrgId = currentOrganization?.id // Get current org ID from auth

  // Generate dynamic navigation items based on universe context
  const navigationItems = useMemo(() => {
    const items = [...baseNavigationItems]

    // Add entity-based navigation items if schema is available
    if (universeSchema?.entities && currentOrgId) {
      const entityEntries = Object.entries(universeSchema.entities)
      console.log('[CommandMenu] Generating entity navigation items:', {
        entityCount: entityEntries.length,
        entityNames: entityEntries.map(([name]) => name),
        currentOrgId,
        universeLoading
      })

      // Add entity navigation items with proper org prefix and normalized names
      entityEntries.forEach(([entityName, entityConfig]: [string, any]) => {
        try {
          // Extract clean entity name and get display format
          const { entityName: cleanEntityName } = EntityNameUtils.extractOrgPrefix(entityName)
          const displayName = EntityNameUtils.toDisplayFormat(entityName)
          const icon = getEntityIcon(cleanEntityName, entityConfig.archetype)

          console.log('[CommandMenu] Adding entity navigation item:', {
            original: entityName,
            clean: cleanEntityName,
            display: displayName
          })

          items.push({
            id: `entity-${cleanEntityName}`,
            label: displayName,
            href: `/org/${currentOrgId}/entities/${cleanEntityName}`, // Use proper org prefix
            icon: icon
          })
        } catch (error) {
          console.error('[CommandMenu] Error processing entity navigation item:', entityName, error)
        }
      })
    } else {
      console.log('[CommandMenu] Entity navigation not available:', {
        hasEntities: !!universeSchema?.entities,
        entityCount: Object.keys(universeSchema?.entities || {}).length,
        universeLoading,
        currentOrgId,
        universeSchema: universeSchema ? 'exists' : 'null',
        conditionCheck: {
          hasEntities: !!universeSchema?.entities,
          loadingState: universeLoading,
          hasOrgId: !!currentOrgId,
          allTrue: !!(universeSchema?.entities && currentOrgId)
        }
      })
    }

    console.log('[CommandMenu] Total navigation items generated:', items.length)
    return items
  }, [universeSchema, universeLoading, currentOrgId])

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

  // Filter navigation items - always show base items, filter by permissions and query
  const filteredNavItems = navigationItems.filter(item => {
    // Permission filtering
    if (item.id.startsWith('debug') && !isAdmin && !isSuperAdmin) {
      return false
    }
    // If there's a query, filter navigation items but keep them visible
    if (query.trim()) {
      return item.label.toLowerCase().includes(query.toLowerCase())
    }
    return true
  })

  // Separate base navigation from entity navigation for better organization
  const baseNavItems = filteredNavItems.filter(item => !item.id.startsWith('entity-'))
  const entityNavItems = filteredNavItems.filter(item => item.id.startsWith('entity-'))


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

          {/* Base Navigation Items - Always show unless filtered by query */}
          {baseNavItems.length > 0 && (
            <CommandGroup heading="Navigation">
              {baseNavItems.map((item) => (
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

          {/* Entity Navigation Items */}
          {entityNavItems.length > 0 && !query.trim() && (
            <CommandGroup heading="Entities">
              {entityNavItems.map((item) => (
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
                      // Navigate to entity detail with proper org prefix and normalized name
                      const { entityName: cleanEntityName } = EntityNameUtils.extractOrgPrefix(result.entityName)
                      if (currentOrgId) {
                        navigate({ to: `/org/${currentOrgId}/entities/${cleanEntityName}/${result.recordId}` })
                      } else {
                        // Fallback to entities route without org if no org context
                        navigate({ to: `/entities/${cleanEntityName}/${result.recordId}` })
                      }
                    })
                  }}
                >
                  <div className='mr-2 flex h-4 w-4 items-center justify-center'>
                    <FileText className='h-4 w-4' />
                  </div>
                  <div className='flex flex-col items-start'>
                    <span className='font-medium'>{result.recordName}</span>
                    <span className='text-xs text-muted-foreground'>
                      {EntityNameUtils.toDisplayFormat(result.entityName)} · {result.matches.map(m => m.field).join(', ')}
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