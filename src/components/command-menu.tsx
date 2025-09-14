import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { useUnifiedAuth } from '@/legend-state/hooks/use-unified-auth'
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
  HelpCircle,
  Search,
  FileText,
  Globe,
  Activity,
  BarChart3,
} from 'lucide-react'
import { searchEntities, type SearchResult } from '@/legend-state/observables/search'
import { observer, use$ } from '@legendapp/state/react'
import { universeSchema$, universeLoading$, createEntityGroups } from '@/legend-state'
import { useSearch } from '@/context/search-context'
import { EntityNameUtils } from '@/lib/entity-name-utils'

// Base navigation items that match the unified sidebar structure
const getBaseNavigationItems = (isAdmin: boolean, isSuperAdmin: boolean, currentOrgId?: string) => {
  const items = [
    // Universe-level navigation (matches unified sidebar)
    { id: 'universe', label: 'Universe Dashboard', href: '/universe', icon: Globe },
    { id: 'universe-analytics', label: 'Analytics', href: '/universe/analytics', icon: Activity },

    // Organization dashboard (only if in org context)
    ...(currentOrgId ? [
      { id: 'org-dashboard', label: 'Organization Dashboard', href: `/org/${currentOrgId}/dashboard`, icon: BarChart3 }
    ] : []),

    // Bottom navigation items (matches unified sidebar)
    { id: 'help-center', label: 'Help Center', href: '/help-center', icon: HelpCircle },
    { id: 'settings', label: 'Settings', href: '/settings', icon: Settings },
  ]

  // Add debug items only for admins (matches unified sidebar logic)
  if (isAdmin || isSuperAdmin) {
    items.push(
      { id: 'debug', label: 'Debug', href: '/debug', icon: Bug },
      { id: 'debug-sync', label: 'Debug - Sync', href: '/debug/sync', icon: Bug },
      { id: 'debug-database', label: 'Debug - Database', href: '/debug/database', icon: Bug },
    )
  }

  return items
}

// Icon resolver for dynamic entity icons (matches sidebar implementation)
const IconMap: Record<string, React.ElementType> = {
  CheckSquare,
  FolderKanban,
  FileText,
  Activity,
  Globe,
  BarChart3,
}

function getIconComponent(iconName: string): React.ElementType {
  return IconMap[iconName] || FileText
}

export const CommandMenu = observer(function CommandMenu() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, userOrganizations } = useUnifiedAuth()
  const { open, setOpen } = useSearch()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Use same organization detection logic as sidebar (URL-based)
  const currentOrgId = location.pathname.startsWith('/org/')
    ? location.pathname.split('/')[2] // Extract orgId from /org/{orgId}/...
    : null
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const isSuperAdmin = user?.role === 'super_admin'

  // Get current organization details (same as sidebar)
  const currentOrg = currentOrgId
    ? (userOrganizations || []).find(org => org.id === currentOrgId)
    : null

  // Use Legend State observables for reactive data access
  const universeSchema = use$(universeSchema$)
  const universeLoading = use$(universeLoading$)

  // Create global entity groups across ALL organizations (not filtered by current org)
  const globalEntityGroups$ = useMemo(() => {
    console.log('[CommandMenu] Creating GLOBAL entity groups across universe')
    return createEntityGroups() // No orgId filter = show all entities from all orgs
  }, [])

  const entityNavGroups = use$(globalEntityGroups$)

  // Debug logging for entity groups
  useEffect(() => {
    console.log('[CommandMenu] Entity nav groups changed:', {
      entityNavGroups,
      groupCount: entityNavGroups?.length || 0,
      currentOrgId,
      hasOrgEntityGroups: !!globalEntityGroups$
    })
  }, [entityNavGroups, currentOrgId, globalEntityGroups$])

  // Generate dynamic navigation items based on universe context
  const navigationItems = useMemo(() => {
    const items = [...getBaseNavigationItems(isAdmin, isSuperAdmin, currentOrgId)]

    // Add GLOBAL entity-based navigation items from ALL organizations
    if (entityNavGroups) {
      console.log('[CommandMenu] Generating GLOBAL entity navigation items:', {
        groupCount: entityNavGroups.length,
        universeLoading
      })

      // Add entity navigation items from ALL organizations
      entityNavGroups.forEach(group => {
        group.items?.forEach(item => {
          // Extract organization ID from the URL to get org name
          const orgIdMatch = item.url.match(/\/org\/([^/]+)\//)
          const itemOrgId = orgIdMatch ? orgIdMatch[1] : null
          const itemOrg = itemOrgId
            ? (userOrganizations || []).find(org => org.id === itemOrgId)
            : null

          console.log('[CommandMenu] Adding GLOBAL entity navigation item:', {
            title: item.title,
            url: item.url,
            icon: item.icon,
            orgId: itemOrgId,
            orgName: itemOrg?.name
          })

          items.push({
            id: `entity-${itemOrgId}-${item.title}`,
            label: item.title,
            href: item.url,
            icon: getIconComponent(item.icon),
            orgName: itemOrg?.name // Store org name for subtitle
          })
        })
      })
    } else {
      console.log('[CommandMenu] GLOBAL entity navigation not available:', {
        hasEntityGroups: !!entityNavGroups,
        groupCount: entityNavGroups?.length || 0,
        universeLoading
      })
    }

    console.log('[CommandMenu] Total navigation items generated:', items.length)
    return items
  }, [entityNavGroups, universeLoading, currentOrgId, isAdmin, isSuperAdmin, location.pathname, userOrganizations])

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

  // Filter navigation items by query only (permissions now handled in getBaseNavigationItems)
  const filteredNavItems = navigationItems.filter(item => {
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
          {entityNavItems.length > 0 && (
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
                  <div className='flex flex-col items-start'>
                    <span className='font-medium'>{item.label}</span>
                    {item.orgName && (
                      <span className='text-xs text-muted-foreground'>
                        {item.orgName}
                      </span>
                    )}
                  </div>
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