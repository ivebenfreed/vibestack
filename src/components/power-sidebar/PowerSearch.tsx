import { observer } from '@legendapp/state/react'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Input } from '@/components/ui/input'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Search } from 'lucide-react'
import { useDebouncedCallback } from 'use-debounce'
import { searchEntities, type SearchResult } from '@/legend-state/observables/search'
import type { NavigationMode } from '@/legend-state/observables/navigation-mode'

export const PowerSearch = observer(function PowerSearch({ mode }: { mode: NavigationMode }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const navigate = useNavigate()
  
  const placeholder = {
    all: 'Search everything... (⌘K)',
    personal: 'Search personal items...',
    work: 'Search work items...'
  }[mode]
  
  const debouncedSearch = useDebouncedCallback(
    async (value: string) => {
      if (value.trim()) {
        const searchResults = await searchEntities(value, mode)
        setResults(searchResults)
        setOpen(true)
      } else {
        setResults([])
        setOpen(false)
      }
    },
    300
  )
  
  return (
    <div className="px-3 py-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={placeholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                debouncedSearch(e.target.value)
              }}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandList>
              {results.length === 0 ? (
                <CommandEmpty>No results found.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {results.slice(0, 10).map((result) => (
                    <CommandItem
                      key={`${result.entityName}-${result.recordId}`}
                      onSelect={() => {
                        navigate({ to: `/entities/${result.entityName}/${result.recordId}` })
                        setOpen(false)
                        setQuery('')
                      }}
                    >
                      <span className="font-medium">{result.recordName}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        in {result.entityName}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
})